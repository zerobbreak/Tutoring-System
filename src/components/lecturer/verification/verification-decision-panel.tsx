import {
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { StepUpMfaDialog } from "#/components/workflow/step-up-mfa-dialog";
import { toast } from "#/lib/toast";
import {
  performVerificationActionFn,
  type VerificationActionKind,
} from "#/server-actions/lecturer-verification";

export function VerificationDecisionPanel({
  claimId,
  onActionComplete,
  onClose,
  onReloadClaim,
}: {
  claimId: string;
  onActionComplete: () => void;
  onClose: () => void;
  onReloadClaim: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<VerificationActionKind | null>(null);

  const requestAction = (action: VerificationActionKind) => {
    setPendingAction(action);
    setStepUpOpen(true);
  };

  const runActionWithMfa = async (stepUpCode: string) => {
    if (!pendingAction) return;
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
        await onReloadClaim();
        toast.info("You can add optional private feedback below.");
      } else {
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Your decision</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add an optional comment (required for reject or dispute). You will
          confirm with your authenticator app.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification-comment">Comment (optional)</Label>
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

      <StepUpMfaDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title="Confirm verification"
        description="Enter your authenticator code to record this verification decision."
        confirmLabel="Confirm decision"
        submitting={submitting}
        onConfirm={runActionWithMfa}
      />
    </>
  );
}
