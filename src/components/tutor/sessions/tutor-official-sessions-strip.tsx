import { Link, useNavigate } from "@tanstack/react-router";
import { addWeeks, endOfDay, format, startOfDay } from "date-fns";
import { CalendarClock, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { isCancelledSessionStatus } from "#/lib/schedule-session-status";
import { toast } from "#/lib/toast";
import {
  listTutorAssignedScheduleFn,
  type TutorAssignedScheduleEventDTO,
} from "#/server-actions/tutor-assigned-schedule";

const UPCOMING_LIMIT = 5;

export function TutorOfficialSessionsStrip() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TutorAssignedScheduleEventDTO[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfDay(new Date());
      const to = endOfDay(addWeeks(from, 4));
      const { events: list } = await listTutorAssignedScheduleFn({
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      const upcoming = list
        .filter(
          (ev) =>
            !isCancelledSessionStatus(ev.status) &&
            new Date(ev.startsAt) >= from,
        )
        .slice(0, UPCOMING_LIMIT);
      setEvents(upcoming);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load official schedule",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loading && events.length === 0) return null;

  return (
    <Card className="border-lagoon-deep/20 bg-lagoon/5 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-lagoon-deep" />
            Official schedule
          </CardTitle>
          <CardDescription className="text-xs">
            Published by your lecturer — open a slot to take attendance and
            submit your claim.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
          <Link to="/tutor/schedules">
            Full calendar
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading upcoming sessions…
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium leading-snug">
                    {ev.moduleCode} · {ev.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ev.startsAt), "EEE d MMM")} · {ev.timeLabel}
                    {ev.venueLabel ? ` · ${ev.venueLabel}` : ""}
                  </p>
                </div>
                {ev.claimId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void navigate({
                        to: "/tutor/sessions",
                        search: { claim: ev.claimId! },
                      })
                    }
                  >
                    Manage
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
