import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { LecturerScheduleView } from "#/components/lecturer/schedule/lecturer-schedule-view";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { toast } from "#/lib/toast";
import { buildDtstartFromDateAndTime } from "#/lib/schedule-recurrence";
import {
  archiveScheduleSeriesFn,
  assignTutorToModuleFn,
  createOneOffScheduleSeriesFn,
  createScheduleSeriesFn,
  deleteScheduleSeriesFn,
  getLecturerSchedulePageDataFn,
  publishScheduleSeriesFn,
  reviewScheduleChangeRequestFn,
  type LecturerSchedulePageDataDTO,
} from "#/server-actions/lecturer-schedule";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/lecturer/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<LecturerSchedulePageDataDTO | null>(null);
  const [view, setView] = useState<ScheduleCalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [formBusy, setFormBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const range = rangeForView(view, focusDate);
    setBooting(true);
    setLoadError(null);
    try {
      const result = await getLecturerSchedulePageDataFn({
        data: {
          from: range.from.toISOString(),
          to: endOfDay(range.to).toISOString(),
        },
      });
      setData(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load schedule",
      );
    } finally {
      setBooting(false);
    }
  }, [user, view, focusDate]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    void load();
  }, [user?.id, load]);

  const handleCreateSeries = async (values: {
    moduleId: string;
    title: string;
    tutorId: string;
    venueId: string | null;
    venueText: string;
    sessionDates: string[];
    sessionTime: string;
    durationMinutes: number;
  }) => {
    setFormBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dates = [...values.sessionDates].sort();
      await assignTutorToModuleFn({
        data: {
          moduleId: values.moduleId,
          tutorId: values.tutorId,
          startDate: today,
        },
      });
      await createScheduleSeriesFn({
        data: {
          moduleId: values.moduleId,
          title: values.title,
          tutorId: values.tutorId,
          venueId: values.venueId,
          venueText: values.venueText || null,
          dtstart: buildDtstartFromDateAndTime(dates[0], values.sessionTime),
          durationMinutes: values.durationMinutes,
          recurrence: {
            frequency: "explicit_dates",
            dates,
          },
        },
      });
      toast.success("Tutorial series saved as draft — publish when ready.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create series");
      throw e;
    } finally {
      setFormBusy(false);
    }
  };

  const handleCreateOneOff = async (values: {
    moduleId: string;
    title: string;
    tutorId: string;
    venueId: string | null;
    venueText: string;
    dtstartLocal: string;
    durationMinutes: number;
    sessionKind: string;
  }) => {
    setFormBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await assignTutorToModuleFn({
        data: {
          moduleId: values.moduleId,
          tutorId: values.tutorId,
          startDate: today,
        },
      });
      const { sessionCount } = await createOneOffScheduleSeriesFn({
        data: {
          moduleId: values.moduleId,
          title: values.title,
          tutorId: values.tutorId,
          venueId: values.venueId,
          venueText: values.venueText || null,
          dtstart: new Date(values.dtstartLocal).toISOString(),
          durationMinutes: values.durationMinutes,
          sessionKind: values.sessionKind,
        },
      });
      toast.success(`Published one-off session (${sessionCount} occurrence).`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session");
      throw e;
    } finally {
      setFormBusy(false);
    }
  };

  const handlePublishSeries = async (seriesId: string) => {
    setFormBusy(true);
    try {
      const { sessionCount } = await publishScheduleSeriesFn({
        data: { seriesId },
      });
      toast.success(`Published ${sessionCount} session(s).`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    setFormBusy(true);
    try {
      await deleteScheduleSeriesFn({ data: { seriesId } });
      toast.success("Draft series deleted.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setFormBusy(false);
    }
  };

  const handleArchiveSeries = async (seriesId: string) => {
    setFormBusy(true);
    try {
      const { cancelledSessionCount } = await archiveScheduleSeriesFn({
        data: { seriesId },
      });
      toast.success(
        cancelledSessionCount > 0
          ? `Series archived. ${cancelledSessionCount} upcoming session(s) cancelled.`
          : "Series archived.",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setFormBusy(false);
    }
  };

  const handleReviewChange = async (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    setReviewBusyId(requestId);
    try {
      await reviewScheduleChangeRequestFn({ data: { requestId, decision } });
      toast.success(
        decision === "APPROVED" ? "Change approved" : "Change rejected",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <LecturerScheduleView
      booting={booting}
      loadError={loadError}
      view={view}
      focusDate={focusDate}
      data={data}
      onViewChange={setView}
      onFocusDateChange={setFocusDate}
      onReload={load}
      onCreateSeries={handleCreateSeries}
      onCreateOneOff={handleCreateOneOff}
      onPublishSeries={handlePublishSeries}
      onDeleteSeries={handleDeleteSeries}
      onArchiveSeries={handleArchiveSeries}
      onReviewChange={handleReviewChange}
      formBusy={formBusy}
      reviewBusyId={reviewBusyId}
    />
  );
}
