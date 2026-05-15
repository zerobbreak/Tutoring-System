import type { createSupabaseServerClient } from "#/lib/supabase-server";

export async function loadClaimCounts(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimIds: string[],
): Promise<{
  evidenceCountByClaim: Map<string, number>;
  scanCountByClaim: Map<string, number>;
}> {
  const evidenceCountByClaim = new Map<string, number>();
  const scanCountByClaim = new Map<string, number>();

  if (!claimIds.length) {
    return { evidenceCountByClaim, scanCountByClaim };
  }

  const [evRes, scanRes] = await Promise.all([
    supabase
      .from("attendance_evidence")
      .select("claim_id")
      .in("claim_id", claimIds),
    supabase
      .from("session_attendance")
      .select("session_id")
      .in("session_id", claimIds),
  ]);

  if (evRes.error) throw new Error(evRes.error.message);
  if (scanRes.error) throw new Error(scanRes.error.message);

  for (const row of evRes.data ?? []) {
    const id = row.claim_id as string;
    evidenceCountByClaim.set(id, (evidenceCountByClaim.get(id) ?? 0) + 1);
  }

  for (const row of scanRes.data ?? []) {
    const id = row.session_id as string;
    scanCountByClaim.set(id, (scanCountByClaim.get(id) ?? 0) + 1);
  }

  return { evidenceCountByClaim, scanCountByClaim };
}
