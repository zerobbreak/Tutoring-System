import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Loader2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { WorkflowMessageButton } from "#/components/messaging/workflow-message-button";
import { ClaimEvidenceSection } from "#/components/lecturer/sheets/claim-evidence-section";
import {
  ClaimVerificationTimelineSection,
  type ClaimTimelineEntry,
} from "#/components/lecturer/sheets/claim-verification-timeline-section";
import { DetailSection } from "#/components/lecturer/sheets/detail-section";
import { PrivateSessionFeedbackForm } from "#/components/private-session-feedback/private-session-feedback-form";
import { VerificationDecisionPanel } from "#/components/lecturer/verification/verification-decision-panel";
import { VerificationScheduleComparisonSection } from "#/components/lecturer/verification/verification-schedule-comparison-section";
import { ELIGIBLE_FEEDBACK_CLAIM_STATUSES } from "#/lib/private-session-feedback";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import {
  getVerificationClaimFn,
  type VerificationClaimDetailDTO,
} from "#/server-actions/lecturer-verification";

type VerificationClaimDetailSheetProps = {
  claimId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
};

export function VerificationClaimDetailSheet({
  claimId,
  open,
  onOpenChange,
  onActionComplete,
}: VerificationClaimDetailSheetProps) {
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
    if (open && claimId) void loadClaim();
    else setClaim(null);
  }, [open, claimId, loadClaim]);

  const canAct =
    claim && ["PENDING_VERIFICATION", "DISPUTED"].includes(claim.status);

  const showPrivateFeedback =
    claim &&
    ELIGIBLE_FEEDBACK_CLAIM_STATUSES.includes(
      claim.status as (typeof ELIGIBLE_FEEDBACK_CLAIM_STATUSES)[number],
    );

  const timeline: ClaimTimelineEntry[] =
    claim?.timeline.map((item) => ({
      id: item.id,
      action_type: item.action_type,
      acted_at: item.acted_at,
      comment: item.comment,
      actorLabel: item.actor?.full_name ?? "System",
      digitallySigned: item.digitally_signed,
    })) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">Verify session claim</SheetTitle>
          <SheetDescription className="text-pretty">
            Review attendance evidence, compare schedule data, and record your
            decision.
          </SheetDescription>
        </SheetHeader>

        {loading || !claim ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b bg-linear-to-br from-(--lagoon-deep)/10 via-background to-background px-6 py-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">
                  {claim.tutor?.full_name ?? "Tutor"}
                </h2>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {claim.module?.code}
                  </span>
                  {" — "}
                  {claim.module?.name}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge variant={claimBadgeVariant(claim.status as ClaimStatus)}>
                    {claimBadgeLabel(claim.status as ClaimStatus)}
                  </Badge>
                  {claim.submitted_at ? (
                    <span className="text-xs text-muted-foreground">
                      Submitted{" "}
                      {formatDistanceToNow(parseISO(claim.submitted_at), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <WorkflowMessageButton kind="claim" claimId={claim.id} />
                <WorkflowMessageButton kind="session" claimId={claim.id} />
                {claim.open_dispute ? (
                  <WorkflowMessageButton
                    kind="dispute"
                    disputeId={claim.open_dispute.id}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5">
              <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/25 px-3 py-2.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Hours
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">
                      {claim.hours}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/25 px-3 py-2.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Attendance
                    </dt>
                    <dd className="mt-1 text-sm font-semibold leading-snug">
                      {claim.attendance_present_count != null
                        ? `${claim.attendance_present_count} present`
                        : `${claim.attendance_scan_count} scans`}
                      {claim.attendance_expected_count != null
                        ? ` / ${claim.attendance_expected_count} expected`
                        : ""}
                    </dd>
                  </div>
                </dl>
                <ul className="mt-4 space-y-3 border-t border-border/60 pt-4 text-sm">
                  <li>
                    <p className="text-xs font-medium text-muted-foreground">
                      Session
                    </p>
                    <p className="mt-0.5 font-medium text-foreground">
                      {format(parseISO(claim.session_date), "EEE, d MMM yyyy")}{" "}
                      · {claim.start_time?.slice(0, 5)}–
                      {claim.end_time?.slice(0, 5)}
                    </p>
                  </li>
                  {claim.venue ? (
                    <li>
                      <p className="text-xs font-medium text-muted-foreground">
                        Venue
                      </p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {claim.venue}
                      </p>
                    </li>
                  ) : null}
                </ul>
              </section>

              <VerificationScheduleComparisonSection
                comparison={claim.schedule_comparison}
              />

              <ClaimEvidenceSection evidence={claim.evidence} />

              {claim.open_dispute ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                  <p className="font-semibold text-destructive">Open dispute</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {claim.open_dispute.reason}
                  </p>
                </div>
              ) : null}

              <ClaimVerificationTimelineSection timeline={timeline} />

              {showPrivateFeedback && claimId ? (
                <DetailSection
                  title="Private feedback (optional)"
                  description="Developmental notes for the tutor — not part of the verification decision."
                  icon={MessageSquare}
                >
                  <PrivateSessionFeedbackForm claimId={claimId} />
                </DetailSection>
              ) : null}

              {canAct && claimId ? (
                <VerificationDecisionPanel
                  claimId={claimId}
                  onActionComplete={onActionComplete}
                  onClose={() => onOpenChange(false)}
                  onReloadClaim={loadClaim}
                />
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
