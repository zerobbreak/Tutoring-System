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
  PenLine,
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
import { WorkflowMessageButton } from "#/components/messaging/workflow-message-button";
import { formatClaimStatus } from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
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
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);

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
      setSignatureConfirmed(false);
      void loadClaim();
    } else {
      setClaim(null);
    }
  }, [open, claimId, loadClaim]);

  const runAction = async (action: VerificationActionKind) => {
    if (!claimId) return;
    setSubmitting(true);
    try {
      await performVerificationActionFn({
        data: {
          claimId,
          action,
          comment: comment.trim() || undefined,
          signatureConfirmed:
            action === "SIGN_AND_APPROVE" ? signatureConfirmed : undefined,
        },
      });
      toast.success("Verification action recorded.");
      onActionComplete();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const canAct =
    claim &&
    ["PENDING_VERIFICATION", "DISPUTED"].includes(claim.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Verify session claim</SheetTitle>
          <SheetDescription>
            Review attendance evidence, compare schedule data, and record your
            decision.
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
              <Badge>{formatClaimStatus(claim.status)}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <WorkflowMessageButton kind="claim" claimId={claim.id} />
              <WorkflowMessageButton kind="session" claimId={claim.id} />
              {claim.open_dispute ? (
                <WorkflowMessageButton
                  kind="dispute"
                  disputeId={claim.open_dispute.id}
                />
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Hours</dt>
                <dd className="font-medium">{claim.hours}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Attendance</dt>
                <dd className="font-medium">
                  {claim.attendance_present_count != null
                    ? `${claim.attendance_present_count} present`
                    : `${claim.attendance_scan_count} scans`}
                  {claim.attendance_expected_count != null
                    ? ` / ${claim.attendance_expected_count} expected`
                    : ""}
                </dd>
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
              {claim.submitted_at ? (
                <div className="col-span-2 text-xs text-muted-foreground">
                  Submitted{" "}
                  {formatDistanceToNow(parseISO(claim.submitted_at), {
                    addSuffix: true,
                  })}
                </div>
              ) : null}
            </dl>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="size-4" />
                Schedule vs attendance
              </h3>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claimed slot</span>
                  <span>
                    {claim.schedule_comparison.claim_date} ·{" "}
                    {claim.schedule_comparison.claim_start?.slice(0, 5)}–
                    {claim.schedule_comparison.claim_end?.slice(0, 5)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From timetable</span>
                  <span>
                    {claim.schedule_comparison.linked_from_schedule
                      ? "Linked import"
                      : "Manual entry"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QR scans</span>
                  <span>{claim.schedule_comparison.attendance_scan_count}</span>
                </div>
                {claim.schedule_comparison.headcount_matches_scans ===
                false ? (
                  <p className="flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="size-3.5" />
                    Headcount does not match scan count
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" />
                Attendance evidence
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

            {claim.open_dispute ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Open dispute</p>
                <p className="mt-1 text-muted-foreground">
                  {claim.open_dispute.reason}
                </p>
              </div>
            ) : null}

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <History className="size-4" />
                Verification timeline
              </h3>
              {claim.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No verification actions yet.
                </p>
              ) : (
                <ol className="space-y-3 border-l-2 border-border pl-4">
                  {claim.timeline.map((item) => (
                    <li key={item.id} className="relative text-sm">
                      <span className="absolute -left-[1.3rem] top-1 size-2 rounded-full bg-primary" />
                      <p className="font-medium">
                        {item.action_type.replace(/_/g, " ")}
                        {item.digitally_signed ? " (signed)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.actor?.full_name ?? "System"} ·{" "}
                        {format(
                          parseISO(item.acted_at),
                          "dd MMM yyyy, HH:mm",
                        )}
                      </p>
                      {item.comment ? (
                        <p className="mt-1 text-muted-foreground">
                          {item.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {canAct ? (
              <section className="space-y-4 border-t pt-4">
                <Label htmlFor="verification-comment">Comment (optional)</Label>
                <textarea
                  id="verification-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Required for reject or dispute…"
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />

                <div className="flex items-start gap-2">
                  <input
                    id="digital-sign"
                    type="checkbox"
                    checked={signatureConfirmed}
                    onChange={(e) => setSignatureConfirmed(e.target.checked)}
                    className="mt-1 size-4 rounded border-input"
                  />
                  <Label
                    htmlFor="digital-sign"
                    className="text-sm leading-snug font-normal"
                  >
                    I digitally sign this verification — session hours and
                    attendance are authentic to the best of my knowledge.
                  </Label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void runAction("APPROVE")}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Approve
                  </Button>
                  <Button
                    disabled={submitting || !signatureConfirmed}
                    variant="default"
                    onClick={() => void runAction("SIGN_AND_APPROVE")}
                  >
                    <PenLine className="mr-2 size-4" />
                    Sign & approve
                  </Button>
                  <Button
                    disabled={submitting}
                    variant="outline"
                    onClick={() => void runAction("REQUEST_CLARIFICATION")}
                  >
                    <MessageSquare className="mr-2 size-4" />
                    Request clarification
                  </Button>
                  <Button
                    disabled={submitting}
                    variant="outline"
                    onClick={() => void runAction("DISPUTE")}
                  >
                    <AlertTriangle className="mr-2 size-4" />
                    Dispute
                  </Button>
                  <Button
                    disabled={submitting}
                    variant="destructive"
                    className="sm:col-span-2"
                    onClick={() => void runAction("REJECT")}
                  >
                    <XCircle className="mr-2 size-4" />
                    Reject submission
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
