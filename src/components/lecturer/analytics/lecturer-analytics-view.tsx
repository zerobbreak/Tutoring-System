import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { useLecturerAnalyticsData } from "#/components/lecturer/analytics/use-lecturer-analytics-data";
import {
  PageLoadingSpinner,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { AttendanceTrendChart } from "#/components/lecturer/attendance/attendance-trend-chart";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { ScrollArea, ScrollBar } from "#/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { AnalyticsClaimsVolumeChart } from "./analytics-claims-volume-chart";
import { AnalyticsKpiCards } from "./analytics-kpi-cards";
import { AnalyticsModuleHeatmap } from "./analytics-module-heatmap";
import { AnalyticsModulesTable } from "./analytics-modules-table";
import { AnalyticsTutorsTable } from "./analytics-tutors-table";
import { AnalyticsVerificationFunnel } from "./analytics-verification-funnel";
import { AnalyticsWorkloadChart } from "./analytics-workload-chart";
import {
  AnalyticsActionMixList,
  AnalyticsActionsByWeekChart,
  AnalyticsPendingAgeChart,
} from "./analytics-workflow-charts";

export function LecturerAnalyticsView() {
  const { data, isLoading, isFetching, error, refetch, isSuccess } =
    useLecturerAnalyticsData();
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });
  const booting = isLoading;
  const lookbackDays = data?.lookbackDays ?? 90;

  if (isLoading && !isSuccess) {
    return <PageLoadingSpinner label="Loading analytics…" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 pb-10 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="size-7 text-[var(--lagoon-deep)]" />
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational insights across modules and tutors · last {lookbackDays}{" "}
            days
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {feedback.loadError ? (
        <QueryErrorBanner
          message={feedback.loadError}
          onRetry={feedback.onRetryLoad}
          retrying={feedback.retryingLoad}
        />
      ) : null}

      <AnalyticsKpiCards
        booting={booting}
        kpis={data?.kpis ?? null}
        lookbackDays={lookbackDays}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance trend</CardTitle>
            <CardDescription>
              Daily headcount rates across your modules
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
            <CardTitle className="text-base">Claims volume</CardTitle>
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

      <Tabs defaultValue="tutors" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="tutors">Tutors</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="tutors" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tutor performance</CardTitle>
              <CardDescription>
                Ranked by composite score (approval, attendance, disputes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="max-h-[min(28rem,55vh)] w-full rounded-lg border border-border/80">
                  <ScrollBar orientation="horizontal" />
                  <div className="min-w-[52rem] p-1">
                    <AnalyticsTutorsTable tutors={data?.tutors ?? []} />
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workload distribution</CardTitle>
              <CardDescription>
                Tutor hours vs your verification actions on their claims
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsWorkloadChart data={data?.workloadDistribution ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Module summary</CardTitle>
              <CardDescription>
                Attendance, schedule completion, and risk flags
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="max-h-[min(28rem,55vh)] w-full rounded-lg border border-border/80">
                  <ScrollBar orientation="horizontal" />
                  <div className="min-w-[44rem] p-1">
                    <AnalyticsModulesTable modules={data?.modules ?? []} />
                  </div>
                </ScrollArea>
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

        <TabsContent value="workflow" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verification funnel</CardTitle>
                <CardDescription>Claim counts by status</CardDescription>
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
                  How long claims await verification
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
                <CardTitle className="text-base">Your review activity</CardTitle>
                <CardDescription>
                  Verification actions per week ·{" "}
                  {data?.workflow.lecturerActionsTotal ?? 0} total
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
                <CardDescription>Breakdown of your review types</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsActionMixList
                  items={data?.workflow.actionMix ?? []}
                  total={data?.workflow.lecturerActionsTotal ?? 0}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
