import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  MessageSquare,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { WorkflowMessageButton } from "#/components/messaging/workflow-message-button";
import { StepUpMfaDialog } from "#/components/workflow/step-up-mfa-dialog";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { PrivateSessionFeedbackForm } from "#/components/private-session-feedback/private-session-feedback-form";
import { ELIGIBLE_FEEDBACK_CLAIM_STATUSES } from "#/lib/private-session-feedback";
import {
  getVerificationClaimFn,
  performVerificationActionFn,
  type VerificationActionKind,
  type VerificationClaimDetailDTO,
} from "#/server-actions/lecturer-verification";

type VerificationClaimDetailSheetProps = {
  claimId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
};

function DetailSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10">
          <Icon className="size-4 text-(--lagoon-deep)" aria-hidden />
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
      {children}
    </section>
  );
}

function ComparisonRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/50 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 text-right font-medium tabular-nums",
          highlight ? "text-amber-700 dark:text-amber-300" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function VerificationClaimDetailSheet({
  claimId,
  open,
  onOpenChange,
  onActionComplete,
}: VerificationClaimDetailSheetProps) {
  const [claim, setClaim] = useState<VerificationClaimDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<VerificationActionKind | null>(null);

  const loadClaim = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const data = await getVerificationClaimFn({ data: { claimId } });
      setClaim(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load claim");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [claimId, onOpenChange]);

  useEffect(() => {
    if (open && claimId) {
      setComment("");
      setPendingAction(null);
      void loadClaim();
    } else {
      setClaim(null);
    }
  }, [open, claimId, loadClaim]);

  const requestAction = (action: VerificationActionKind) => {
    setPendingAction(action);
    setStepUpOpen(true);
  };

  const runActionWithMfa = async (stepUpCode: string) => {
    if (!claimId || !pendingAction) return;
    const action = pendingAction;
    const keepOpenForFeedback =
      action === "APPROVE" || action === "SIGN_AND_APPROVE";
    setSubmitting(true);
    try {
      await performVerificationActionFn({
        data: {
          claimId,
          action,
          comment: comment.trim() || undefined,
          stepUpCode,
        },
      });
      toast.success("Verification action recorded.");
      setStepUpOpen(false);
      setPendingAction(null);
      setComment("");
      onActionComplete();
      if (keepOpenForFeedback) {
        await loadClaim();
        toast.info("You can add optional private feedback below.");
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canAct =
    claim && ["PENDING_VERIFICATION", "DISPUTED"].includes(claim.status);

  const showPrivateFeedback =
    claim &&
    ELIGIBLE_FEEDBACK_CLAIM_STATUSES.includes(
      claim.status as (typeof ELIGIBLE_FEEDBACK_CLAIM_STATUSES)[number],
    );

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
                  <li className="flex gap-3">
                    <Calendar
                      className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        Session
                      </p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {format(parseISO(claim.session_date), "EEE, d MMM yyyy")}{" "}
                        · {claim.start_time?.slice(0, 5)}–
                        {claim.end_time?.slice(0, 5)}
                      </p>
                    </div>
                  </li>
                  {claim.venue ? (
                    <li className="flex gap-3">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Venue
                        </p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {claim.venue}
                        </p>
                      </div>
                    </li>
                  ) : null}
                </ul>
              </section>

              <DetailSection
                title="Schedule vs attendance"
                description="Compare the claimed slot with timetable and QR data."
                icon={Clock}
              >
                <div className="divide-y rounded-lg border border-border/60 bg-muted/20">
                  <ComparisonRow
                    label="Claimed slot"
                    value={
                      <>
                        {claim.schedule_comparison.claim_date} ·{" "}
                        {claim.schedule_comparison.claim_start?.slice(0, 5)}–
                        {claim.schedule_comparison.claim_end?.slice(0, 5)}
                      </>
                    }
                  />
                  <ComparisonRow
                    label="From timetable"
                    value={
                      claim.schedule_comparison.linked_from_schedule
                        ? "Linked import"
                        : "Manual entry"
                    }
                  />
                  <ComparisonRow
                    label="QR scans"
                    value={claim.schedule_comparison.attendance_scan_count}
                  />
                </div>
                {claim.schedule_comparison.headcount_matches_scans === false ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Headcount does not match scan count.
                  </p>
                ) : null}
              </DetailSection>

              <DetailSection
                title="Attendance evidence"
                description="Registers and files uploaded by the tutor."
                icon={FileText}
              >
                {claim.evidence.length === 0 ? (
                  <EmptyHint>No register uploaded.</EmptyHint>
                ) : (
                  <ul className="space-y-2">
                    {claim.evidence.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {ev.file_name}
                        </span>
                        <Button variant="ghost" size="sm" className="shrink-0" asChild>
                          <a
                            href={ev.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-4" />
                            Open
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>

              {claim.open_dispute ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                  <p className="font-semibold text-destructive">Open dispute</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {claim.open_dispute.reason}
                  </p>
                </div>
              ) : null}

              <DetailSection
                title="Verification timeline"
                description="Prior actions on this claim."
                icon={History}
              >
                {claim.timeline.length === 0 ? (
                  <EmptyHint>No verification actions yet.</EmptyHint>
                ) : (
                  <ol className="space-y-4 border-l-2 border-(--lagoon-deep)/25 pl-4">
                    {claim.timeline.map((item) => (
                      <li key={item.id} className="relative text-sm">
                        <span className="absolute -left-[calc(1rem+5px)] top-1.5 size-2 rounded-full bg-(--lagoon-deep)" />
                        <p className="font-medium capitalize text-foreground">
                          {item.action_type.replace(/_/g, " ")}
                          {item.digitally_signed ? " (signed)" : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.actor?.full_name ?? "System"} ·{" "}
                          {format(parseISO(item.acted_at), "dd MMM yyyy, HH:mm")}
                        </p>
                        {item.comment ? (
                          <p className="mt-1.5 leading-relaxed text-muted-foreground">
                            {item.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </DetailSection>

              {showPrivateFeedback && claimId ? (
                <DetailSection
                  title="Private feedback (optional)"
                  description="Developmental notes for the tutor — not part of the verification decision."
                  icon={MessageSquare}
                >
                  <PrivateSessionFeedbackForm claimId={claimId} />
                </DetailSection>
              ) : null}

              {canAct ? (
                <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">Your decision</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add an optional comment (required for reject or dispute).
                    You will confirm with your authenticator app.
                  </p>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="verification-comment">
                        Comment (optional)
                      </Label>
                      <textarea
                        id="verification-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Required for reject or dispute…"
                        rows={3}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        disabled={submitting}
                        className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        onClick={() => requestAction("APPROVE")}
                      >
                        <CheckCircle2 className="size-4" />
                        Verify
                      </Button>
                      <Button
                        disabled={submitting}
                        variant="outline"
                        onClick={() => requestAction("REQUEST_CLARIFICATION")}
                      >
                        <MessageSquare className="size-4" />
                        Request clarification
                      </Button>
                      <Button
                        disabled={submitting}
                        variant="outline"
                        onClick={() => requestAction("DISPUTE")}
                      >
                        <AlertTriangle className="size-4" />
                        Dispute
                      </Button>
                      <Button
                        disabled={submitting}
                        variant="destructive"
                        className="sm:col-span-2"
                        onClick={() => requestAction("REJECT")}
                      >
                        <XCircle className="size-4" />
                        Reject submission
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>

      <StepUpMfaDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Confirm verification"
        description="Enter your authenticator code to record this verification decision."
        confirmLabel="Confirm decision"
        submitting={submitting}
        onConfirm={runActionWithMfa}
      />
    </Sheet>
  );
}
