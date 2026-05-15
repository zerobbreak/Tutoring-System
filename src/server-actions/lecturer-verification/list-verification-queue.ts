import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  QUEUE_STATUSES,
  RECENTLY_VERIFIED_LIMIT,
  VERIFICATION_CLAIM_SELECT,
} from "./constants";
import { loadClaimCounts } from "./load-claim-counts";
import { mapClaimCardRow } from "./map-claim-card";
import type {
  VerificationClaimCardDTO,
  VerificationModuleOptionDTO,
  VerificationQueueDataDTO,
} from "./types";

const listQueueSchema = z.object({
  moduleId: z.string().uuid().optional(),
  search: z.string().max(120).optional(),
});

async function fetchClaimsByStatuses(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  moduleIds: string[],
  statuses: readonly string[],
  options?: { limit?: number; orderBy?: "submitted_at" | "updated_at" },
): Promise<VerificationClaimCardDTO[]> {
  if (!moduleIds.length) return [];

  let query = supabase
    .from("session_claims")
    .select(VERIFICATION_CLAIM_SELECT)
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
    mapClaimCardRow(
      row as Parameters<typeof mapClaimCardRow>[0],
      evidenceCountByClaim.get(row.id as string) ?? 0,
      scanCountByClaim.get(row.id as string) ?? 0,
    ),
  );
}

function filterClaims(
  claims: VerificationClaimCardDTO[],
  search?: string,
  moduleId?: string,
): VerificationClaimCardDTO[] {
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

export const listVerificationQueueFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listQueueSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<VerificationQueueDataDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", lecturerId)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []) as VerificationModuleOptionDTO[];
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return { pending: [], disputed: [], recentlyVerified: [], modules: [] };
    }

    const scopedModuleIds = data.moduleId
      ? moduleIds.filter((id) => id === data.moduleId)
      : moduleIds;

    const [pending, disputed, recentlyVerified] = await Promise.all([
      fetchClaimsByStatuses(
        supabase,
        scopedModuleIds,
        QUEUE_STATUSES.pending,
        { orderBy: "submitted_at" },
      ),
      fetchClaimsByStatuses(supabase, scopedModuleIds, QUEUE_STATUSES.disputed, {
        orderBy: "updated_at",
      }),
      fetchClaimsByStatuses(
        supabase,
        scopedModuleIds,
        QUEUE_STATUSES.recentlyVerified,
        { limit: RECENTLY_VERIFIED_LIMIT, orderBy: "updated_at" },
      ),
    ]);

    return {
      pending: filterClaims(pending, data.search, data.moduleId),
      disputed: filterClaims(disputed, data.search, data.moduleId),
      recentlyVerified: filterClaims(
        recentlyVerified,
        data.search,
        data.moduleId,
      ),
      modules: moduleRows,
    };
  });
