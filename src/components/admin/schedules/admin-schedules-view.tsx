import { APP_PATHS } from "#/lib/app-paths";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isWithinInterval,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Plus,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ScheduleCalendarBody } from "#/components/lecturer/schedule/schedule-calendar-body";
import {
  ScheduleSessionManageDialog,
  type ScheduleSessionManageAction,
} from "#/components/lecturer/schedule/schedule-session-manage-dialog";
import { toast } from "#/lib/toast";
import {
  adminCancelScheduledSessionFn,
  adminDeleteScheduledSessionFn,
  adminRestoreScheduledSessionFn,
} from "#/server-actions/scheduled-sessions";
import type { ScheduleEventDTO } from "#/server-actions/lecturer-schedule";
import { ScheduleChangeRequestsPanel } from "#/components/lecturer/schedule/schedule-change-requests-panel";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import { ScheduleSeriesFormDialog } from "#/components/lecturer/schedule/schedule-series-form-dialog";
import {
  ScheduleDraftSeriesList,
  SchedulePublishedSeriesList,
} from "#/components/lecturer/schedule/schedule-series-lists";
import type { SeriesFormValues } from "#/components/lecturer/schedule/schedule-series-form-dialog";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { venueUnlockStatusLabel } from "#/lib/venue-access";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { cn } from "#/lib/utils";
import type {
  AdminScheduleCalendarScope,
  AdminSchedulePageDataDTO,
  SchedulingIssue,
} from "#/server-actions/admin-schedules";

const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100] max-h-60",
};

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

const ISSUE_LABELS: Record<SchedulingIssue["kind"], string> = {
  tutor_double_booking: "Double bookings",
  venue_conflict: "Venue conflicts",
  tutor_overload: "Tutor overload",
  allocation_exceeded: "Allocation exceeded",
  missing_schedule: "Missing schedules",
};

export type AdminSchedulesViewProps = {
  booting: boolean;
  issuesLoading: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  view: ScheduleCalendarView;
  focusDate: Date;
  data: AdminSchedulePageDataDTO | null;
  issues: SchedulingIssue[];
  academicTermId: string | null;
  scope: AdminScheduleCalendarScope;
  scopeEntityId: string | null;
  onViewChange: (view: ScheduleCalendarView) => void;
  onFocusDateChange: (date: Date) => void;
  onAcademicTermChange: (termId: string | null) => void;
  onScopeChange: (scope: AdminScheduleCalendarScope) => void;
  onScopeEntityChange: (entityId: string | null) => void;
  onCreateSeries: (values: SeriesFormValues) => Promise<void>;
  onPublishSeries: (seriesId: string) => Promise<void>;
  onDeleteSeries: (seriesId: string) => Promise<void>;
  onArchiveSeries: (seriesId: string) => Promise<void>;
  onReviewChange: (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
  ) => Promise<void>;
  formBusy: boolean;
  reviewBusyId: string | null;
  onReload: () => Promise<void>;
};

