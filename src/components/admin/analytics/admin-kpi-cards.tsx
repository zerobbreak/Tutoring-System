import {
  AlertTriangle,
  Clock,
  Percent,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { AdminAnalyticsKpisDTO } from "#/server-actions/admin-analytics";

type AdminKpiCardsProps = {
  booting: boolean;
  kpis: AdminAnalyticsKpisDTO | null;
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

export function AdminKpiCards({
  booting,
  kpis,
  lookbackDays,
}: AdminKpiCardsProps) {
  const items = [
    {
      label: "Awaiting lecturer",
      value: kpis?.pendingVerificationCount ?? 0,
      sub: "Claims in verification queue",
      icon: Timer,
    },
    {
      label: "Awaiting admin",
      value: kpis?.pendingAdminApprovals ?? 0,
      sub: "Verified, pending approval",
      icon: ShieldCheck,
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
      sub: "Need review now",
      icon: AlertTriangle,
    },
    {
      label: "Sessions this week",
      value: kpis?.activeScheduledSessions ?? 0,
      sub:
        kpis?.scheduleCompletionRate != null
          ? `Utilization ${formatPercent(kpis.scheduleCompletionRate)}`
          : "Scheduled occurrences",
      icon: Users,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              <p className="text-2xl font-bold tabular-nums">{item.value}</p>
            )}
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
