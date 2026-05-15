import { addDays, format, isSameDay } from "date-fns";
import { rangeForView } from "./schedule-range";
import { dayKeyFromDate, indexEventsByDay, isToday } from "./schedule-calendar-utils";
import { ScheduleEventChip } from "./schedule-event-chip";
import type { ScheduleEventDTO } from "./types";
import { cn } from "#/lib/utils";

type ScheduleWeekGridProps = {
  focusDate: Date;
  events: ScheduleEventDTO[];
  selectedDate: Date;
  selectedEventId: string | null;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: ScheduleEventDTO) => void;
};

export function ScheduleWeekGrid({
  focusDate,
  events,
  selectedDate,
  selectedEventId,
  onSelectDate,
  onSelectEvent,
}: ScheduleWeekGridProps) {
  const { from } = rangeForView("week", focusDate);
  const byDay = indexEventsByDay(events);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  return (
    <section className="overflow-x-auto rounded-lg border border-border/60">
      <div className="grid min-h-[22rem] min-w-[42rem] grid-cols-7 gap-px bg-border/60">
      {days.map((day) => {
        const key = dayKeyFromDate(day);
        const dayEvents = byDay.get(key) ?? [];
        const selected = isSameDay(day, selectedDate);
        const today = isToday(day);

        return (
          <article
            key={key}
            className={cn(
              "flex min-w-0 flex-col bg-card",
              selected && "ring-2 ring-inset ring-(--lagoon-deep)/40",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex flex-col items-center gap-0.5 border-b border-border/50 px-1 py-2.5 transition-colors hover:bg-muted/30",
                today && "bg-(--lagoon-deep)/8",
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {format(day, "EEE")}
              </span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  today && "bg-(--lagoon-deep) text-primary-foreground",
                  selected && !today && "bg-muted text-foreground",
                )}
              >
                {format(day, "d")}
              </span>
            </button>
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-1.5">
              {dayEvents.length === 0 ? (
                <li className="py-4 text-center text-[10px] text-muted-foreground/80">
                  —
                </li>
              ) : (
                dayEvents.map((ev) => (
                  <li key={ev.id}>
                    <ScheduleEventChip
                      event={ev}
                      selected={selectedEventId === ev.id}
                      onSelect={onSelectEvent}
                    />
                  </li>
                ))
              )}
            </ul>
          </article>
        );
      })}
      </div>
    </section>
  );
}
