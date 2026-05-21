import { Loader2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PrivateSessionFeedbackDisplay } from "#/components/private-session-feedback/private-session-feedback-display";
import { ELIGIBLE_FEEDBACK_CLAIM_STATUSES } from "#/lib/private-session-feedback";
import {
  getPrivateSessionFeedbackForClaimFn,
  type PrivateSessionFeedbackDTO,
} from "#/server-actions/private-session-feedback";

type PrivateSessionFeedbackReadBlockProps = {
  claimId: string;
  claimStatus: string;
  title?: string;
  description?: string;
};

export function PrivateSessionFeedbackReadBlock({
  claimId,
  claimStatus,
  title = "Notes from your lecturer",
  description,
}: PrivateSessionFeedbackReadBlockProps) {
  const [feedback, setFeedback] = useState<PrivateSessionFeedbackDTO | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const eligible = ELIGIBLE_FEEDBACK_CLAIM_STATUSES.includes(
    claimStatus as (typeof ELIGIBLE_FEEDBACK_CLAIM_STATUSES)[number],
  );

  const load = useCallback(async () => {
    if (!eligible) {
      setFeedback(null);
      return;
    }
    setLoading(true);
    try {
      const row = await getPrivateSessionFeedbackForClaimFn({
        data: { claimId },
      });
      setFeedback(row);
    } catch {
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }, [claimId, eligible]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!eligible || loading) {
    if (loading) {
      return (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return null;
  }

  if (!feedback) return null;

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10">
          <MessageSquare className="size-4 text-(--lagoon-deep)" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          {description ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <PrivateSessionFeedbackDisplay feedback={feedback} />
    </section>
  );
}