export function AdminSchedulesView({
  booting,
  issuesLoading,
  loadError,
  onRetryLoad,
  retryingLoad,
  view,
  focusDate,
  data,
  issues,
  academicTermId,
  scope,
  scopeEntityId,
  onViewChange,
  onFocusDateChange,
  onAcademicTermChange,
  onScopeChange,
  onScopeEntityChange,
  onCreateSeries,
  onPublishSeries,
  onDeleteSeries,
  onArchiveSeries,
  onReviewChange,
  formBusy,
  reviewBusyId,
  onReload,
}: AdminSchedulesViewProps) {
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sessionManageAction, setSessionManageAction] =
    useState<ScheduleSessionManageAction | null>(null);
  const [sessionManageTarget, setSessionManageTarget] =
    useState<ScheduleEventDTO | null>(null);
  const [sessionActionBusy, setSessionActionBusy] = useState(false);

  const openSessionManage = (
    event: ScheduleEventDTO,
    action: ScheduleSessionManageAction,
  ) => {
    setSessionManageTarget(event);
    setSessionManageAction(action);
  };

  const confirmSessionManage = async (params: {
    sessionId: string;
    reason: string;
  }) => {
    if (!sessionManageAction) return;
    setSessionActionBusy(true);
    try {
      if (sessionManageAction === "cancel") {
        await adminCancelScheduledSessionFn({ data: params });
        toast.success("Session cancelled.");
      } else if (sessionManageAction === "delete") {
        await adminDeleteScheduledSessionFn({ data: params });
        toast.success("Session deleted.");
        if (selectedEventId === params.sessionId) setSelectedEventId(null);
      } else {
        await adminRestoreScheduledSessionFn({
          data: { sessionId: params.sessionId },
        });
        toast.success("Session restored.");
      }
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      throw e;
    } finally {
      setSessionActionBusy(false);
    }
  };
  const [issueFilter, setIssueFilter] = useState<SchedulingIssue["kind"] | "all">(
    "all",
  );
  const [unlockOnly, setUnlockOnly] = useState(false);
  const issuesRef = useRef<HTMLDivElement>(null);

  const unlockStatusBySessionId = data?.unlockStatusBySessionId ?? {};

  const events = data?.events ?? [];
  const range = rangeForView(view, focusDate);

  const eventsInRange = useMemo(() => {
    return events.filter((e) => {
      const start = new Date(e.startsAt);
      if (!isWithinInterval(start, { start: range.from, end: range.to })) {
        return false;
      }
      if (!unlockOnly) return true;
      return unlockStatusBySessionId[e.id]?.requiresUnlock === true;
    });
  }, [events, range.from, range.to, unlockOnly, unlockStatusBySessionId]);

  const headerLabel = useMemo(() => {
    if (view === "month") return format(focusDate, "MMMM yyyy");
    if (view === "week") {
      const { from, to } = rangeForView("week", focusDate);
      return `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
    }
    if (view === "agenda") return "Next 30 days";
    return format(focusDate, "EEEE, d MMMM yyyy");
  }, [view, focusDate]);

  const issueCounts = useMemo(() => {
    const counts: Record<SchedulingIssue["kind"], number> = {
      tutor_double_booking: 0,
      venue_conflict: 0,
      tutor_overload: 0,
      allocation_exceeded: 0,
      missing_schedule: 0,
    };
    for (const issue of issues) counts[issue.kind]++;
    return counts;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (issueFilter === "all") return issues;
    return issues.filter((i) => i.kind === issueFilter);
  }, [issues, issueFilter]);

  const draftSeries = (data?.series ?? []).filter((s) => s.status === "DRAFT");
  const publishedSeries = (data?.series ?? []).filter(
    (s) => s.status === "PUBLISHED",
  );
  const seriesNeedingClaimSync = (data?.series ?? []).filter((s) =>
    (data?.seriesIdsNeedingClaimSync ?? []).includes(s.id),
  );

  const scopeEntities = useMemo(() => {
    if (!data) return [];
    if (scope === "module") return data.modules;
    if (scope === "tutor") return data.tutors;
    if (scope === "lecturer") return data.lecturers;
    return [];
  }, [data, scope]);

  const handleCreate = async (values: SeriesFormValues) => {
    await onCreateSeries(values);
    setSeriesOpen(false);
  };

  const scrollToIssues = () => {
    issuesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <header className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Calendar className="size-7 text-(--lagoon-deep)" />
              Schedules
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Institution scheduling: calendars, recurring series, tutor and venue
              allocation, and conflict detection.
            </p>
          </div>
          <Button onClick={() => setSeriesOpen(true)} className="shrink-0">
            <Plus className="mr-2 size-4" />
            New tutorial series
          </Button>
        </header>

        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Academic term</Label>
            <Select
              value={academicTermId ?? "__all__"}
              onValueChange={(v) =>
                onAcademicTermChange(v === "__all__" ? null : v)
              }
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="All terms" />
              </SelectTrigger>
              <SelectContent {...selectContentProps}>
                <SelectItem value="__all__">All terms</SelectItem>
                {(data?.academicTerms ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label} ({t.academicYear})
                    {t.isCurrent ? " · current" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Calendar view</Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                onScopeChange(v as AdminScheduleCalendarScope);
                onScopeEntityChange(null);
              }}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent {...selectContentProps}>
                <SelectItem value="institution">Institution</SelectItem>
                <SelectItem value="module">Module</SelectItem>
                <SelectItem value="tutor">Tutor</SelectItem>
                <SelectItem value="lecturer">Lecturer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope !== "institution" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">
                {scope === "module"
                  ? "Module"
                  : scope === "tutor"
                    ? "Tutor"
                    : "Lecturer"}
              </Label>
              <Select
                value={scopeEntityId ?? ""}
                onValueChange={(v) => onScopeEntityChange(v || null)}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  {scope === "module"
                    ? (scopeEntities as AdminSchedulePageDataDTO["modules"]).map(
                        (m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </SelectItem>
                        ),
                      )
                    : (
                        scopeEntities as {
                          id: string;
                          fullName: string;
                          email: string;
                        }[]
                      ).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.fullName}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {loadError ? (
          <QueryErrorBanner
            message={loadError}
            onRetry={onRetryLoad}
            retrying={retryingLoad}
          />
        ) : null}

        <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
          <div>
            <Label htmlFor="unlock-only" className="text-sm font-medium">
              Needs staff unlock only
            </Label>
            <p className="text-xs text-muted-foreground">
              Show computer rooms requiring facial-access unlock
            </p>
          </div>
          <Switch
            id="unlock-only"
            checked={unlockOnly}
            onCheckedChange={setUnlockOnly}
          />
        </div>

        <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            Object.keys(ISSUE_LABELS) as SchedulingIssue["kind"][]
          ).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setIssueFilter(kind);
                scrollToIssues();
              }}
              className={cn(
                "rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40",
                issueCounts[kind] > 0 && "border-amber-300/80",
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">
                {ISSUE_LABELS[kind]}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {issuesLoading ? "…" : issueCounts[kind]}
              </p>
            </button>
          ))}
        </div>

        {data ? (
          <ScheduleChangeRequestsPanel
            requests={data.pendingChangeRequests}
            busyId={reviewBusyId}
            onReview={onReviewChange}
          />
        ) : null}

        {seriesNeedingClaimSync.length > 0 ? (
          <Card className="shrink-0 border-dashed border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-sm font-medium">Session records needed</p>
              <p className="text-xs text-muted-foreground">
                These published series are on the calendar but are missing tutor
                session records. Create them to enable claims and attendance.
              </p>
              {seriesNeedingClaimSync.map((s) => (
                <article
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
                >
                  <span className="text-sm">
                    <span className="font-medium">{s.moduleCode}</span>
                    <span className="text-muted-foreground"> · {s.title} · </span>
                    {s.tutorName}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={formBusy}
                    onClick={() => void onPublishSeries(s.id)}
                  >
                    Create records
                  </Button>
                </article>
              ))}
            </CardContent>
          </Card>
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

        <Card className="shrink-0 overflow-hidden shadow-sm">
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
              manageRole="admin"
              onManageAction={openSessionManage}
              monitorHrefForClaim={(claimId) => ({
                to: APP_PATHS.admin.sessions,
                search: { claim: claimId },
              })}
            />
          </CardContent>
        </Card>

        <div ref={issuesRef} className="shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-600" />
              Schedule intelligence
            </h3>
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={issueFilter === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setIssueFilter("all")}
              >
                All ({issues.length})
              </Badge>
              {(
                Object.keys(ISSUE_LABELS) as SchedulingIssue["kind"][]
              ).map((kind) =>
                issueCounts[kind] > 0 ? (
                  <Badge
                    key={kind}
                    variant={issueFilter === kind ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setIssueFilter(kind)}
                  >
                    {ISSUE_LABELS[kind]}
                  </Badge>
                ) : null,
              )}
            </div>
          </div>
          {issuesLoading ? (
            <p className="text-sm text-muted-foreground">Analyzing schedule…</p>
          ) : filteredIssues.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No scheduling issues detected for this range.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredIssues.map((issue, idx) => (
                <li
                  key={`${issue.kind}-${idx}-${issue.message}`}
                  className="rounded-lg border bg-card px-3 py-2.5 text-sm"
                >
                  <Badge variant="outline" className="mb-1 text-[10px]">
                    {ISSUE_LABELS[issue.kind]}
                  </Badge>
                  <p>{issue.message}</p>
                </li>
              ))}
            </ul>
          )}
          {data ? (
            <p className="text-xs text-muted-foreground">
              Overload threshold: {data.maxTutorHoursPerWeek}h per tutor per week.
            </p>
          ) : null}
        </div>

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

        <ScheduleSessionManageDialog
          open={sessionManageAction != null}
          onOpenChange={(open) => {
            if (!open) {
              setSessionManageAction(null);
              setSessionManageTarget(null);
            }
          }}
          action={sessionManageAction}
          session={
            sessionManageTarget
              ? {
                  id: sessionManageTarget.id,
                  moduleCode: sessionManageTarget.moduleCode,
                  title: sessionManageTarget.title,
                  startsAt: sessionManageTarget.startsAt,
                  endsAt: sessionManageTarget.endsAt,
                  status: sessionManageTarget.status,
                  cancellationReason: sessionManageTarget.cancellationReason,
                }
              : null
          }
          role="admin"
          busy={sessionActionBusy}
          onConfirm={confirmSessionManage}
        />
      </div>
    </div>
  );
}
