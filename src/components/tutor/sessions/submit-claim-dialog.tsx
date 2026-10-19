import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { invalidateSessionNotes } from "#/components/tutor/notes/session-notes-panel";
import {
  EMPTY_SHARED_NOTES,
  SessionSharedNotesFields,
  sharedNotesDirty,
  sharedNotesDraftFrom,
  type SharedNotesDraft,
} from "#/components/tutor/notes/session-shared-notes-fields";
import { Skeleton } from "#/components/ui/skeleton";
import { SigningAs } from "#/components/workflow/signing-as";
import { queryKeys } from "#/lib/query-keys";
import {
  getSessionNotesFn,
  updateSessionNotesFn,
} from "#/server-actions/tutor-notes";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";
import { isNoShowWithEvidence } from "#/lib/session-claim-lifecycle";
import { toast } from "#/lib/toast";
import { submitSessionClaimFn } from "#/server-actions/tutor-sessions";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

const MIN_NO_SHOW_REASON = 10;

export function SubmitClaimDialog({
  claim,
  open,
  onOpenChange,
  onSubmitted,
}: {
  claim: TutorSessionClaimDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [noShowReason, setNoShowReason] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [shared, setShared] = useState<SharedNotesDraft>(EMPTY_SHARED_NOTES);
  const [signatureReady, setSignatureReady] = useState(false);
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: queryKeys.tutor.sessionNotes(claim?.id ?? ""),
    queryFn: () => getSessionNotesFn({ data: { claimId: claim!.id } }),
    enabled: open && !!claim,
  });
  const savedShared = notesQuery.data
    ? sharedNotesDraftFrom(notesQuery.data)
    : EMPTY_SHARED_NOTES;
  const hasCovered = shared.topicsCovered.trim().length > 0;

  const noShow = claim
    ? isNoShowWithEvidence({
        attendancePresentCount: claim.attendance_present_count,
        evidenceCount: claim.evidenceCount,
      })
    : false;

  useEffect(() => {
    if (!open) {
      setNoShowReason("");
      setStepUpCode("");
    }
  }, [open]);

  useEffect(() => {
    if (open && notesQuery.data) setShared(sharedNotesDraftFrom(notesQuery.data));
  }, [open, notesQuery.data]);

  const handleSubmit = async () => {
    if (!claim || busy || stepUpCode.length < 6 || !hasCovered || !signatureReady) {
      return;
    }
    if (noShow && noShowReason.trim().length < MIN_NO_SHOW_REASON) {
      const proceed = window.confirm(
        "No students attended but you have not provided a reason (at least 10 characters). Submit anyway? The claim will be escalated for admin review.",
      );
      if (!proceed) return;
    }

    setBusy(true);
    try {
      if (sharedNotesDirty(shared, savedShared)) {
        await updateSessionNotesFn({ data: { claimId: claim.id, ...shared } });
        await invalidateSessionNotes(queryClient, claim.id);
      }
      const result = await submitSessionClaimFn({
        data: {
          claimId: claim.id,
          noShowReason: noShowReason.trim() || undefined,
          stepUpCode,
        },
      });
      if (result.escalated) {
        toast.message("Claim escalated", {
          description:
            "Submitted with zero attendance and no explanation. An admin will review it.",
        });
      } else {
        toast.success("Claim submitted for verification");
      }
      onOpenChange(false);
      await onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit claim</DialogTitle>
          <DialogDescription>
            Confirms this session took place and sends it to pending
            verification. Enter your authenticator code to sign off.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border border-border/70 p-3">
          <p className="text-xs text-muted-foreground">
            Session notes — shared with your lecturer. Describe the work, not individual students.
          </p>
          {notesQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <SessionSharedNotesFields
              idPrefix="submit-notes"
              value={shared}
              onChange={setShared}
              disabled={busy}
            />
          )}
        </div>

        {noShow ? (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
            <div className="flex gap-2 text-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Register evidence is on file but{" "}
                <strong>no students attended</strong>. Add a brief reason for
                the empty session, or the claim will be{" "}
                <strong>escalated</strong> for admin review.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="noShowReason">Why did no students attend?</Label>
              <textarea
                id="noShowReason"
                value={noShowReason}
                onChange={(e) => setNoShowReason(e.target.value)}
                placeholder="e.g. Public holiday, room empty, class cancelled by department…"
                rows={3}
                disabled={busy}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
              <p className="text-xs text-muted-foreground">
                At least {MIN_NO_SHOW_REASON} characters recommended to avoid
                escalation.
              </p>
            </div>
          </div>
        ) : null}

        {open ? <SigningAs onReadyChange={setSignatureReady} /> : null}

        <div className="space-y-2">
          <Label htmlFor="submit-claim-mfa-code">Authenticator code</Label>
          <Input
            id="submit-claim-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={stepUpCode}
            onChange={(e) => setStepUpCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
            placeholder="000000"
            className="font-mono tracking-widest"
            disabled={busy}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              busy || stepUpCode.length < 6 || !hasCovered || !signatureReady
            }
            onClick={() => void handleSubmit()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Sign and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
