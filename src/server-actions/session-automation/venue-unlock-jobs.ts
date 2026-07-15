import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addMinutes,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import {
  getUnlockAlertMinutesBefore,
  getUnlockDigestHour,
  getUnlockUrgentMinutesBefore,
  parseUnlockSchedulingSettings,
} from "#/lib/venue-access";
import { notifyUnlockResponders } from "#/server-actions/venue-unlock/helpers";

const INSTITUTION_TZ = "Africa/Johannesburg";

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function johannesburgParts(date: Date): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: INSTITUTION_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function formatJohannesburgTime(date: Date): string {
  const { hour, minute } = johannesburgParts(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  const pa = johannesburgParts(a);
  const pb = johannesburgParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

async function loadInstitutionUnlockSettings(db: SupabaseClient) {
  const { data, error } = await db
    .from("institutions")
    .select("id, scheduling_settings");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function completeStartedUnlockRequests(
  db: SupabaseClient,
): Promise<number> {
  const now = new Date();
  const { data, error } = await db
    .from("venue_unlock_requests")
    .select("id, scheduled_session:scheduled_sessions ( starts_at )")
    .in("status", ["PENDING", "CLAIMED", "URGENT"]);

  if (error) throw new Error(error.message);

  let completed = 0;
  for (const row of data ?? []) {
    const session = row.scheduled_session as unknown as { starts_at: string } | null;
    if (!session?.starts_at) continue;
    if (isAfter(now, parseISO(session.starts_at))) {
      const { error: upErr } = await db
        .from("venue_unlock_requests")
        .update({ status: "COMPLETED" })
        .eq("id", row.id as string);
      if (!upErr) completed += 1;
    }
  }
  return completed;
}

export async function runVenueUnlockDailyDigest(
  db: SupabaseClient,
): Promise<number> {
  const institutions = await loadInstitutionUnlockSettings(db);
  const nowUtc = new Date();
  let sent = 0;

  for (const inst of institutions) {
    const settings = parseUnlockSchedulingSettings(inst.scheduling_settings);
    const digestHour = getUnlockDigestHour(settings);
    const local = johannesburgParts(nowUtc);
    if (local.hour !== digestHour) continue;

    const { data: requests, error } = await db
      .from("venue_unlock_requests")
      .select(
        `
        id,
        last_digest_at,
        scheduled_session:scheduled_sessions (
          starts_at,
          module:modules ( code ),
          venue:venues ( name ),
          venue_text
        )
      `,
      )
      .eq("institution_id", inst.id as string)
      .in("status", ["PENDING", "CLAIMED", "URGENT"]);

    if (error) throw new Error(error.message);

    const todayLines: string[] = [];
    const requestIds: string[] = [];

    for (const req of requests ?? []) {
      const session = req.scheduled_session as unknown as {
        starts_at: string;
        module: { code: string } | null;
        venue: { name: string } | null;
        venue_text: string | null;
      } | null;
      if (!session?.starts_at) continue;

      const startsAt = parseISO(session.starts_at);
      if (!sameLocalDay(startsAt, nowUtc)) continue;

      if (req.last_digest_at && sameLocalDay(parseISO(req.last_digest_at as string), nowUtc)) {
        continue;
      }

      const venue =
        session.venue?.name ?? session.venue_text?.trim() ?? "Room";
      const time = formatJohannesburgTime(startsAt);
      todayLines.push(`${time} · ${venue} · ${session.module?.code ?? "Module"}`);
      requestIds.push(req.id as string);
    }

    if (!todayLines.length) continue;

    const count = await notifyUnlockResponders(db, {
      institutionId: inst.id as string,
      type: "VENUE_UNLOCK_DAILY_DIGEST",
      subject: `Today's computer room unlocks (${todayLines.length})`,
      body: todayLines.join("\n"),
    });

    if (count > 0 && requestIds.length) {
      await db
        .from("venue_unlock_requests")
        .update({ last_digest_at: nowUtc.toISOString() })
        .in("id", requestIds);
      sent += count;
    }
  }

  return sent;
}

export async function runVenueUnlockJitAlerts(
  db: SupabaseClient,
): Promise<number> {
  const institutions = await loadInstitutionUnlockSettings(db);
  const now = new Date();
  let sent = 0;

  for (const inst of institutions) {
    const settings = parseUnlockSchedulingSettings(inst.scheduling_settings);
    const alertMinutes = getUnlockAlertMinutesBefore(settings);
    const windowEnd = addMinutes(now, alertMinutes);

    const { data: requests, error } = await db
      .from("venue_unlock_requests")
      .select(
        `
        id,
        last_jit_at,
        scheduled_session:scheduled_sessions (
          starts_at,
          module:modules ( code ),
          venue:venues ( name ),
          venue_text
        )
      `,
      )
      .eq("institution_id", inst.id as string)
      .eq("status", "PENDING");

    if (error) throw new Error(error.message);

    for (const req of requests ?? []) {
      const session = req.scheduled_session as unknown as {
        starts_at: string;
        module: { code: string } | null;
        venue: { name: string } | null;
        venue_text: string | null;
      } | null;
      if (!session?.starts_at) continue;

      const startsAt = parseISO(session.starts_at);
      if (isBefore(startsAt, now) || isAfter(startsAt, windowEnd)) continue;

      if (req.last_jit_at) {
        const lastJit = parseISO(req.last_jit_at as string);
        if (!isAfter(now, addMinutes(lastJit, Math.max(alertMinutes - 1, 1)))) {
          continue;
        }
      }

      const venue =
        session.venue?.name ?? session.venue_text?.trim() ?? "the room";
      const mod = session.module?.code ?? "A module";
      const time = formatJohannesburgTime(startsAt);

      const count = await notifyUnlockResponders(db, {
        institutionId: inst.id as string,
        type: "VENUE_UNLOCK_JIT",
        subject: `${mod} needs ${venue} open at ${time}`,
        body: `${mod} tutor needs ${venue} open at ${time}. Open Room access to claim.`,
      });

      if (count > 0) {
        await db
          .from("venue_unlock_requests")
          .update({ last_jit_at: now.toISOString() })
          .eq("id", req.id as string);
        sent += count;
      }
    }
  }

  return sent;
}

export async function runVenueUnlockUrgentEscalation(
  db: SupabaseClient,
): Promise<number> {
  const institutions = await loadInstitutionUnlockSettings(db);
  const now = new Date();
  let sent = 0;

  for (const inst of institutions) {
    const settings = parseUnlockSchedulingSettings(inst.scheduling_settings);
    const urgentMinutes = getUnlockUrgentMinutesBefore(settings);
    const windowEnd = addMinutes(now, urgentMinutes);

    const { data: requests, error } = await db
      .from("venue_unlock_requests")
      .select(
        `
        id,
        status,
        scheduled_session:scheduled_sessions (
          starts_at,
          module:modules ( code ),
          venue:venues ( name ),
          venue_text
        )
      `,
      )
      .eq("institution_id", inst.id as string)
      .in("status", ["PENDING", "CLAIMED"]);

    if (error) throw new Error(error.message);

    for (const req of requests ?? []) {
      const session = req.scheduled_session as unknown as {
        starts_at: string;
        module: { code: string } | null;
        venue: { name: string } | null;
        venue_text: string | null;
      } | null;
      if (!session?.starts_at) continue;

      const startsAt = parseISO(session.starts_at);
      if (isBefore(startsAt, now) || isAfter(startsAt, windowEnd)) continue;
      if (req.status === "CLAIMED") continue;

      await db
        .from("venue_unlock_requests")
        .update({
          status: "URGENT",
          urgent_at: now.toISOString(),
          claimed_by: null,
          claimed_at: null,
        })
        .eq("id", req.id as string);

      const venue =
        session.venue?.name ?? session.venue_text?.trim() ?? "the room";
      const mod = session.module?.code ?? "A module";
      const time = formatJohannesburgTime(startsAt);

      const count = await notifyUnlockResponders(db, {
        institutionId: inst.id as string,
        type: "VENUE_UNLOCK_URGENT",
        subject: `URGENT: ${mod} needs ${venue} at ${time}`,
        body: `No one has claimed opening ${venue} for ${mod} at ${time}. Please respond urgently.`,
      });
      sent += count;
    }
  }

  return sent;
}

export async function runVenueUnlockAutomation(
  db: SupabaseClient,
): Promise<{
  unlockCompleted: number;
  unlockDigestSent: number;
  unlockJitSent: number;
  unlockUrgentSent: number;
}> {
  const unlockCompleted = await completeStartedUnlockRequests(db);
  const unlockDigestSent = await runVenueUnlockDailyDigest(db);
  const unlockJitSent = await runVenueUnlockJitAlerts(db);
  const unlockUrgentSent = await runVenueUnlockUrgentEscalation(db);
  return {
    unlockCompleted,
    unlockDigestSent,
    unlockJitSent,
    unlockUrgentSent,
  };
}
