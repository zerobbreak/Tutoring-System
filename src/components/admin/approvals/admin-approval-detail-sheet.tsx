import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  MessageSquare,
  Snowflake,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { formatClaimStatus } from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
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

  const runAction = async (action: AdminApprovalActionKind) => {
    if (!claimId) return;
    setSubmitting(true);
    try {
      await performAdminApprovalActionFn({
        data: {
          claimId,
          action,
          comment: comment.trim() || undefined,
        },
      });
      toast.success("Action recorded.");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Institutional verification</SheetTitle>
          <SheetDescription>
            Review lecturer-verified claims and record admin decisions.
          </SheetDescription>
        </SheetHeader>

        {loading || !claim ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6 pb-8">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">
                  {claim.tutor?.full_name ?? "Tutor"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {claim.module?.code} — {claim.module?.name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge>{formatClaimStatus(claim.status)}</Badge>
                {claim.lecturer_verified ? (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
                    Lecturer verified
                  </Badge>
                ) : null}
              </div>
            </div>

            {frozen ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                <Snowflake className="mr-1 inline size-4" />
                This claim is frozen. No status changes until an admin clears the
                freeze (not available in v1).
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Hours</dt>
                <dd className="font-medium">{claim.hours}</dd>
              </div>
              <div className="col-span-2">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Session
                </dt>
                <dd className="font-medium">
                  {format(parseISO(claim.session_date), "EEE, d MMM yyyy")} ·{" "}
                  {claim.start_time?.slice(0, 5)}–{claim.end_time?.slice(0, 5)}
                </dd>
              </div>
              {claim.venue ? (
                <div className="col-span-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" />
                    Venue
                  </dt>
                  <dd className="font-medium">{claim.venue}</dd>
                </div>
              ) : null}
            </dl>

            {claim.open_dispute ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Open dispute</p>
                <p className="mt-1 text-muted-foreground">{claim.open_dispute.reason}</p>
              </div>
            ) : null}

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <History className="size-4" />
                Institutional verification timeline
              </h3>
              <ol className="space-y-3 border-l-2 border-border pl-4">
                {claim.workflow_stages.map((stage) => (
                  <li key={stage.id} className="relative text-sm">
                    <span className="absolute -left-[1.3rem] top-1 size-2 rounded-full bg-primary" />
                    <p className="font-medium">{stage.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(stage.at), "dd MMM yyyy, HH:mm")}
                      {stage.detail ? ` · ${stage.detail}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" />
                Session evidence
              </h3>
              {claim.evidence.length === 0 ? (
                <p className="text-sm text-amber-700">No register uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {claim.evidence.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="truncate">{ev.file_name}</span>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={ev.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 size-4" />
                          Open
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(canApprove ||
              canReject ||
              canClarify ||
              canEscalate ||
              canFreeze) && (
              <section className="space-y-4 border-t pt-4">
                <Label htmlFor="admin-comment">Comment</Label>
                <textarea
                  id="admin-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Required for reject or escalate…"
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  {canApprove ? (
                    <Button
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void runAction("APPROVE")}
                    >
                      <CheckCircle2 className="mr-2 size-4" />
                      Approve
                    </Button>
                  ) : null}
                  {canClarify ? (
                    <Button
                      disabled={submitting}
                      variant="outline"
                      onClick={() => void runAction("REQUEST_CLARIFICATION")}
                    >
                      <MessageSquare className="mr-2 size-4" />
                      Request clarification
                    </Button>
                  ) : null}
                  {canEscalate ? (
                    <Button
                      disabled={submitting}
                      variant="outline"
                      onClick={() => void runAction("ESCALATE")}
                    >
                      <AlertTriangle className="mr-2 size-4" />
                      Escalate dispute
                    </Button>
                  ) : null}
                  {canFreeze ? (
                    <Button
                      disabled={submitting}
                      variant="secondary"
                      onClick={() => void runAction("FREEZE")}
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
                      onClick={() => void runAction("REJECT")}
                    >
                      <XCircle className="mr-2 size-4" />
                      Reject
                    </Button>
                  ) : null}
                </div>
              </section>
            )}

            {claim.submitted_at ? (
              <p className="text-xs text-muted-foreground">
                Submitted{" "}
                {formatDistanceToNow(parseISO(claim.submitted_at), {
                  addSuffix: true,
                })}
              </p>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
