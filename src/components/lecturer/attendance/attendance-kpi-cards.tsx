import { Percent, ScanLine, UserCheck, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";

type AttendanceKpiCardsProps = {
  booting: boolean;
  totalPresent: number;
  totalExpected: number;
  averageRate: number | null;
  totalScans: number;
  sessionsWithAttendance: number;
  lookbackDays: number;
};

export function AttendanceKpiCards({
  booting,
  totalPresent,
  totalExpected,
  averageRate,
  totalScans,
  sessionsWithAttendance,
  lookbackDays,
}: AttendanceKpiCardsProps) {
  const rateLabel =
    averageRate != null ? `${Math.round(averageRate * 100)}%` : "—";

  const items = [
    {
      label: "Average attendance",
      value: rateLabel,
      sub: `Last ${lookbackDays} days`,
      icon: Percent,
    },
    {
      label: "Total present",
      value: totalPresent,
      sub: totalExpected > 0 ? `of ${totalExpected} expected` : "No expected counts",
      icon: UserCheck,
    },
    {
      label: "QR check-ins",
      value: totalScans,
      sub: "Across all sessions",
      icon: ScanLine,
    },
    {
      label: "Sessions tracked",
      value: sessionsWithAttendance,
      sub: "With headcount data",
      icon: Users,
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
