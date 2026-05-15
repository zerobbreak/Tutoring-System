import { addDays, startOfDay } from "date-fns";
import { dayHeadingLong } from "#/lib/schedule-display";
import { dayKeyFromDate, indexEventsByDay } from "./schedule-calendar-utils";
import { ScheduleEmptyState } from "./schedule-empty-state";
import { ScheduleEventCard } from "./schedule-event-card";
import type { ScheduleEventDTO } from "./types";
import { cn } from "#/lib/utils";

type ScheduleAgendaListProps = {
  rangeStart: Date;
  rangeEnd: Date;
  events: ScheduleEventDTO[];
  selectedEventId: string | null;
  onSelectEvent: (event: ScheduleEventDTO) => void;
  onCreateSeries?: () => void;
};

export function ScheduleAgendaList({
  rangeStart,
  rangeEnd,
  events,
  selectedEventId,
  onSelectEvent,
  onCreateSeries,
}: ScheduleAgendaListProps) {
  const byDay = indexEventsByDay(events);
  const days: Date[] = [];
  let cursor = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const daysWithEvents = days.filter((d) => (byDay.get(dayKeyFromDate(d))?.length ?? 0) > 0);

  if (!daysWithEvents.length) {
    return <ScheduleEmptyState onCreateSeries={onCreateSeries} />;
  }

  return (
    <ol className="relative space-y-8 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-border/80">
      {daysWithEvents.map((day) => {
        const key = dayKeyFromDate(day);
        const dayEvents = byDay.get(key) ?? [];
        return (
          <li key={key} className="relative pl-8">
            <span
              className={cn(
                "absolute left-0 top-1.5 size-[15px] rounded-full border-2 border-background bg-(--lagoon-deep) shadow-sm",
              )}
              aria-hidden
            />
            <header className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">
                {dayHeadingLong(day)}
              </h4>
              <p className="text-xs text-muted-foreground">
                {dayEvents.length} session{dayEvents.length === 1 ? "" : "s"}
              </p>
            </header>
            <ul className="flex flex-col gap-2">
              {dayEvents.map((ev) => (
                <li key={ev.id}>
                  <ScheduleEventCard
                    event={ev}
                    selected={selectedEventId === ev.id}
                    onSelect={onSelectEvent}
                  />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
