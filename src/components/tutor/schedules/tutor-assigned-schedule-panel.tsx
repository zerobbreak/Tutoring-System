import { useNavigate } from "@tanstack/react-router";
import { addWeeks, endOfDay, format, startOfDay } from "date-fns";
import { CalendarClock, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
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
import { toast } from "#/lib/toast";
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

  return (
    <>
      <Card className="border-(--lagoon-deep)/20 bg-(--lagoon-deep)/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-5 text-(--lagoon-deep)" />
            Lecturer-assigned schedule
          </CardTitle>
          <CardDescription>
            Sessions published by your lecturer take priority over spreadsheet
            imports. Request reschedule changes here for lecturer approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming lecturer-assigned sessions in the next 8 weeks.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {ev.moduleCode} · {ev.title}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(ev.startsAt), "EEE d MMM")} ·{" "}
                      {ev.timeLabel}
                      {ev.venueLabel ? ` · ${ev.venueLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
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
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openChange(ev)}
                    >
                      Request change
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
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
    </>
  );
}
