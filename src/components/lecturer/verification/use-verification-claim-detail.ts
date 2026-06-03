import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "#/lib/toast";
import { ELIGIBLE_FEEDBACK_CLAIM_STATUSES } from "#/lib/private-session-feedback";
import {
  getVerificationClaimFn,
  type VerificationClaimDetailDTO,
} from "#/server-actions/lecturer-verification";

export function useVerificationClaimDetail(
  claimId: string | null,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const [claim, setClaim] = useState<VerificationClaimDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const loadClaim = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      setClaim(await getVerificationClaimFn({ data: { claimId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load claim");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [claimId, onOpenChange]);

  useEffect(() => {
    if (open && claimId) {
      void loadClaim();
    } else {
      setClaim(null);
    }
  }, [open, claimId, loadClaim]);

  const timeline = useMemo(
    () =>
      claim?.timeline.map((item) => ({
        id: item.id,
        action_type: item.action_type,
        acted_at: item.acted_at,
        comment: item.comment,
        actorLabel: item.actor?.full_name ?? "System",
        digitallySigned: item.digitally_signed,
      })) ?? [],
    [claim?.timeline],
  );

  const canAct = Boolean(
    claim && ["PENDING_VERIFICATION", "DISPUTED"].includes(claim.status),
  );

  const showPrivateFeedback = Boolean(
    claim &&
      ELIGIBLE_FEEDBACK_CLAIM_STATUSES.includes(
        claim.status as (typeof ELIGIBLE_FEEDBACK_CLAIM_STATUSES)[number],
      ),
  );

  return { claim, loading, timeline, canAct, showPrivateFeedback, loadClaim } as const;
}
