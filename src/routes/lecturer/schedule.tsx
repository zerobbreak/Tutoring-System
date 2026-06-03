import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { LecturerScheduleView } from "#/components/lecturer/schedule/lecturer-schedule-view";
import { useLecturerScheduleData } from "#/components/lecturer/schedule/use-lecturer-schedule-data";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { toast } from "#/lib/toast";
import { buildDtstartFromDateAndTime } from "#/lib/schedule-recurrence";
import {
  archiveScheduleSeriesFn,
  assignTutorToModuleFn,
  createOneOffScheduleSeriesFn,
  createScheduleSeriesFn,
  deleteScheduleSeriesFn,
  publishScheduleSeriesFn,
  reviewScheduleChangeRequestFn,
  reviewTutorSessionRequestFn,
} from "#/server-actions/lecturer-schedule";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/lecturer/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;

  const [view, setView] = useState<ScheduleCalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [formBusy, setFormBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const range = useMemo(() => rangeForView(view, focusDate), [view, focusDate]);
  const from = range.from.toISOString();
  const to = endOfDay(range.to).toISOString();

  const {
    data,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useLecturerScheduleData({
    enabled: !!user,
    from,
    to,
  });
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

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
      invalidate();
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
      invalidate();
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
      invalidate();
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
      invalidate();
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
      invalidate();
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
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleReviewTutorSessionRequest = async (
    claimId: string,
    decision: "REJECTED" | "CHANGES_REQUESTED",
    feedback?: string,
  ) => {
    setReviewBusyId(claimId);
    try {
      await reviewTutorSessionRequestFn({
        data: { claimId, decision, feedback },
      });
      toast.success(
        decision === "REJECTED"
          ? "Session request rejected"
          : "Feedback sent to tutor",
      );
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewBusyId(null);
    }
  };

  return (
    <QueryPageGate
      sessionPending={!user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading schedule…"
    >
    <LecturerScheduleView
      booting={isLoading}
      {...feedback}
      view={view}
      focusDate={focusDate}
      data={data}
      onViewChange={setView}
      onFocusDateChange={setFocusDate}
      onReload={() => {
        invalidate();
      }}
      onCreateSeries={handleCreateSeries}
      onCreateOneOff={handleCreateOneOff}
      onPublishSeries={handlePublishSeries}
      onDeleteSeries={handleDeleteSeries}
      onArchiveSeries={handleArchiveSeries}
      onReviewChange={handleReviewChange}
      onReviewTutorSessionRequest={handleReviewTutorSessionRequest}
      formBusy={formBusy}
      reviewBusyId={reviewBusyId}
    />
    </QueryPageGate>
  );
}
