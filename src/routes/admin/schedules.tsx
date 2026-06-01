import { createFileRoute } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { AdminSchedulesView } from "#/components/admin/schedules/admin-schedules-view";
import { useAdminSchedulesData } from "#/components/admin/schedules/use-admin-schedules-data";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { buildDtstartFromDateAndTime } from "#/lib/schedule-recurrence";
import { toast } from "#/lib/toast";
import { useSessionUser } from "#/lib/use-session-user";
import {
  adminArchiveScheduleSeriesFn,
  adminAssignTutorToModuleFn,
  adminCreateScheduleSeriesFn,
  adminDeleteScheduleSeriesFn,
  adminPublishScheduleSeriesFn,
  adminReviewScheduleChangeRequestFn,
  type AdminScheduleCalendarScope,
} from "#/server-actions/admin-schedules";

export const Route = createFileRoute("/admin/schedules")({
  component: AdminSchedulesPage,
});

function AdminSchedulesPage() {
  const { user, pending } = useSessionUser();

  const [view, setView] = useState<ScheduleCalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [academicTermId, setAcademicTermId] = useState<string | null>(null);
  const [scope, setScope] = useState<AdminScheduleCalendarScope>("institution");
  const [scopeEntityId, setScopeEntityId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const range = useMemo(() => rangeForView(view, focusDate), [view, focusDate]);
  const from = range.from.toISOString();
  const to = endOfDay(range.to).toISOString();
  const dataEnabled = !!user && (scope === "institution" || !!scopeEntityId);

  const {
    data,
    issues,
    isLoading,
    issuesLoading,
    error,
    invalidate,
  } = useAdminSchedulesData({
    enabled: dataEnabled,
    from,
    to,
    academicTermId,
    scope,
    scopeEntityId,
  });

  useEffect(() => {
    if (academicTermId === null && data?.currentTermId) {
      setAcademicTermId(data.currentTermId);
    }
  }, [data?.currentTermId, academicTermId]);

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
      await adminAssignTutorToModuleFn({
        data: {
          moduleId: values.moduleId,
          tutorId: values.tutorId,
          startDate: today,
        },
      });
      const dates = [...values.sessionDates].sort();
      await adminCreateScheduleSeriesFn({
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
          academicTermId,
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

  const handlePublishSeries = async (seriesId: string) => {
    setFormBusy(true);
    try {
      const { sessionCount, repairedOnly } = await adminPublishScheduleSeriesFn({
        data: { seriesId },
      });
      toast.success(
        repairedOnly
          ? sessionCount > 0
            ? `Created ${sessionCount} session record(s).`
            : "Session records are up to date."
          : `Published ${sessionCount} session(s).`,
      );
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
      await adminDeleteScheduleSeriesFn({ data: { seriesId } });
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
      const { cancelledSessionCount } = await adminArchiveScheduleSeriesFn({
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
      await adminReviewScheduleChangeRequestFn({ data: { requestId, decision } });
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

  if (pending || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminSchedulesView
      booting={dataEnabled ? isLoading : false}
      issuesLoading={dataEnabled ? issuesLoading : false}
      loadError={error instanceof Error ? error.message : null}
      view={view}
      focusDate={focusDate}
      data={dataEnabled ? data : null}
      issues={dataEnabled ? issues : []}
      academicTermId={academicTermId}
      scope={scope}
      scopeEntityId={scopeEntityId}
      onViewChange={setView}
      onFocusDateChange={setFocusDate}
      onAcademicTermChange={setAcademicTermId}
      onScopeChange={setScope}
      onScopeEntityChange={setScopeEntityId}
      onCreateSeries={handleCreateSeries}
      onPublishSeries={handlePublishSeries}
      onDeleteSeries={handleDeleteSeries}
      onArchiveSeries={handleArchiveSeries}
      onReviewChange={handleReviewChange}
      formBusy={formBusy}
      reviewBusyId={reviewBusyId}
      onReload={async () => {
        invalidate();
      }}
    />
  );
}
