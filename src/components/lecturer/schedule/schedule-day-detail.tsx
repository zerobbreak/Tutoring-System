import { format } from "date-fns";
import { dayHeadingLong } from "#/lib/schedule-display";
import { dayKeyFromDate, indexEventsByDay } from "./schedule-calendar-utils";
import { ScheduleEmptyState } from "./schedule-empty-state";
import { ScheduleEventCard } from "./schedule-event-card";
import type { ScheduleEventDTO } from "./types";

type ScheduleDayDetailProps = {
  date: Date;
  events: ScheduleEventDTO[];
  selectedEventId: string | null;
  onSelectEvent: (event: ScheduleEventDTO) => void;
  onCreateSeries?: () => void;
  /** Sidebar title override */
  variant?: "sidebar" | "full";
};

export function ScheduleDayDetail({
  date,
  events,
  selectedEventId,
  onSelectEvent,
  onCreateSeries,
  variant = "full",
}: ScheduleDayDetailProps) {
  const key = dayKeyFromDate(date);
  const byDay = indexEventsByDay(events);
  const dayEvents = byDay.get(key) ?? [];

  if (variant === "sidebar") {
    return (
      <aside className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/15 p-4">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Selected day
          </p>
          <h4 className="mt-0.5 text-sm font-semibold text-foreground">
            {dayHeadingLong(date)}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {dayEvents.length === 0
              ? "No sessions"
              : `${dayEvents.length} session${dayEvents.length === 1 ? "" : "s"}`}
          </p>
        </header>
        {dayEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Click a day with sessions or create a new series.
          </p>
        ) : (
          <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
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
        )}
      </aside>
    );
  }

  return (
    <section className="space-y-4">
      <header className="border-b border-border/50 pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {format(date, "EEEE")}
        </p>
        <h4 className="text-lg font-semibold tracking-tight">
          {dayHeadingLong(date)}
        </h4>
      </header>
      {dayEvents.length === 0 ? (
        <ScheduleEmptyState onCreateSeries={onCreateSeries} />
      ) : (
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
      )}
    </section>
  );
}
