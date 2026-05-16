import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttendanceTrendChart } from "#/components/lecturer/attendance/attendance-trend-chart";
import { AnalyticsClaimsVolumeChart } from "#/components/lecturer/analytics/analytics-claims-volume-chart";
import { AnalyticsModuleHeatmap } from "#/components/lecturer/analytics/analytics-module-heatmap";
import { AnalyticsModulesTable } from "#/components/lecturer/analytics/analytics-modules-table";
import { AnalyticsVerificationFunnel } from "#/components/lecturer/analytics/analytics-verification-funnel";
import { AnalyticsWorkloadChart } from "#/components/lecturer/analytics/analytics-workload-chart";
import {
  AnalyticsActionMixList,
  AnalyticsActionsByWeekChart,
  AnalyticsPendingAgeChart,
} from "#/components/lecturer/analytics/analytics-workflow-charts";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  getAdminAnalyticsFn,
  type AdminAnalyticsDTO,
} from "#/server-actions/admin-analytics";
import { AdminComparisonsTable } from "./admin-comparisons-table";
import { AdminInstitutionSnapshot } from "./admin-institution-snapshot";
import { AdminKpiCards } from "./admin-kpi-cards";
import { AdminLecturersTable } from "./admin-lecturers-table";
import { AdminOnboardingPanel } from "./admin-onboarding-panel";
import { AdminStageTimings } from "./admin-stage-timings";
import { AdminTutorsTable } from "./admin-tutors-table";

export function AdminAnalyticsView() {
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<AdminAnalyticsDTO | null>(null);

  const load = useCallback(async () => {
    setBooting(true);
    setLoadError(null);
    try {
      const result = await getAdminAnalyticsFn();
      setData(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load analytics",
      );
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lookbackDays = data?.lookbackDays ?? 90;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="size-7 text-[var(--lagoon-deep)]" />
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.institutionName
              ? `${data.institutionName} · `
              : ""}
            Institutional intelligence · last {lookbackDays} days
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={booting}
        >
          {booting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {loadError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : null}

      <AdminKpiCards
        booting={booting}
        kpis={data?.kpis ?? null}
        lookbackDays={lookbackDays}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance trend</CardTitle>
            <CardDescription>
              Daily headcount rates across the institution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart
              series={data?.attendanceTrend ?? []}
              loading={booting}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claims throughput</CardTitle>
            <CardDescription>Submissions vs approvals over time</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsClaimsVolumeChart
              series={data?.claimsVolumeTrend ?? []}
              loading={booting}
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="tutors">Tutors</TabsTrigger>
          <TabsTrigger value="lecturers">Lecturers</TabsTrigger>
          <TabsTrigger value="institution">Institution</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval stage timing</CardTitle>
              <CardDescription>
                Median hours between workflow milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminStageTimings stages={data?.workflow.stageTimings ?? []} />
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval funnel</CardTitle>
                <CardDescription>Current claim pipeline by status</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsVerificationFunnel
                  steps={data?.workflow.funnel ?? []}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending queue age</CardTitle>
                <CardDescription>
                  Bottlenecks awaiting lecturer verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsPendingAgeChart
                  buckets={data?.workflow.pendingAges ?? []}
                />
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verification activity</CardTitle>
                <CardDescription>
                  Actions per week · {data?.workflow.disputeCountInPeriod ?? 0}{" "}
                  disputes in period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsActionsByWeekChart
                  series={data?.workflow.actionsByWeek ?? []}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Action mix</CardTitle>
                <CardDescription>
                  {data?.workflow.verificationActionsTotal ?? 0} actions in
                  period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsActionMixList
                  items={data?.workflow.actionMix ?? []}
                  total={data?.workflow.verificationActionsTotal ?? 0}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tutors" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tutor performance</CardTitle>
              <CardDescription>
                Workload, approval rates, attendance, and engagement proxy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : (
                <AdminTutorsTable tutors={data?.tutors ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workload distribution</CardTitle>
              <CardDescription>Hours and submissions by tutor</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsWorkloadChart
                data={data?.workloadDistribution ?? []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lecturers" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lecturer verification</CardTitle>
              <CardDescription>
                Delays, backlog, and module coverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : (
                <AdminLecturersTable lecturers={data?.lecturers ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Module activity</CardTitle>
              <CardDescription>
                Attendance, utilization, and risk flags by module
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : (
                <AnalyticsModulesTable modules={data?.modules ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Module heat map</CardTitle>
              <CardDescription>
                Weekly attendance rate by module (%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsModuleHeatmap cells={data?.moduleHeatMap ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="institution" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Institution snapshot</CardTitle>
              <CardDescription>
                Active sessions, utilization, and attendance health
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data ? (
                <AdminInstitutionSnapshot
                  snapshot={data.institution}
                  institutionName={data.institutionName}
                />
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Within-institution comparisons</CardTitle>
              <CardDescription>
                Performance by academic term and campus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <AdminComparisonsTable
                title="By academic term"
                slices={data?.comparisons.byTerm ?? []}
                emptyMessage="No term-linked activity in this period."
              />
              <AdminComparisonsTable
                title="By campus"
                slices={data?.comparisons.byCampus ?? []}
                emptyMessage="No campus-linked sessions in this period."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User onboarding</CardTitle>
              <CardDescription>
                Approval pipeline for tutors and lecturers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data ? (
                <AdminOnboardingPanel onboarding={data.onboarding} />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
