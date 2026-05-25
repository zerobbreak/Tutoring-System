import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { cn } from "#/lib/utils";
import { dayHeadingLong, formatTimeRange } from "#/lib/schedule-display";
import { TutorScheduleEventChip } from "./tutor-schedule-event-chip";
import {
  dayKeyFromUiDate,
  indexUiEventsByDay,
  type TutorScheduleFilterMode,
  type TutorScheduleUiEvent,
} from "./tutor-schedule-types";

const AGENDA_DAYS = 14;

type TutorScheduleAgendaViewProps = {
  focusDate: Date;
  events: TutorScheduleUiEvent[];
  selectedDate: Date;
  selectedEventId: string | null;
  filterMode: TutorScheduleFilterMode;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: TutorScheduleUiEvent) => void;
};

export function TutorScheduleAgendaView({
  focusDate,
  events,
  selectedDate,
  selectedEventId,
  filterMode,
  onSelectDate,
  onSelectEvent,
}: TutorScheduleAgendaViewProps) {
  const start = startOfDay(focusDate);
  const byDay = indexUiEventsByDay(events);
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(start, i));

  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/60">
      <ul className="divide-y divide-border/50">
        {days.map((day) => {
          const key = dayKeyFromUiDate(day);
          const dayEvents = byDay.get(key) ?? [];
          const selected = isSameDay(day, selectedDate);
          const today = isSameDay(day, new Date());

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 md:px-5",
                  selected && "bg-(--lagoon-deep)/6",
                )}
              >
                <div className="w-28 shrink-0">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      today && "text-(--lagoon-deep)",
                    )}
                  >
                    {format(day, "EEE d MMM")}
                  </p>
                  {today ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--lagoon-deep)">
                      Today
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {dayEvents.length === 0 ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {dayEvents.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1"
                        >
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatTimeRange(ev.start, ev.end)}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium">
                            {ev.moduleCode ? `${ev.moduleCode} · ` : ""}
                            {ev.title}
                          </span>
                          {ev.location ? (
                            <span className="text-xs text-muted-foreground">
                              {ev.location}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {dayEvents.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {dayEvents.length}
                  </span>
                ) : null}
              </button>
              {selected && dayEvents.length > 0 ? (
                <div className="border-t border-border/40 bg-muted/20 px-4 py-3 md:px-5">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {dayHeadingLong(day)}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {dayEvents.map((ev) => (
                      <li key={ev.id}>
                        <TutorScheduleEventChip
                          event={ev}
                          filterMode={filterMode}
                          selected={selectedEventId === ev.id}
                          onSelect={onSelectEvent}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
