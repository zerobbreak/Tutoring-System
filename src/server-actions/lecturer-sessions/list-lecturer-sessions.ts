import { createServerFn } from "@tanstack/react-start";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import { CANCELLED_SESSION_SELECT, LECTURER_SESSION_CLAIM_SELECT } from "./constants";
import { mapSessionCardRow } from "./map-session-card";
import type {
  CancelledScheduleRowDTO,
  LecturerSessionsPageDataDTO,
} from "./types";

export const listLecturerSessionsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerSessionsPageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const now = new Date();

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id")
      .eq("lecturer_id", lecturerId);

    if (modErr) throw new Error(modErr.message);
    const moduleIds = (modules ?? []).map((m) => m.id as string);

    if (!moduleIds.length) {
      return {
        today: [],
        upcoming: [],
        completed: [],
        cancelledSchedule: [],
        rejectedClaims: [],
      };
    }

    const { data: claimRows, error: claimErr } = await supabase
      .from("session_claims")
      .select(LECTURER_SESSION_CLAIM_SELECT)
      .in("module_id", moduleIds)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (claimErr) throw new Error(claimErr.message);

    const rows = claimRows ?? [];
    const claimIds = rows.map((r) => r.id as string);
    const { evidenceCountByClaim, scanCountByClaim } = await loadClaimCounts(
      supabase,
      claimIds,
    );

    const allCards = rows.map((row) =>
      mapSessionCardRow(
        row as Parameters<typeof mapSessionCardRow>[0],
        evidenceCountByClaim.get(row.id as string) ?? 0,
        scanCountByClaim.get(row.id as string) ?? 0,
        now,
      ),
    );

    const activeClaims = allCards.filter((c) => c.status !== "REJECTED");
    const rejectedClaims = allCards.filter((c) => c.status === "REJECTED");

    const today = activeClaims.filter((c) => c.time_bucket === "today");
    const upcoming = activeClaims.filter((c) => c.time_bucket === "upcoming");
    const completed = activeClaims.filter((c) => c.time_bucket === "completed");

    const { data: cancelledRows, error: cancelErr } = await supabase
      .from("scheduled_sessions")
      .select(CANCELLED_SESSION_SELECT)
      .in("module_id", moduleIds)
      .eq("status", "CANCELLED")
      .order("starts_at", { ascending: false });

    if (cancelErr) throw new Error(cancelErr.message);

    const scheduledIds = (cancelledRows ?? []).map((r) => r.id as string);
    const claimByScheduled = new Map<string, string>();

    if (scheduledIds.length) {
      const { data: linkedClaims } = await supabase
        .from("session_claims")
        .select("id, source_scheduled_session_id")
        .in("source_scheduled_session_id", scheduledIds);

      for (const c of linkedClaims ?? []) {
        if (c.source_scheduled_session_id) {
          claimByScheduled.set(
            c.source_scheduled_session_id as string,
            c.id as string,
          );
        }
      }
    }

    const cancelledSchedule: CancelledScheduleRowDTO[] = (cancelledRows ?? []).map(
      (row) => {
        const mod = Array.isArray(row.module) ? row.module[0] : row.module;
        const tutor = Array.isArray(row.tutor) ? row.tutor[0] : row.tutor;
        const series = Array.isArray(row.series) ? row.series[0] : row.series;
        const id = row.id as string;
        return {
          id,
          starts_at: row.starts_at as string,
          ends_at: row.ends_at as string,
          venue_text: row.venue_text as string | null,
          title: (series as { title?: string } | null)?.title ?? "Session",
          module_code: (mod as { code?: string })?.code ?? "",
          module_name: (mod as { name?: string })?.name ?? "",
          tutor_name: (tutor as { full_name?: string })?.full_name ?? "",
          linked_claim_id: claimByScheduled.get(id) ?? null,
        };
      },
    );

    return {
      today,
      upcoming,
      completed,
      cancelledSchedule,
      rejectedClaims,
    };
  },
);
