import { startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";
import { rangeForView } from "./schedule-range";
import { ScheduleAgendaList } from "./schedule-agenda-list";
import { ScheduleCalendarToolbar } from "./schedule-calendar-toolbar";
import { ScheduleDayDetail } from "./schedule-day-detail";
import { ScheduleMonthGrid } from "./schedule-month-grid";
import { ScheduleWeekGrid } from "./schedule-week-grid";
import type { ScheduleCalendarView, ScheduleEventDTO } from "./types";

type ScheduleCalendarBodyProps = {
  booting: boolean;
  view: ScheduleCalendarView;
  focusDate: Date;
  headerLabel: string;
  eventsInRange: ScheduleEventDTO[];
  selectedEventId: string | null;
  onViewChange: (view: ScheduleCalendarView) => void;
  onFocusDateChange: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectEvent: (event: ScheduleEventDTO) => void;
  onCreateSeries?: () => void;
};

export function ScheduleCalendarBody({
  booting,
  view,
  focusDate,
  headerLabel,
  eventsInRange,
  selectedEventId,
  onViewChange,
  onFocusDateChange,
  onPrev,
  onNext,
  onSelectEvent,
  onCreateSeries,
}: ScheduleCalendarBodyProps) {
  const range = rangeForView(view, focusDate);

  if (booting) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <ScheduleCalendarToolbar
        headerLabel={headerLabel}
        view={view}
        onViewChange={onViewChange}
        onPrev={onPrev}
        onNext={onNext}
        onToday={() => onFocusDateChange(startOfDay(new Date()))}
      />

      {view === "month" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px,300px)] lg:gap-6">
          <ScheduleMonthGrid
            focusDate={focusDate}
            events={eventsInRange}
            selectedDate={focusDate}
            selectedEventId={selectedEventId}
            onSelectDate={onFocusDateChange}
            onSelectEvent={onSelectEvent}
          />
          <ScheduleDayDetail
            variant="sidebar"
            date={focusDate}
            events={eventsInRange}
            selectedEventId={selectedEventId}
            onSelectEvent={onSelectEvent}
          />
        </div>
      ) : null}

      {view === "week" ? (
        <ScheduleWeekGrid
          focusDate={focusDate}
          events={eventsInRange}
          selectedDate={focusDate}
          selectedEventId={selectedEventId}
          onSelectDate={onFocusDateChange}
          onSelectEvent={onSelectEvent}
        />
      ) : null}

      {view === "day" ? (
        <ScheduleDayDetail
          variant="full"
          date={focusDate}
          events={eventsInRange}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          onCreateSeries={onCreateSeries}
        />
      ) : null}

      {view === "agenda" ? (
        <ScheduleAgendaList
          rangeStart={range.from}
          rangeEnd={range.to}
          events={eventsInRange}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          onCreateSeries={onCreateSeries}
        />
      ) : null}
    </>
  );
}
