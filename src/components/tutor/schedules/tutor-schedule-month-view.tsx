import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "#/lib/utils";
import {
  dayKeyFromUiDate,
  indexUiEventsByDay,
  type TutorScheduleUiEvent,
} from "./tutor-schedule-types";

const WEEK_STARTS_ON = 1 as const;

function buildMonthCells(focusDate: Date): Date[] {
  const monthStart = startOfMonth(focusDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const monthEnd = endOfMonth(focusDate);
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const cells: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    cells.push(d);
    d = addDays(d, 1);
  }
  return cells;
}

type TutorScheduleMonthViewProps = {
  focusDate: Date;
  events: TutorScheduleUiEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export function TutorScheduleMonthView({
  focusDate,
  events,
  selectedDate,
  onSelectDate,
}: TutorScheduleMonthViewProps) {
  const byDay = indexUiEventsByDay(events);
  const cells = buildMonthCells(focusDate);
  const today = new Date();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 p-3 md:p-4">
      <h4 className="mb-3 text-center text-sm font-semibold tabular-nums text-foreground">
        {format(focusDate, "MMMM yyyy")}
      </h4>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1">
        {cells.map((day) => {
          const key = dayKeyFromUiDate(day);
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, focusDate);
          const selected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex min-h-[4.5rem] flex-col rounded-md border border-transparent p-1 text-left transition-colors hover:bg-muted/40",
                !inMonth && "opacity-40",
                selected && "border-(--lagoon-deep)/40 bg-(--lagoon-deep)/8 ring-1 ring-(--lagoon-deep)/25",
                isToday && !selected && "bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mb-0.5 text-xs font-semibold tabular-nums",
                  isToday && "text-(--lagoon-deep)",
                )}
              >
                {format(day, "d")}
              </span>
              {dayEvents.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayEvents.length > 2 ? (
                    <span className="rounded bg-(--lagoon-deep)/12 px-1 py-px text-[9px] font-medium tabular-nums text-(--lagoon-deep)">
                      {dayEvents.length} events
                    </span>
                  ) : (
                    dayEvents.map((ev) => (
                      <span
                        key={ev.id}
                        className="line-clamp-1 rounded bg-muted/60 px-1 py-px text-[9px] leading-tight text-foreground"
                        title={ev.title}
                      >
                        {ev.title}
                      </span>
                    ))
                  )}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
