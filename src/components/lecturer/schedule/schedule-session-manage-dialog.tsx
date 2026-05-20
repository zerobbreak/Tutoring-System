import { format, parseISO } from "date-fns";
import { AlertTriangle, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { formatTimeRange } from "#/lib/schedule-display";
import {
  isCancelledSessionStatus,
  scheduledSessionStatusLabel,
} from "#/lib/schedule-session-status";

export type ScheduleSessionManageAction =
  | "cancel"
  | "delete"
  | "restore";

type SessionSummary = {
  id: string;
  moduleCode: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  cancellationReason?: string | null;
};

type ScheduleSessionManageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ScheduleSessionManageAction | null;
  session: SessionSummary | null;
  role: "admin" | "tutor";
  busy?: boolean;
  onConfirm: (params: { sessionId: string; reason: string }) => Promise<void>;
};

const COPY: Record<
  ScheduleSessionManageAction,
  { title: string; description: string; confirm: string; destructive?: boolean }
> = {
  cancel: {
    title: "Cancel session",
    description:
      "The session stays on the calendar with a Cancelled badge. It will not count toward hours or payroll.",
    confirm: "Cancel session",
    destructive: true,
  },
  delete: {
    title: "Delete session permanently",
    description:
      "This removes the session from the schedule entirely. Only use when the occurrence should no longer exist.",
    confirm: "Delete permanently",
    destructive: true,
  },
  restore: {
    title: "Restore cancelled session",
    description:
      "Reactivates this session as Scheduled. Tutors and students will see it as active again.",
    confirm: "Restore session",
  },
};

export function ScheduleSessionManageDialog({
  open,
  onOpenChange,
  action,
  session,
  role,
  busy,
  onConfirm,
}: ScheduleSessionManageDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, action, session?.id]);

  if (!action || !session) return null;

  const meta = COPY[action];
  const needsReason = action !== "restore";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "restore" ? (
              <RotateCcw className="size-5 text-(--lagoon-deep)" />
            ) : action === "delete" ? (
              <Trash2 className="size-5 text-destructive" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm">
          <p className="font-medium">
            {session.moduleCode} · {session.title}
          </p>
          <p className="mt-1 text-muted-foreground">
            {format(parseISO(session.startsAt), "EEE d MMM yyyy")} ·{" "}
            {formatTimeRange(session.startsAt, session.endsAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Status: {scheduledSessionStatusLabel(session.status)}
          </p>
          {isCancelledSessionStatus(session.status) &&
          session.cancellationReason ? (
            <p className="mt-2 flex gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {session.cancellationReason}
            </p>
          ) : null}
        </div>

        {needsReason ? (
          <div className="grid gap-2">
            <Label htmlFor="session-action-reason">
              Reason {role === "admin" ? "(required)" : "(required)"}
            </Label>
            <textarea
              id="session-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Tutor unavailable, venue closed, public holiday…"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant={meta.destructive ? "destructive" : "default"}
            disabled={busy || (needsReason && reason.trim().length < 3)}
            onClick={() =>
              void onConfirm({
                sessionId: session.id,
                reason: needsReason ? reason.trim() : "Restored by admin",
              }).then(() => onOpenChange(false))
            }
          >
            {busy ? "Working…" : meta.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
