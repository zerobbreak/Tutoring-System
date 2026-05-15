import type { createSupabaseServerClient } from "#/lib/supabase-server";
import type { LecturerEvidencePreviewDTO } from "./types";

export async function loadEvidenceByClaim(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimIds: string[],
): Promise<{
  evidenceByClaim: Map<string, LecturerEvidencePreviewDTO[]>;
  evidenceClaimIds: Set<string>;
}> {
  const evidenceByClaim = new Map<string, LecturerEvidencePreviewDTO[]>();
  const evidenceClaimIds = new Set<string>();

  if (!claimIds.length) {
    return { evidenceByClaim, evidenceClaimIds };
  }

  const { data: evRows, error: evErr } = await supabase
    .from("attendance_evidence")
    .select("claim_id, original_filename, uploaded_at")
    .in("claim_id", claimIds)
    .order("uploaded_at", { ascending: false });

  if (evErr) throw new Error(evErr.message);

  for (const row of evRows ?? []) {
    const claimId = row.claim_id as string;
    evidenceClaimIds.add(claimId);
    const list = evidenceByClaim.get(claimId) ?? [];
    list.push({
      original_filename: row.original_filename as string,
      uploaded_at: (row.uploaded_at as string) || new Date().toISOString(),
    });
    evidenceByClaim.set(claimId, list);
  }

  return { evidenceByClaim, evidenceClaimIds };
}
