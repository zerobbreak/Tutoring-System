import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  decodeAndParseScheduleUpload,
  scheduleFileUploadSchema,
} from "#/lib/schedule-parse-server";
import { scheduleEventFingerprint } from "#/lib/schedule-event-fingerprint";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { ScheduleParseResult } from "#/lib/schedule-spreadsheet";
import {
  parseResultForStorage,
  parseScheduleParseResultFromJson,
  type TutorScheduleImportSource,
} from "#/lib/tutor-schedule-imports";

const deleteImportSchema = z.object({
  id: z.string().uuid(),
});

const ensureSessionClaimSchema = z.object({
  importId: z.string().uuid(),
  start: z.string().min(1),
  end: z.string().min(1),
  title: z.string().min(1),
  moduleCode: z.string().optional(),
  location: z.string().optional(),
  sessionType: z.string().optional(),
});

function inferSessionKind(sessionType?: string | null): string | null {
  const raw = sessionType?.trim();
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t.includes("consult")) return "consultation";
  if (t.includes("meridian") || t.includes("office hour")) return "consultation_hour";
  if (t.includes("exam")) return "exam_prep";
  if (t.includes("revision")) return "revision";
  if (t.includes("lecture")) return "lecture";
  if (t.includes("lecturer") || t.includes("meeting")) return "lecturer_meeting";
  if (t.includes("special")) return "special_event";
  if (t.includes("online") || t.includes("remote")) return "online";
  if (t.includes("tutorial") || t.includes("tutor") || t.includes("lab"))
    return "tutorial";
  return "other";
}

function scheduleClaimTimesFromIso(startIso: string, endIso: string): {
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
} {
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new Error("Invalid start or end time.");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const session_date = `${a.getFullYear()}-${pad(a.getMonth() + 1)}-${pad(a.getDate())}`;
  const start_time = `${pad(a.getHours())}:${pad(a.getMinutes())}:00`;
  const end_time = `${pad(b.getHours())}:${pad(b.getMinutes())}:00`;
  const ms = b.getTime() - a.getTime();
  if (ms <= 0) throw new Error("End time must be after start time.");
  const hours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
  return { session_date, start_time, end_time, hours };
}

async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

/** Load persisted spreadsheet imports for the signed-in tutor (RLS applies). */
export const listTutorScheduleImportsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<TutorScheduleImportSource[]> => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

  const { data, error } = await supabase
    .from("tutor_schedule_imports")
    .select("id, file_name, parse_result")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const sources: TutorScheduleImportSource[] = [];
  for (const row of data ?? []) {
    const parsed = parseScheduleParseResultFromJson(row.parse_result);
    if (parsed) {
      sources.push({
        id: row.id,
        fileName: row.file_name,
        result: parsed,
      });
    }
  }
  return sources;
});

/** Parse a CSV/XLSX upload and persist one `tutor_schedule_imports` row. */
export const saveTutorScheduleImportFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => scheduleFileUploadSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{
      id: string;
      fileName: string;
      result: ScheduleParseResult;
    }> => {
      const supabase = createSupabaseServerClient();
      const tutorId = await requireUserId(supabase);

      const parsed = decodeAndParseScheduleUpload(
        data.fileBase64,
        data.fileName,
      );
      const payload = parseResultForStorage(parsed);

      const { data: inserted, error } = await supabase
        .from("tutor_schedule_imports")
        .insert({
          tutor_id: tutorId,
          file_name: data.fileName,
          parse_result: payload,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      if (!inserted?.id) throw new Error("Import was not saved.");

      return { id: inserted.id, fileName: data.fileName, result: parsed };
    },
  );

/** Remove one import row owned by the current tutor. */
export const deleteTutorScheduleImportFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteImportSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { error } = await supabase
      .from("tutor_schedule_imports")
      .delete()
      .eq("id", data.id)
      .eq("tutor_id", tutorId);

    if (error) throw new Error(error.message);
  });

/** Delete all schedule imports for the current tutor. */
export const clearTutorScheduleImportsFn = createServerFn({
  method: "POST",
}).handler(async () => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

  const { error } = await supabase
    .from("tutor_schedule_imports")
    .delete()
    .eq("tutor_id", tutorId);

  if (error) throw new Error(error.message);
});

/**
 * Find or create a DRAFT session_claim for this imported timetable row
 * (idempotent per tutor + import + fingerprint).
 */
export const ensureSessionClaimForScheduleEventFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => ensureSessionClaimSchema.parse(input))
  .handler(async ({ data }): Promise<{ claimId: string }> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: imp, error: impErr } = await supabase
      .from("tutor_schedule_imports")
      .select("id")
      .eq("id", data.importId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (impErr) throw new Error(impErr.message);
    if (!imp) throw new Error("Schedule import not found.");

    const fingerprint = scheduleEventFingerprint({
      start: data.start,
      end: data.end,
      title: data.title,
      moduleCode: data.moduleCode,
    });

    const { data: existing, error: selErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("source_schedule_import_id", data.importId)
      .eq("source_event_fingerprint", fingerprint)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (existing?.id) return { claimId: existing.id };

    const code = (data.moduleCode ?? "").trim();
    if (!code) {
      throw new Error(
        "This slot has no module code. Add a module column in your spreadsheet or pick a session that lists a module code so a claim can be created.",
      );
    }

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("institution_id")
      .eq("id", tutorId)
      .maybeSingle();

    if (userErr) throw new Error(userErr.message);
    if (!userRow?.institution_id) {
      throw new Error(
        "Your profile is not linked to an institution. Contact an admin before creating session claims.",
      );
    }

    const candidates = [
      code,
      code.toUpperCase(),
      code.toLowerCase(),
    ];
    const tried = new Set<string>();
    let moduleId: string | null = null;
    for (const candidate of candidates) {
      if (tried.has(candidate)) continue;
      tried.add(candidate);
      const { data: modRow, error: modErr } = await supabase
        .from("modules")
        .select("id")
        .eq("institution_id", userRow.institution_id)
        .eq("code", candidate)
        .maybeSingle();
      if (modErr) throw new Error(modErr.message);
      if (modRow?.id) {
        moduleId = modRow.id;
        break;
      }
    }

    if (!moduleId) {
      throw new Error(
        `No module matches code “${code}” in your institution. Check the spelling or ask an admin to add the module.`,
      );
    }

    const times = scheduleClaimTimesFromIso(data.start, data.end);
    const venue =
      data.location?.trim() === "" ? null : (data.location?.trim() ?? null);
    const session_kind = inferSessionKind(data.sessionType);

    const row = {
      tutor_id: tutorId,
      module_id: moduleId,
      session_date: times.session_date,
      start_time: times.start_time,
      end_time: times.end_time,
      hours: times.hours,
      venue,
      status: "DRAFT" as const,
      source_schedule_import_id: data.importId,
      source_event_fingerprint: fingerprint,
      session_kind,
      creation_source: "IMPORT" as const,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("session_claims")
      .insert(row)
      .select("id")
      .single();

    if (!insErr && inserted?.id) return { claimId: inserted.id };

    if (insErr?.code === "23505") {
      const { data: again } = await supabase
        .from("session_claims")
        .select("id")
        .eq("tutor_id", tutorId)
        .eq("source_schedule_import_id", data.importId)
        .eq("source_event_fingerprint", fingerprint)
        .maybeSingle();
      if (again?.id) return { claimId: again.id };
    }

    throw new Error(insErr?.message ?? "Could not create session claim.");
  });
