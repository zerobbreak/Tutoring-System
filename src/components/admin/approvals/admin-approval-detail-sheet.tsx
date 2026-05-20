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
  ShieldCheck,
  Snowflake,
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
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { StepUpMfaDialog } from "#/components/workflow/step-up-mfa-dialog";
import {
  getApprovalClaimFn,
  performAdminApprovalActionFn,
  type AdminApprovalActionKind,
  type AdminApprovalClaimDetailDTO,
} from "#/server-actions/admin-approvals";

type AdminApprovalDetailSheetProps = {
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

function EmptyHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function AdminApprovalDetailSheet({
  claimId,
  open,
  onOpenChange,
  onActionComplete,
}: AdminApprovalDetailSheetProps) {
  const [claim, setClaim] = useState<AdminApprovalClaimDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<AdminApprovalActionKind | null>(null);

  const loadClaim = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const data = await getApprovalClaimFn({ data: { claimId } });
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
      void loadClaim();
    } else {
      setClaim(null);
    }
  }, [open, claimId, loadClaim]);

  const requestAction = (action: AdminApprovalActionKind) => {
    setPendingAction(action);
    setStepUpOpen(true);
  };

  const runActionWithMfa = async (stepUpCode: string) => {
    if (!claimId || !pendingAction) return;
    setSubmitting(true);
    try {
      await performAdminApprovalActionFn({
        data: {
          claimId,
          action: pendingAction,
          comment: comment.trim() || undefined,
          stepUpCode,
        },
      });
      toast.success("Action recorded.");
      setStepUpOpen(false);
      setPendingAction(null);
      onActionComplete();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const frozen = Boolean(claim?.frozen_at);
  const canApprove = claim?.status === "VERIFIED" && !frozen;
  const canReject =
    claim && ["VERIFIED", "DISPUTED"].includes(claim.status) && !frozen;
  const canClarify = claim?.status === "VERIFIED" && !frozen;
  const canEscalate = claim?.status === "DISPUTED" && !frozen;
  const canFreeze = claim && !frozen;
  const hasActions =
    canApprove || canReject || canClarify || canEscalate || canFreeze;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">Institutional verification</SheetTitle>
          <SheetDescription className="text-pretty">
            Review lecturer-verified claims and record admin decisions.
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
                  {claim.lecturer_verified ? (
                    <Badge variant="success" className="gap-1">
                      <ShieldCheck className="size-3" aria-hidden />
                      Lecturer verified
                    </Badge>
                  ) : null}
                  {frozen ? (
                    <Badge variant="secondary" className="gap-1 border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-100">
                      <Snowflake className="size-3" aria-hidden />
                      Frozen
                    </Badge>
                  ) : null}
                </div>
              </div>

              {claim.submitted_at ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Submitted{" "}
                  {formatDistanceToNow(parseISO(claim.submitted_at), {
                    addSuffix: true,
                  })}
                </p>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5">
              {frozen ? (
                <div className="flex gap-3 rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm leading-relaxed text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                  <Snowflake
                    className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300"
                    aria-hidden
                  />
                  <p>
                    This claim is frozen. No status changes until an admin clears
                    the freeze (not available in v1).
                  </p>
                </div>
              ) : null}

              {claim.open_dispute ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    Open dispute
                  </p>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {claim.open_dispute.reason}
                  </p>
                </div>
              ) : null}

              <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <Calendar
                      className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        Session
                      </p>
                      <p className="mt-0.5 font-medium leading-snug text-foreground">
                        {format(parseISO(claim.session_date), "EEE, d MMM yyyy")}{" "}
                        · {formatClock(claim.start_time)}–
                        {formatClock(claim.end_time)}
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

                <dl className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/25 px-3 py-2.5 sm:col-span-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      Hours claimed
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">
                      {claim.hours}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/25 px-3 py-2.5 sm:col-span-1">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Evidence
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      {claim.evidence.length > 0
                        ? `${claim.evidence.length} file${claim.evidence.length === 1 ? "" : "s"}`
                        : "None uploaded"}
                    </dd>
                  </div>
                </dl>
              </section>

              <DetailSection
                title="Verification timeline"
                description="Tutor submission through admin decision."
                icon={History}
              >
                {claim.workflow_stages.length === 0 ? (
                  <EmptyHint>No workflow events recorded yet.</EmptyHint>
                ) : (
                  <ol className="space-y-4 border-l-2 border-(--lagoon-deep)/25 pl-4">
                    {claim.workflow_stages.map((stage, index) => (
                      <li key={stage.id} className="relative text-sm">
                        <span
                          className={cn(
                            "absolute -left-[calc(1rem+5px)] top-1.5 size-2 rounded-full",
                            index === claim.workflow_stages.length - 1
                              ? "bg-(--lagoon-deep)"
                              : "bg-(--lagoon-deep)/40",
                          )}
                        />
                        <p className="font-medium text-foreground">{stage.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {format(parseISO(stage.at), "dd MMM yyyy, HH:mm")}
                          {stage.detail ? ` · ${stage.detail}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </DetailSection>

              <DetailSection
                title="Session evidence"
                description="Attendance register and supporting files."
                icon={FileText}
              >
                {claim.evidence.length === 0 ? (
                  <EmptyHint>No register uploaded for this session.</EmptyHint>
                ) : (
                  <ul className="space-y-2">
                    {claim.evidence.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5 text-sm"
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
                            <ExternalLink className="mr-1.5 size-4" />
                            Open
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>

              {hasActions ? (
                <section className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                  <div>
                    <h3 className="text-sm font-semibold">Admin decision</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add an optional comment before recording your action.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-comment">Comment</Label>
                    <textarea
                      id="admin-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Required for reject or escalate…"
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {canApprove ? (
                      <Button
                        disabled={submitting}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => requestAction("APPROVE")}
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        Approve
                      </Button>
                    ) : null}
                    {canClarify ? (
                      <Button
                        disabled={submitting}
                        variant="outline"
                        onClick={() => requestAction("REQUEST_CLARIFICATION")}
                      >
                        <MessageSquare className="mr-2 size-4" />
                        Request clarification
                      </Button>
                    ) : null}
                    {canEscalate ? (
                      <Button
                        disabled={submitting}
                        variant="outline"
                        onClick={() => requestAction("ESCALATE")}
                      >
                        <AlertTriangle className="mr-2 size-4" />
                        Escalate dispute
                      </Button>
                    ) : null}
                    {canFreeze ? (
                      <Button
                        disabled={submitting}
                        variant="secondary"
                        onClick={() => requestAction("FREEZE")}
                      >
                        <Snowflake className="mr-2 size-4" />
                        Freeze submission
                      </Button>
                    ) : null}
                    {canReject ? (
                      <Button
                        disabled={submitting}
                        variant="destructive"
                        className="sm:col-span-2"
                        onClick={() => requestAction("REJECT")}
                      >
                        <XCircle className="mr-2 size-4" />
                        Reject
                      </Button>
                    ) : null}
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
        title="Confirm admin action"
        description="Enter your authenticator code to record this institutional approval decision."
        confirmLabel="Confirm action"
        submitting={submitting}
        onConfirm={runActionWithMfa}
      />
    </Sheet>
  );
}
