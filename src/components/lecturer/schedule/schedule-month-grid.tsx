import { format, isSameDay } from "date-fns";
import {
  buildMonthGrid,
  indexEventsByDay,
  isToday,
  WEEKDAY_LABELS,
} from "./schedule-calendar-utils";
import { ScheduleEventChip } from "./schedule-event-chip";
import type { ScheduleEventDTO } from "./types";
import { cn } from "#/lib/utils";

const MAX_VISIBLE_EVENTS = 3;

type ScheduleMonthGridProps = {
  focusDate: Date;
  events: ScheduleEventDTO[];
  selectedDate: Date;
  selectedEventId: string | null;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: ScheduleEventDTO) => void;
};

export function ScheduleMonthGrid({
  focusDate,
  events,
  selectedDate,
  selectedEventId,
  onSelectDate,
  onSelectEvent,
}: ScheduleMonthGridProps) {
  const cells = buildMonthGrid(focusDate);
  const byDay = indexEventsByDay(events);

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border/60">
      <header className="grid grid-cols-7 border-b border-border/60 bg-muted/25">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </header>
      <div
        className="grid grid-cols-7"
        style={{ gridAutoRows: "minmax(5rem, 1fr)" }}
      >
        {cells.map((cell) => {
          const dayEvents = byDay.get(cell.key) ?? [];
          const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = dayEvents.length - visible.length;
          const selected = isSameDay(cell.date, selectedDate);
          const today = isToday(cell.date);

          return (
            <div
              key={cell.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(cell.date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDate(cell.date);
                }
              }}
              className={cn(
                "flex min-h-[5.5rem] cursor-pointer flex-col border-b border-r border-border/50 p-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--lagoon-deep)/40",
                !cell.inCurrentMonth && "bg-muted/15 text-muted-foreground/70",
                selected &&
                  "bg-(--lagoon-deep)/6 ring-1 ring-inset ring-(--lagoon-deep)/25",
                today && !selected && "bg-(--lagoon-deep)/4",
              )}
            >
              <span
                className={cn(
                  "mb-1 flex size-7 items-center justify-center self-end rounded-full text-xs font-medium tabular-nums",
                  today &&
                    "bg-(--lagoon-deep) text-primary-foreground shadow-sm",
                  selected && !today && "bg-foreground/10 text-foreground",
                )}
              >
                {format(cell.date, "d")}
              </span>
              <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {visible.map((ev) => (
                  <ScheduleEventChip
                    key={ev.id}
                    event={ev}
                    compact
                    selected={selectedEventId === ev.id}
                    onSelect={onSelectEvent}
                  />
                ))}
                {overflow > 0 ? (
                  <span className="px-1 text-[10px] font-medium text-(--lagoon-deep)">
                    +{overflow} more
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
