import { AlertTriangle, Clock, Percent, Timer } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { AnalyticsKpisDTO } from "#/server-actions/lecturer-analytics";

type AnalyticsKpiCardsProps = {
  booting: boolean;
  kpis: AnalyticsKpisDTO | null;
  lookbackDays: number;
};

function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatHours(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function AnalyticsKpiCards({
  booting,
  kpis,
  lookbackDays,
}: AnalyticsKpiCardsProps) {
  const items = [
    {
      label: "Awaiting verification",
      value: kpis?.pendingVerificationCount ?? 0,
      sub: "Claims in queue",
      icon: Timer,
    },
    {
      label: "Median turnaround",
      value: formatHours(kpis?.medianTurnaroundHours ?? null),
      sub: "Submit to approval",
      icon: Clock,
    },
    {
      label: "Average attendance",
      value: formatPercent(kpis?.averageAttendanceRate ?? null),
      sub: `Last ${lookbackDays} days`,
      icon: Percent,
    },
    {
      label: "Open disputes",
      value: kpis?.openDisputes ?? 0,
      sub: kpis?.scheduleCompletionRate != null
        ? `Schedule completion ${formatPercent(kpis.scheduleCompletionRate)}`
        : "Operational issues",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {booting ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{item.value}</p>
            )}
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
