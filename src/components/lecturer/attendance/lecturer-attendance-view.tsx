import type { NavigateOptions } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Loader2,
  Radio,
  ScanLine,
  ShieldAlert,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLecturerAttendanceData } from "#/components/lecturer/attendance/use-lecturer-attendance-data";
import {
  PageLoadingSpinner,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { AttendanceAlertsPanel } from "#/components/lecturer/dashboard/attendance-alerts-panel";
import { LecturerSessionDetailSheet } from "#/components/lecturer/sessions/lecturer-session-detail-sheet";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { formatClock } from "#/lib/session-claim-display";
import {
  getLiveAttendanceSnapshotFn,
  type LecturerAttendanceDashboardDTO,
} from "#/server-actions/lecturer-attendance";
import { AttendanceKpiCards } from "./attendance-kpi-cards";
import { AttendanceTrendChart } from "./attendance-trend-chart";

const LIVE_POLL_MS = 30_000;

export type LecturerAttendanceSearch = {
  claim?: string;
};

type LecturerAttendanceViewProps = {
  search: LecturerAttendanceSearch;
  navigate: (opts: NavigateOptions) => void | Promise<void>;
};

export function LecturerAttendanceView({
  search,
  navigate,
}: LecturerAttendanceViewProps) {
  const { data, isLoading, isFetching, error, refetch, isSuccess, invalidate } =
    useLecturerAttendanceData();
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });
  const booting = isLoading;
  const [liveSessions, setLiveSessions] = useState<
    LecturerAttendanceDashboardDTO["liveSessions"]
  >([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (data?.liveSessions) {
      setLiveSessions(data.liveSessions);
    }
  }, [data?.liveSessions]);

  useEffect(() => {
    if (search.claim) {
      setSelectedClaimId(search.claim);
      setSheetOpen(true);
    }
  }, [search.claim]);

  useEffect(() => {
    const poll = async () => {
      try {
        const snapshot = await getLiveAttendanceSnapshotFn();
        setLiveSessions(snapshot);
      } catch {
        /* ignore poll errors */
      }
    };
    const id = setInterval(() => void poll(), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const openSession = (claimId: string) => {
    setSelectedClaimId(claimId);
    setSheetOpen(true);
    void navigate({
      to: APP_PATHS.lecturer.attendance,
      search: { claim: claimId },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      setSheetOpen(false);
      setSelectedClaimId(null);
      void navigate({
        to: APP_PATHS.lecturer.attendance,
        search: { claim: undefined },
        replace: true,
      });
    } else {
      setSheetOpen(true);
    }
  };

  if (isLoading && !isSuccess) {
    return <PageLoadingSpinner label="Loading attendance…" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UserCheck className="size-7 text-(--lagoon-deep)" />
            Attendance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor attendance quality, QR check-ins, registers, and anomalies
            across your modules.
          </p>
        </div>

        {feedback.loadError ? (
          <QueryErrorBanner
            message={feedback.loadError}
            onRetry={feedback.onRetryLoad}
            retrying={feedback.retryingLoad}
          />
        ) : null}

        <AttendanceKpiCards
          booting={booting}
          totalPresent={data?.totalPresent ?? 0}
          totalExpected={data?.totalExpected ?? 0}
          averageRate={data?.averageRate ?? null}
          totalScans={data?.totalScans ?? 0}
          sessionsWithAttendance={data?.sessionsWithAttendance ?? 0}
          lookbackDays={data?.lookbackDays ?? 90}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" />
                Attendance trends
              </CardTitle>
              <CardDescription>
                Daily attendance rate (present ÷ expected) across sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceTrendChart
                series={data?.trendSeries ?? []}
                loading={booting}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="size-4 text-emerald-600" />
                Live today
              </CardTitle>
              <CardDescription>
                Refreshes every 30s · QR scans for today&apos;s sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <div className="space-y-2">
                  <div className="h-12 animate-pulse rounded-md bg-muted" />
                  <div className="h-12 animate-pulse rounded-md bg-muted" />
                </div>
              ) : liveSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sessions scheduled for today.
                </p>
              ) : (
                <ul className="max-h-[280px] space-y-2 overflow-y-auto">
                  {liveSessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => openSession(s.id)}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {s.moduleCode} · {formatClock(s.start_time)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.tutorName}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="secondary">
                            {s.scanCount} scan{s.scanCount === 1 ? "" : "s"}
                          </Badge>
                          {s.qrActive ? (
                            <span className="size-2 rounded-full bg-emerald-500" title="QR active" />
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="issues" className="flex flex-col gap-4">
          <TabsList className="w-full justify-start sm:w-auto">
            <TabsTrigger value="issues">
              Issues ({(data?.integrityIssues.length ?? 0) + (data?.lowSessions.length ?? 0)})
            </TabsTrigger>
            <TabsTrigger value="modules">Module rates</TabsTrigger>
            <TabsTrigger value="peak">Peak scan times</TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="size-4 text-amber-600" />
                    Integrity flags
                  </CardTitle>
                  <CardDescription>
                    Headcount mismatches, missing registers, unverified scans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {booting ? (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  ) : !data?.integrityIssues.length ? (
                    <p className="text-sm text-muted-foreground">
                      No integrity issues detected.
                    </p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                      {data.integrityIssues.map((issue) => (
                        <li key={issue.id}>
                          <button
                            type="button"
                            onClick={() => openSession(issue.claimId)}
                            className="w-full rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-left text-sm text-amber-950 hover:bg-amber-50"
                          >
                            {issue.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Low attendance sessions
                  </CardTitle>
                  <CardDescription>
                    Below 60% of expected headcount
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {booting ? (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  ) : !data?.lowSessions.length ? (
                    <p className="text-sm text-muted-foreground">
                      No low-attendance sessions in the lookback window.
                    </p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                      {data.lowSessions.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => openSession(s.id)}
                            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                          >
                            <div>
                              <p className="font-medium">
                                {s.moduleCode} ·{" "}
                                {format(parseISO(s.session_date), "d MMM")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {s.tutorName}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-amber-700">
                              {Math.round(s.rate * 100)}%
                            </Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="modules" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Module participation</CardTitle>
                <CardDescription>
                  Average attendance rate and QR volume per module
                </CardDescription>
              </CardHeader>
              <CardContent>
                {booting ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : !data?.moduleParticipation.length ? (
                  <p className="text-sm text-muted-foreground">
                    No modules with headcount data yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.moduleParticipation.map((m) => (
                      <li
                        key={m.moduleId}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {m.moduleCode} — {m.moduleName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.sessionCount} session{m.sessionCount === 1 ? "" : "s"} ·{" "}
                            {m.totalScans} QR scan{m.totalScans === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {m.averageRate != null
                            ? `${Math.round(m.averageRate * 100)}%`
                            : "—"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="peak" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScanLine className="size-4" />
                  Peak QR check-in times
                </CardTitle>
                <CardDescription>
                  Hours with the most student check-ins
                </CardDescription>
              </CardHeader>
              <CardContent>
                {booting ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : !data?.peakHours.length ? (
                  <p className="text-sm text-muted-foreground">
                    No QR check-ins recorded yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.peakHours.map((p) => (
                      <li
                        key={p.hour}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{p.label}</span>
                        <span className="text-muted-foreground">
                          {p.scanCount} check-in{p.scanCount === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AttendanceAlertsPanel
          booting={booting}
          alerts={data?.alerts ?? []}
        />

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void invalidate()}
            disabled={isFetching}
          >
            Refresh dashboard
          </Button>
        </div>
      </div>

      <LecturerSessionDetailSheet
        claimId={selectedClaimId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  );
}
