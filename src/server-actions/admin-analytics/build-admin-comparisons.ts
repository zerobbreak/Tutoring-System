import type { ClaimRow } from "#/server-actions/lecturer-analytics/helpers";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";
import { buildComparisonSlice } from "./build-comparison-slice";
import type { InstitutionComparisonsDTO } from "./types";

export async function buildAdminComparisons(
  ctx: AdminAnalyticsBuildContext,
): Promise<InstitutionComparisonsDTO> {
  const termLabelById = new Map(
    ctx.termRows.map((t) => [
      t.id,
      `${t.label} (${t.academic_year})`,
    ]),
  );

  const claimsByTerm = new Map<string, ClaimRow[]>();
  const scheduledByTerm = new Map<string, number>();
  const completedByTerm = new Map<string, number>();

  for (const claim of ctx.claims) {
    const termId = ctx.moduleIdToTerm.get(claim.module_id) ?? "unassigned";
    const list = claimsByTerm.get(termId) ?? [];
    list.push(claim);
    claimsByTerm.set(termId, list);
  }

  for (const s of ctx.scheduledSessions) {
    const termId = ctx.moduleIdToTerm.get(s.module_id) ?? "unassigned";
    scheduledByTerm.set(termId, (scheduledByTerm.get(termId) ?? 0) + 1);
  }
  for (const c of ctx.claims) {
    if (
      !c.source_scheduled_session_id ||
      !ctx.scheduledIds.has(c.source_scheduled_session_id) ||
      c.status === "DRAFT"
    ) {
      continue;
    }
    const termId = ctx.moduleIdToTerm.get(c.module_id) ?? "unassigned";
    completedByTerm.set(termId, (completedByTerm.get(termId) ?? 0) + 1);
  }

  const termIds = new Set([
    ...ctx.termRows.map((t) => t.id),
    ...claimsByTerm.keys(),
  ]);

  const byTerm = [...termIds]
    .map((termId) => {
      const label =
        termId === "unassigned"
          ? "Unassigned term"
          : (termLabelById.get(termId) ?? termId);
      return buildComparisonSlice(
        termId,
        label,
        claimsByTerm.get(termId) ?? [],
        scheduledByTerm.get(termId) ?? 0,
        completedByTerm.get(termId) ?? 0,
      );
    })
    .filter((s) => s.sessionCount > 0 || s.pendingCount > 0)
    .sort((a, b) => b.sessionCount - a.sessionCount);

  const venueIds = [
    ...new Set(
      ctx.scheduledSessions
        .map((s) => s.venue_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const venueCampusMap = new Map<string, string | null>();
  if (venueIds.length) {
    const { data: venues, error: vErr } = await ctx.supabase
      .from("venues")
      .select("id, campus_id")
      .in("id", venueIds);
    if (vErr) throw new Error(vErr.message);
    for (const v of venues ?? []) {
      venueCampusMap.set(v.id as string, v.campus_id as string | null);
    }
  }

  const campusLabelById = new Map(
    ctx.campusRows.map((c) => [
      c.id,
      c.name || c.code || "Campus",
    ]),
  );

  const scheduledByCampus = new Map<string, number>();
  const completedByCampus = new Map<string, number>();
  const claimsByCampus = new Map<string, ClaimRow[]>();

  for (const s of ctx.scheduledSessions) {
    const campusId =
      (s.venue_id && venueCampusMap.get(s.venue_id)) || "unassigned";
    scheduledByCampus.set(
      campusId,
      (scheduledByCampus.get(campusId) ?? 0) + 1,
    );
  }

  for (const claim of ctx.claims) {
    const campusId = "unassigned";
    if (claim.source_scheduled_session_id) {
      const session = ctx.scheduledSessions.find(
        (s) => s.id === claim.source_scheduled_session_id,
      );
      if (session?.venue_id) {
        const cid =
          venueCampusMap.get(session.venue_id) ?? "unassigned";
        const list = claimsByCampus.get(cid) ?? [];
        list.push(claim);
        claimsByCampus.set(cid, list);
        if (
          claim.source_scheduled_session_id &&
          ctx.scheduledIds.has(claim.source_scheduled_session_id) &&
          claim.status !== "DRAFT"
        ) {
          completedByCampus.set(cid, (completedByCampus.get(cid) ?? 0) + 1);
        }
        continue;
      }
    }
    const list = claimsByCampus.get(campusId) ?? [];
    list.push(claim);
    claimsByCampus.set(campusId, list);
  }

  const campusIds = new Set([
    ...ctx.campusRows.map((c) => c.id),
    ...claimsByCampus.keys(),
  ]);

  const byCampus = [...campusIds]
    .map((campusId) => {
      const label =
        campusId === "unassigned"
          ? "No campus"
          : (campusLabelById.get(campusId) ?? campusId);
      return buildComparisonSlice(
        campusId,
        label,
        claimsByCampus.get(campusId) ?? [],
        scheduledByCampus.get(campusId) ?? 0,
        completedByCampus.get(campusId) ?? 0,
      );
    })
    .filter((s) => s.sessionCount > 0 || s.pendingCount > 0)
    .sort((a, b) => b.sessionCount - a.sessionCount);

  return { byTerm, byCampus };
}
