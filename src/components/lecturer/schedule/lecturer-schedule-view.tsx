import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isWithinInterval,
  startOfDay,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { Calendar, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { dayHeadingLong } from "#/lib/schedule-display";
import { ScheduleCalendarBody } from "./schedule-calendar-body";
import { rangeForView } from "./schedule-range";
import { ScheduleChangeRequestsPanel } from "./schedule-change-requests-panel";
import {
  ScheduleDraftSeriesList,
  SchedulePublishedSeriesList,
} from "./schedule-series-lists";
import {
  ScheduleSeriesFormDialog,
  type SeriesFormValues,
} from "./schedule-series-form-dialog";
import type { LecturerScheduleViewProps, ScheduleCalendarView } from "./types";

function navigateFocus(
  view: ScheduleCalendarView,
  focusDate: Date,
  direction: -1 | 1,
): Date {
  if (view === "month") {
    return direction === 1 ? addMonths(focusDate, 1) : subMonths(focusDate, 1);
  }
  if (view === "week") {
    return direction === 1 ? addWeeks(focusDate, 1) : subWeeks(focusDate, 1);
  }
  if (view === "agenda") {
    return direction === 1 ? addDays(focusDate, 14) : subDays(focusDate, 14);
  }
  return direction === 1 ? addDays(focusDate, 1) : subDays(focusDate, 1);
}

export function LecturerScheduleView({
  booting,
  loadError,
  view,
  focusDate,
  data,
  onViewChange,
  onFocusDateChange,
  onCreateSeries,
  onPublishSeries,
  onDeleteSeries,
  onArchiveSeries,
  onReviewChange,
  formBusy,
  reviewBusyId,
}: LecturerScheduleViewProps) {
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const events = data?.events ?? [];
  const range = rangeForView(view, focusDate);

  const eventsInRange = useMemo(() => {
    return events.filter((e) => {
      const start = new Date(e.startsAt);
      return isWithinInterval(start, { start: range.from, end: range.to });
    });
  }, [events, range.from, range.to]);

  const headerLabel = useMemo(() => {
    if (view === "month") return format(focusDate, "MMMM yyyy");
    if (view === "week") {
      const { from, to } = rangeForView("week", focusDate);
      return `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
    }
    if (view === "agenda") return "Next 30 days";
    return dayHeadingLong(focusDate);
  }, [view, focusDate]);

  const handleCreate = async (values: SeriesFormValues) => {
    const dtstart = new Date(values.dtstartLocal).toISOString();
    await onCreateSeries({
      ...values,
      dtstart,
      until: values.until || null,
    });
    setSeriesOpen(false);
  };

  const draftSeries = (data?.series ?? []).filter((s) => s.status === "DRAFT");
  const publishedSeries = (data?.series ?? []).filter(
    (s) => s.status === "PUBLISHED",
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Calendar className="size-7 text-(--lagoon-deep)" />
            Schedule
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Create tutorial schedules, assign tutors and venues, and approve
            schedule change requests.
          </p>
        </div>
        <Button onClick={() => setSeriesOpen(true)} className="shrink-0">
          <Plus className="mr-2 size-4" />
          New tutorial series
        </Button>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {data ? (
        <ScheduleChangeRequestsPanel
          requests={data.pendingChangeRequests}
          busyId={reviewBusyId}
          onReview={onReviewChange}
        />
      ) : null}

      <ScheduleDraftSeriesList
        series={draftSeries}
        formBusy={formBusy}
        onPublish={(id) => void onPublishSeries(id)}
        onDelete={(id) => void onDeleteSeries(id)}
      />

      <SchedulePublishedSeriesList
        series={publishedSeries}
        formBusy={formBusy}
        onArchive={(id) => void onArchiveSeries(id)}
      />

      <Card className="overflow-hidden shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <ScheduleCalendarBody
            booting={booting}
            view={view}
            focusDate={focusDate}
            headerLabel={headerLabel}
            eventsInRange={eventsInRange}
            selectedEventId={selectedEventId}
            onViewChange={onViewChange}
            onFocusDateChange={onFocusDateChange}
            onPrev={() =>
              onFocusDateChange(navigateFocus(view, focusDate, -1))
            }
            onNext={() =>
              onFocusDateChange(navigateFocus(view, focusDate, 1))
            }
            onSelectEvent={(e) => setSelectedEventId(e.id)}
            onCreateSeries={() => setSeriesOpen(true)}
            showTutorLink
          />
        </CardContent>
      </Card>

      <ScheduleSeriesFormDialog
        open={seriesOpen}
        onOpenChange={setSeriesOpen}
        modules={data?.modules ?? []}
        tutors={data?.tutors ?? []}
        tutorIdsByModule={data?.tutorIdsByModule ?? {}}
        venues={data?.venues ?? []}
        busy={formBusy}
        onSubmit={handleCreate}
      />
    </div>
  );
}
