import { BookOpen, ClipboardList, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";

type DashboardKpiCardsProps = {
  booting: boolean;
  modulesCount: number;
  pendingVerificationCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  weekStart: string;
  weekEnd: string;
};

export function DashboardKpiCards({
  booting,
  modulesCount,
  pendingVerificationCount,
  sessionsThisWeek,
  hoursThisWeek,
  weekStart,
  weekEnd,
}: DashboardKpiCardsProps) {
  const kpiItems = [
    {
      label: "Modules",
      value: booting ? null : modulesCount,
      sub: "Assigned to you",
      icon: BookOpen,
    },
    {
      label: "Awaiting verification",
      value: booting ? null : pendingVerificationCount,
      sub: "Tutor claims to review",
      icon: ClipboardList,
    },
    {
      label: "Sessions this week",
      value: booting ? null : sessionsThisWeek,
      sub: `${weekStart} — ${weekEnd}`,
      icon: Clock,
    },
    {
      label: "Hours this week",
      value: booting ? null : hoursThisWeek,
      sub: "Across your modules",
      icon: Clock,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiItems.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {item.value === null ? (
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
