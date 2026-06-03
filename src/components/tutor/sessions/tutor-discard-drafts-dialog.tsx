import { format, parseISO } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { toast } from "#/lib/toast";
import {
  deleteDraftSessionClaimFn,
  deleteDraftSessionClaimsFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

export function TutorDiscardDraftsDialog({
  open,
  onOpenChange,
  targetIds,
  confirmClaim,
  onDiscarded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetIds: string[];
  confirmClaim: TutorSessionClaimDTO | null;
  onDiscarded: (discardedIds: string[]) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {targetIds.length > 1
              ? `Discard ${targetIds.length} drafts?`
              : "Discard draft?"}
          </DialogTitle>
          <DialogDescription>
            {targetIds.length > 1 ? (
              "These sessions will be removed from your workspace and claims list. This cannot be undone."
            ) : confirmClaim ? (
              <>
                Confirm you want to discard the draft for{" "}
                <span className="font-medium text-foreground">
                  {confirmClaim.module?.code ?? "this module"}
                </span>{" "}
                on{" "}
                <span className="font-medium text-foreground">
                  {format(
                    parseISO(`${confirmClaim.session_date}T12:00:00`),
                    "d MMM yyyy",
                  )}
                </span>
                . It will be removed from your workspace and claims list and
                cannot be undone.
              </>
            ) : (
              "This removes the session from your workspace and claims list. It cannot be undone."
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || targetIds.length === 0}
            onClick={async () => {
              if (targetIds.length === 0) return;
              setBusy(true);
              try {
                if (targetIds.length === 1) {
                  await deleteDraftSessionClaimFn({
                    data: { claimId: targetIds[0]! },
                  });
                  toast.success("Draft discarded");
                } else {
                  const result = await deleteDraftSessionClaimsFn({
                    data: { claimIds: targetIds },
                  });
                  toast.success(`${result.deletedCount} drafts discarded`);
                }
                const discardedIds = [...targetIds];
                onOpenChange(false);
                await onDiscarded(discardedIds);
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Could not discard",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
