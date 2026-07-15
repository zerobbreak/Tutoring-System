import { createServerFn } from "@tanstack/react-start";
import { subDays } from "date-fns";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import {
  APPROVAL_CLAIM_SELECT,
  QUEUE_LIMIT,
  QUEUE_STATUSES,
  RECENTLY_APPROVED_LIMIT,
  STALLED_DAYS,
} from "./constants";
import { mapAdminClaimCard } from "./map-admin-claim-card";
import type {
  AdminApprovalClaimCardDTO,
  AdminApprovalsQueueDTO,
  VerificationModuleOptionDTO,
} from "./types";

const listSchema = z.object({
  moduleId: z.string().uuid().optional(),
  search: z.string().max(120).optional(),
});

async function fetchClaimsByStatuses(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  moduleIds: string[],
  statuses: readonly string[],
  options?: { limit?: number; orderBy?: "submitted_at" | "updated_at" },
): Promise<AdminApprovalClaimCardDTO[]> {
  if (!moduleIds.length) return [];

  let query = supabase
    .from("session_claims")
    .select(APPROVAL_CLAIM_SELECT)
    .in("module_id", moduleIds)
    .in("status", [...statuses]);

  if (options?.orderBy === "submitted_at") {
    query = query
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("session_date", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  } else {
    query = query.limit(QUEUE_LIMIT);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);
  const { evidenceCountByClaim, scanCountByClaim } = await loadClaimCounts(
    supabase,
    ids,
  );

  return rows.map((row) =>
    mapAdminClaimCard(
      row as Parameters<typeof mapAdminClaimCard>[0],
      evidenceCountByClaim.get(row.id as string) ?? 0,
      scanCountByClaim.get(row.id as string) ?? 0,
      (row.status as string) === "VERIFIED" || (row.status as string) === "APPROVED",
    ),
  );
}

function filterClaims(
  claims: AdminApprovalClaimCardDTO[],
  search?: string,
  moduleId?: string,
): AdminApprovalClaimCardDTO[] {
  let result = claims;
  if (moduleId) {
    result = result.filter((c) => c.module?.id === moduleId);
  }
  const q = search?.trim().toLowerCase();
  if (q) {
    result = result.filter((c) => {
      const moduleText = `${c.module?.code ?? ""} ${c.module?.name ?? ""}`.toLowerCase();
      const tutorText = `${c.tutor?.full_name ?? ""} ${c.tutor?.email ?? ""}`.toLowerCase();
      return moduleText.includes(q) || tutorText.includes(q);
    });
  }
  return result;
}

function buildEscalated(
  claims: AdminApprovalClaimCardDTO[],
  stalledBefore: string,
  openDisputeClaimIds: Set<string>,
): AdminApprovalClaimCardDTO[] {
  const seen = new Set<string>();
  const escalated: AdminApprovalClaimCardDTO[] = [];

  for (const c of claims) {
    if (seen.has(c.id)) continue;

    const isFrozen = Boolean(c.frozen_at);
    const isStalled =
      c.submitted_at != null &&
      c.submitted_at < stalledBefore &&
      ["VERIFIED", "DISPUTED", "PENDING_VERIFICATION"].includes(c.status);
    const hasOpenDisputeOnVerified =
      c.status === "VERIFIED" && openDisputeClaimIds.has(c.id);

    if (isFrozen || isStalled || hasOpenDisputeOnVerified) {
      seen.add(c.id);
      escalated.push(c);
    }
  }

  return escalated.sort((a, b) => {
    const aAt = a.frozen_at ?? a.submitted_at ?? a.updated_at;
    const bAt = b.frozen_at ?? b.submitted_at ?? b.updated_at;
    return bAt.localeCompare(aAt);
  });
}

export const listApprovalsQueueFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<AdminApprovalsQueueDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const stalledBefore = subDays(new Date(), STALLED_DAYS).toISOString();

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("institution_id", institutionId)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []) as VerificationModuleOptionDTO[];
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return {
        awaitingAdmin: [],
        disputed: [],
        recentlyApproved: [],
        escalated: [],
        modules: [],
      };
    }

    const scopedModuleIds = data.moduleId
      ? moduleIds.filter((id) => id === data.moduleId)
      : moduleIds;

    const [awaitingRaw, disputedRaw, recentlyRaw, escalatedSourceRaw, disputesRes] =
      await Promise.all([
        fetchClaimsByStatuses(
          supabase,
          scopedModuleIds,
          QUEUE_STATUSES.awaitingAdmin,
          { orderBy: "submitted_at" },
        ),
        fetchClaimsByStatuses(supabase, scopedModuleIds, QUEUE_STATUSES.disputed, {
          orderBy: "updated_at",
        }),
        fetchClaimsByStatuses(
          supabase,
          scopedModuleIds,
          QUEUE_STATUSES.recentlyApproved,
          { limit: RECENTLY_APPROVED_LIMIT, orderBy: "updated_at" },
        ),
        fetchClaimsByStatuses(
          supabase,
          scopedModuleIds,
          QUEUE_STATUSES.escalatedSource,
          { limit: QUEUE_LIMIT, orderBy: "submitted_at" },
        ),
        supabase
          .from("disputes")
          .select("claim_id")
          .eq("status", "OPEN"),
      ]);

    if (disputesRes.error) throw new Error(disputesRes.error.message);

    const openDisputeClaimIds = new Set(
      (disputesRes.data ?? []).map((d) => d.claim_id as string),
    );

    const awaitingAdmin = filterClaims(
      awaitingRaw.filter((c) => !c.frozen_at),
      data.search,
      data.moduleId,
    );
    const disputed = filterClaims(disputedRaw, data.search, data.moduleId);
    const recentlyApproved = filterClaims(
      recentlyRaw,
      data.search,
      data.moduleId,
    );
    const escalated = filterClaims(
      buildEscalated(escalatedSourceRaw, stalledBefore, openDisputeClaimIds),
      data.search,
      data.moduleId,
    );

    return {
      awaitingAdmin,
      disputed,
      recentlyApproved,
      escalated,
      modules: moduleRows,
    };
  });
