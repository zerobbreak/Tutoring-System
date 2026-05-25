import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { cn } from "#/lib/utils";
import { TutorScheduleEventChip } from "./tutor-schedule-event-chip";
import {
  dayKeyFromUiDate,
  indexUiEventsByDay,
  type TutorScheduleFilterMode,
  type TutorScheduleUiEvent,
} from "./tutor-schedule-types";

const WEEK_STARTS_ON = 1 as const;

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

type TutorScheduleWeekViewProps = {
  focusDate: Date;
  events: TutorScheduleUiEvent[];
  selectedDate: Date;
  selectedEventId: string | null;
  filterMode: TutorScheduleFilterMode;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: TutorScheduleUiEvent) => void;
};

export function TutorScheduleWeekView({
  focusDate,
  events,
  selectedDate,
  selectedEventId,
  filterMode,
  onSelectDate,
  onSelectEvent,
}: TutorScheduleWeekViewProps) {
  const from = startOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON });
  const byDay = indexUiEventsByDay(events);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full min-h-[22rem] min-w-[42rem] grid-cols-7 gap-px bg-border/60">
          {days.map((day) => {
            const key = dayKeyFromUiDate(day);
            const dayEvents = byDay.get(key) ?? [];
            const selected = isSameDay(day, selectedDate);
            const today = isToday(day);

            return (
              <article
                key={key}
                className={cn(
                  "flex min-h-0 min-w-0 flex-col bg-card",
                  selected && "ring-2 ring-inset ring-(--lagoon-deep)/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    "flex shrink-0 flex-col items-center gap-0.5 border-b border-border/50 px-1 py-2.5 transition-colors hover:bg-muted/30",
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
                <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
                  {dayEvents.length === 0 ? (
                    <li className="py-4 text-center text-[10px] text-muted-foreground/80">
                      —
                    </li>
                  ) : (
                    dayEvents.map((ev) => (
                      <li key={ev.id}>
                        <TutorScheduleEventChip
                          event={ev}
                          filterMode={filterMode}
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
      </div>
    </section>
  );
}
