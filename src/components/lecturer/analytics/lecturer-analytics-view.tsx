import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttendanceTrendChart } from "#/components/lecturer/attendance/attendance-trend-chart";
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
  getLecturerAnalyticsFn,
  type LecturerAnalyticsDTO,
} from "#/server-actions/lecturer-analytics";
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
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<LecturerAnalyticsDTO | null>(null);

  const load = useCallback(async () => {
    setBooting(true);
    setLoadError(null);
    try {
      const result = await getLecturerAnalyticsFn();
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
            Operational insights across modules and tutors · last {lookbackDays}{" "}
            days
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
                <AnalyticsTutorsTable tutors={data?.tutors ?? []} />
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
