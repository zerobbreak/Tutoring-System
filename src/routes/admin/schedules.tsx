import { createFileRoute } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { AdminSchedulesView } from "#/components/admin/schedules/admin-schedules-view";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { toast } from "#/lib/toast";
import { useSessionUser } from "#/lib/use-session-user";
import {
  adminAssignTutorToModuleFn,
  adminCreateScheduleSeriesFn,
  adminPublishScheduleSeriesFn,
  adminReviewScheduleChangeRequestFn,
  detectSchedulingIssuesFn,
  getAdminSchedulePageDataFn,
  type AdminScheduleCalendarScope,
  type AdminSchedulePageDataDTO,
  type SchedulingIssue,
} from "#/server-actions/admin-schedules";

export const Route = createFileRoute("/admin/schedules")({
  component: AdminSchedulesPage,
});

function AdminSchedulesPage() {
  const { user, pending } = useSessionUser();

  const [booting, setBooting] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<AdminSchedulePageDataDTO | null>(null);
  const [issues, setIssues] = useState<SchedulingIssue[]>([]);
  const [view, setView] = useState<ScheduleCalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [academicTermId, setAcademicTermId] = useState<string | null>(null);
  const [scope, setScope] = useState<AdminScheduleCalendarScope>("institution");
  const [scopeEntityId, setScopeEntityId] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    const range = rangeForView(view, focusDate);
    const from = range.from.toISOString();
    const to = endOfDay(range.to).toISOString();

    setBooting(true);
    setLoadError(null);
    try {
      const result = await getAdminSchedulePageDataFn({
        data: {
          from,
          to,
          academicTermId,
          scope,
          scopeEntityId,
        },
      });
      setData(result);
      if (academicTermId === null && result.currentTermId) {
        setAcademicTermId(result.currentTermId);
      }
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load schedules",
      );
    } finally {
      setBooting(false);
    }
  }, [
    user,
    view,
    focusDate,
    academicTermId,
    scope,
    scopeEntityId,
  ]);

  const loadIssues = useCallback(async () => {
    if (!user) return;
    const range = rangeForView(view, focusDate);
    setIssuesLoading(true);
    try {
      const result = await detectSchedulingIssuesFn({
        data: {
          from: range.from.toISOString(),
          to: endOfDay(range.to).toISOString(),
          academicTermId,
          scope,
          scopeEntityId,
        },
      });
      setIssues(result.issues);
    } catch {
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, [user, view, focusDate, academicTermId, scope, scopeEntityId]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    if (scope !== "institution" && !scopeEntityId) {
      setData(null);
      setIssues([]);
      setBooting(false);
      return;
    }
    void load();
  }, [user?.id, load, scope, scopeEntityId]);

  useEffect(() => {
    if (!user) return;
    if (scope !== "institution" && !scopeEntityId) return;
    void loadIssues();
  }, [user?.id, loadIssues, scope, scopeEntityId]);

  const handleCreateSeries = async (values: {
    moduleId: string;
    title: string;
    tutorId: string;
    venueId: string | null;
    venueText: string;
    dtstart: string;
    durationMinutes: number;
    byWeekday: number[];
    until: string | null;
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
      await adminCreateScheduleSeriesFn({
        data: {
          moduleId: values.moduleId,
          title: values.title,
          tutorId: values.tutorId,
          venueId: values.venueId,
          venueText: values.venueText || null,
          dtstart: values.dtstart,
          durationMinutes: values.durationMinutes,
          recurrence: {
            frequency: "weekly",
            byWeekday: values.byWeekday,
            until: values.until,
          },
          academicTermId,
        },
      });
      toast.success("Tutorial series saved as draft — publish when ready.");
      await load();
      await loadIssues();
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
      await load();
      await loadIssues();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
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
      await load();
      await loadIssues();
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
      booting={booting}
      issuesLoading={issuesLoading}
      loadError={loadError}
      view={view}
      focusDate={focusDate}
      data={data}
      issues={issues}
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
      onReviewChange={handleReviewChange}
      formBusy={formBusy}
      reviewBusyId={reviewBusyId}
    />
  );
}
