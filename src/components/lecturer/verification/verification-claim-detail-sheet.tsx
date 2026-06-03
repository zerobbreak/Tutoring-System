import { format, parseISO } from "date-fns";
import { Loader2, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { ClaimEvidenceSection } from "#/components/lecturer/sheets/claim-evidence-section";
import { ClaimVerificationTimelineSection } from "#/components/lecturer/sheets/claim-verification-timeline-section";
import { DetailSection } from "#/components/lecturer/sheets/detail-section";
import { PrivateSessionFeedbackForm } from "#/components/private-session-feedback/private-session-feedback-form";
import { VerificationDecisionPanel } from "#/components/lecturer/verification/verification-decision-panel";
import { VerificationScheduleComparisonSection } from "#/components/lecturer/verification/verification-schedule-comparison-section";
import { VerificationClaimDetailSheetHeader } from "#/components/lecturer/verification/verification-claim-detail-sheet-header";
import { useVerificationClaimDetail } from "#/components/lecturer/verification/use-verification-claim-detail";

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
  const {
    claim,
    loading,
    timeline,
    canAct,
    showPrivateFeedback,
    loadClaim,
  } = useVerificationClaimDetail(claimId, open, onOpenChange);

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
            <VerificationClaimDetailSheetHeader claim={claim} />

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
