import { useNavigate } from "@tanstack/react-router";
import { addWeeks, endOfDay, format, startOfDay } from "date-fns";
import { Ban, CalendarClock, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  ScheduleSessionManageDialog,
  type ScheduleSessionManageAction,
} from "#/components/lecturer/schedule/schedule-session-manage-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
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
import {
  isCancelledSessionStatus,
  scheduledSessionCardClass,
  scheduledSessionStatusLabel,
} from "#/lib/schedule-session-status";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { tutorCancelScheduledSessionFn } from "#/server-actions/scheduled-sessions";
import {
  listTutorAssignedScheduleFn,
  submitTutorScheduleChangeRequestFn,
  type TutorAssignedScheduleEventDTO,
} from "#/server-actions/tutor-assigned-schedule";

export function TutorAssignedSchedulePanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TutorAssignedScheduleEventDTO[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfDay(new Date());
      const to = endOfDay(addWeeks(from, 8));
      const { events: list } = await listTutorAssignedScheduleFn({
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      setEvents(list);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load assigned schedule",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      await load();
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
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      throw e;
    } finally {
      setSessionActionBusy(false);
    }
  };

  return (
    <>
      <Card className="border-(--lagoon-deep)/20 bg-(--lagoon-deep)/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-5 text-(--lagoon-deep)" />
            Lecturer-assigned schedule
          </CardTitle>
          <CardDescription>
            Sessions published by your lecturer. Cancelled sessions stay visible
            but do not count toward hours or pay. Request reschedule changes for
            active sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lecturer-assigned sessions in the next 8 weeks.
            </p>
          ) : (
            <ScrollArea className="max-h-[min(40vh,320px)] pr-3">
            <ul className="flex flex-col gap-2">
              {events.map((ev) => {
                const cancelled = isCancelledSessionStatus(ev.status);
                return (
                  <li
                    key={ev.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                      scheduledSessionCardClass(ev.status),
                    )}
                  >
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "font-medium",
                            cancelled && "line-through text-muted-foreground",
                          )}
                        >
                          {ev.moduleCode} · {ev.title}
                        </p>
                        <Badge
                          variant={cancelled ? "destructive" : "secondary"}
                          className="gap-1 text-[10px]"
                        >
                          {cancelled ? (
                            <Ban className="size-3" aria-hidden />
                          ) : null}
                          {scheduledSessionStatusLabel(ev.status)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {format(new Date(ev.startsAt), "EEE d MMM")} ·{" "}
                        {ev.timeLabel}
                        {ev.venueLabel ? ` · ${ev.venueLabel}` : ""}
                      </p>
                      {cancelled && ev.cancellationReason ? (
                        <p className="mt-1 text-xs text-destructive">
                          {ev.cancellationReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {ev.claimId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate({
                              to: "/tutor/sessions",
                              search: { claim: ev.claimId! },
                            })
                          }
                        >
                          Open session
                        </Button>
                      ) : null}
                      {!cancelled ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive hover:text-destructive"
                            onClick={() => openSessionManage(ev, "cancel")}
                          >
                            <Ban className="size-3.5" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openChange(ev)}
                          >
                            Request change
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!changeTarget} onOpenChange={(o) => !o && setChangeTarget(null)}>
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
}
