import { useState } from "react";
import {
  ScheduleSessionManageDialog,
  type ScheduleSessionManageAction,
} from "#/components/lecturer/schedule/schedule-session-manage-dialog";
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
import { toast } from "#/lib/toast";
import { tutorCancelScheduledSessionFn } from "#/server-actions/scheduled-sessions";
import {
  submitTutorScheduleChangeRequestFn,
  type TutorAssignedScheduleEventDTO,
} from "#/server-actions/tutor-assigned-schedule";

export function useTutorScheduleOfficialActions(onReload: () => void | Promise<void>) {
  const [changeTarget, setChangeTarget] =
    useState<TutorAssignedScheduleEventDTO | null>(null);
  const [proposedStart, setProposedStart] = useState("");
  const [proposedEnd, setProposedEnd] = useState("");
  const [venue, setVenue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionManageAction, setSessionManageAction] =
    useState<ScheduleSessionManageAction | null>(null);
  const [sessionManageTarget, setSessionManageTarget] =
    useState<TutorAssignedScheduleEventDTO | null>(null);
  const [sessionActionBusy, setSessionActionBusy] = useState(false);

  const openChange = (ev: TutorAssignedScheduleEventDTO) => {
    setChangeTarget(ev);
    const pad = (n: number) => String(n).padStart(2, "0");
    const s = new Date(ev.startsAt);
    const e = new Date(ev.endsAt);
    setProposedStart(
      `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}T${pad(s.getHours())}:${pad(s.getMinutes())}`,
    );
    setProposedEnd(
      `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}`,
    );
    setVenue(ev.venueLabel ?? "");
    setReason("");
  };

  const submitChange = async () => {
    if (!changeTarget) return;
    setSubmitting(true);
    try {
      await submitTutorScheduleChangeRequestFn({
        data: {
          scheduledSessionId: changeTarget.id,
          proposedStartsAt: new Date(proposedStart).toISOString(),
          proposedEndsAt: new Date(proposedEnd).toISOString(),
          proposedVenueText: venue || null,
          reason: reason || undefined,
        },
      });
      toast.success("Change request sent to your lecturer.");
      setChangeTarget(null);
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openSessionManage = (
    ev: TutorAssignedScheduleEventDTO,
    action: ScheduleSessionManageAction,
  ) => {
    setSessionManageTarget(ev);
    setSessionManageAction(action);
  };

  const confirmSessionManage = async (params: {
    sessionId: string;
    reason: string;
  }) => {
    if (sessionManageAction !== "cancel") return;
    setSessionActionBusy(true);
    try {
      await tutorCancelScheduledSessionFn({ data: params });
      toast.success("Session cancelled.");
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      throw e;
    } finally {
      setSessionActionBusy(false);
    }
  };

  const dialogs = (
    <>
      <Dialog
        open={!!changeTarget}
        onOpenChange={(o) => !o && setChangeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request schedule change</DialogTitle>
            <DialogDescription>
              Your lecturer must approve before the session time is updated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Proposed start</Label>
              <Input
                type="datetime-local"
                value={proposedStart}
                onChange={(e) => setProposedStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Proposed end</Label>
              <Input
                type="datetime-local"
                value={proposedEnd}
                onChange={(e) => setProposedEnd(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Venue</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeTarget(null)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void submitChange()}>
              {submitting ? "Sending…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleSessionManageDialog
        open={sessionManageAction != null}
        onOpenChange={(open) => {
          if (!open) {
            setSessionManageAction(null);
            setSessionManageTarget(null);
          }
        }}
        action={sessionManageAction}
        session={
          sessionManageTarget
            ? {
                id: sessionManageTarget.id,
                moduleCode: sessionManageTarget.moduleCode,
                title: sessionManageTarget.title,
                startsAt: sessionManageTarget.startsAt,
                endsAt: sessionManageTarget.endsAt,
                status: sessionManageTarget.status,
                cancellationReason: sessionManageTarget.cancellationReason,
              }
            : null
        }
        role="tutor"
        busy={sessionActionBusy}
        onConfirm={confirmSessionManage}
      />
    </>
  );

  return { openChange, openSessionManage, dialogs };
}
