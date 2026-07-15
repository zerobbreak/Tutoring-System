import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { formatClock } from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import {
  createSessionClaimFn,
  listActiveVenuesFn,
  listTutorModuleAssignmentsFn,
  resubmitSessionRequestFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let minutes = 6 * 60; minutes <= 23 * 60 + 45; minutes += 15) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  }
  return slots;
})();

const START_TIME_SLOTS = TIME_SLOTS.slice(0, TIME_SLOTS.length - 1);

function getNextTimeSlot(slot: string) {
  return TIME_SLOTS.find((value) => value > slot) ?? TIME_SLOTS[TIME_SLOTS.length - 1];
}

function parseClockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isSameLocalDay(left: Date, right: Date) {
  return format(left, "yyyy-MM-dd") === format(right, "yyyy-MM-dd");
}

function getAvailableStartSlots(date: Date, now: Date) {
  if (!isSameLocalDay(date, now)) return START_TIME_SLOTS;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return START_TIME_SLOTS.filter((slot) => parseClockMinutes(slot) > currentMinutes);
}

export function TutorRequestSessionDialog({
  open,
  onOpenChange,
  resubmitClaim,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resubmitClaim: TutorSessionClaimDTO | null;
  onSaved: () => void | Promise<void>;
}) {
  const [modules, setModules] = useState<
    Awaited<ReturnType<typeof listTutorModuleAssignmentsFn>>
  >([]);
  const [venuesList, setVenuesList] = useState<
    Awaited<ReturnType<typeof listActiveVenuesFn>>
  >([]);
  const [moduleId, setModuleId] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [venue, setVenue] = useState("");
  const [sessionKind, setSessionKind] = useState("tutorial");
  const [requestReason, setRequestReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (resubmitClaim) {
      setModuleId(resubmitClaim.module_id);
      setDate(parseISO(`${resubmitClaim.session_date}T12:00:00`));
      setStart(formatClock(resubmitClaim.start_time) || "09:00");
      setEnd(formatClock(resubmitClaim.end_time) || "10:00");
      setVenue(resubmitClaim.venue ?? "");
      setSessionKind(resubmitClaim.session_kind ?? "tutorial");
      setRequestReason(resubmitClaim.request_reason ?? "");
    } else {
      setDate(new Date());
      setStart("09:00");
      setEnd("10:00");
      setVenue("");
      setSessionKind("tutorial");
      setRequestReason("");
    }
  }, [open, resubmitClaim]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const m = await listTutorModuleAssignmentsFn();
        setModules(m);
        if (!resubmitClaim) {
          setModuleId((prev) => prev || m[0]?.moduleId || "");
        }
      } catch {
        setModules([]);
      }
    })();
    void (async () => {
      try {
        const v = await listActiveVenuesFn();
        setVenuesList(v);
      } catch {
        setVenuesList([]);
      }
    })();
  }, [open, resubmitClaim]);

  const availableStartSlots = getAvailableStartSlots(date, now);
  const sameDayTimeBlocked =
    isSameLocalDay(date, now) &&
    parseClockMinutes(start) <= now.getHours() * 60 + now.getMinutes();
  const noFutureStartSlots = isSameLocalDay(date, now) && availableStartSlots.length === 0;
  const blockedRequestMessage = noFutureStartSlots
    ? "No future start times remain for today. Please choose another date."
    : sameDayTimeBlocked
      ? "This same-day start time has already passed."
      : null;
  const endSlots = TIME_SLOTS.filter((slot) => slot > start);

  useEffect(() => {
    if (!open) return;
    if (availableStartSlots.length === 0) return;
    if (availableStartSlots.includes(start)) return;

    const nextStart = availableStartSlots[0] ?? START_TIME_SLOTS[0];
    setStart(nextStart);
    setEnd((prev) =>
      TIME_SLOTS.indexOf(prev) > TIME_SLOTS.indexOf(nextStart)
        ? prev
        : getNextTimeSlot(nextStart),
    );
  }, [availableStartSlots, open, start]);

  useEffect(() => {
    if (!open) return;
    if (TIME_SLOTS.indexOf(end) > TIME_SLOTS.indexOf(start)) return;
    setEnd(getNextTimeSlot(start));
  }, [end, open, start]);

  const durationLabel = (() => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    const h = Math.round((mins / 60) * 10) / 10;
    return `${h}h`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {resubmitClaim ? "Update session request" : "Request session"}
          </DialogTitle>
          <DialogDescription>
            Your lecturer and admin will review this request. After approval it
            is added to the schedule and you can submit attendance for
            verification.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label>Module</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
            >
              {modules.map((m) => (
                <option key={m.moduleId} value={m.moduleId}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Session type</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={sessionKind}
              onChange={(e) => setSessionKind(e.target.value)}
            >
              <option value="tutorial">Tutorial</option>
              <option value="workshop">Workshop</option>
              <option value="one_off">One-off</option>
              <option value="consultation">Consultation</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              className="rounded-md border p-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="session-start">Start</Label>
              <select
                id="session-start"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={start}
                onChange={(e) => {
                  const selectedStart = e.target.value;
                  setStart(selectedStart);
                  if (TIME_SLOTS.indexOf(end) <= TIME_SLOTS.indexOf(selectedStart)) {
                    setEnd(getNextTimeSlot(selectedStart));
                  }
                }}
                disabled={noFutureStartSlots}
              >
                {availableStartSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="session-end">End</Label>
              <select
                id="session-end"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={noFutureStartSlots}
              >
                {endSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Duration: {durationLabel}
          </p>
          {blockedRequestMessage ? (
            <p className="text-xs font-medium text-destructive">
              {blockedRequestMessage}
            </p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="session-venue">Venue</Label>
            <select
              id="session-venue"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            >
              <option value="">Select a venue...</option>
              {venuesList.map((v) => {
                const val = v.name + (v.code ? ` (${v.code})` : "");
                return (
                  <option key={v.id} value={val}>
                    {v.name}
                    {v.code ? ` (${v.code})` : ""}
                  </option>
                );
              })}
              {venue &&
                !venuesList.some(
                  (v) =>
                    v.name + (v.code ? ` (${v.code})` : "") === venue,
                ) && <option value={venue}>{venue}</option>}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm dark:bg-input/30"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Why is this session needed? (min 10 characters)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              busy ||
              !moduleId ||
              requestReason.trim().length < 10 ||
              Boolean(blockedRequestMessage)
            }
            onClick={async () => {
              if (blockedRequestMessage) {
                toast.error(blockedRequestMessage);
                return;
              }

              setBusy(true);
              try {
                const payload = {
                  moduleId,
                  sessionDate: format(date, "yyyy-MM-dd"),
                  startTime: start,
                  endTime: end,
                  venue: venue || undefined,
                  sessionKind,
                  requestReason: requestReason.trim(),
                };
                if (resubmitClaim) {
                  await resubmitSessionRequestFn({
                    data: { claimId: resubmitClaim.id, ...payload },
                  });
                  toast.success("Session request updated");
                } else {
                  const result = await createSessionClaimFn({ data: payload });
                  if (result.budgetWarning) {
                    toast.warning(result.budgetWarning);
                  }
                  toast.success("Session request sent - awaiting admin approval");
                }
                onOpenChange(false);
                await onSaved();
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Could not save request",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {resubmitClaim ? "Resubmit request" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
