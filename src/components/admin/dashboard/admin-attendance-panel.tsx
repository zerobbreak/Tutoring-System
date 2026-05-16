import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { IntegrityIssueDTO } from "#/server-actions/lecturer-attendance/types";
import type { LecturerAttendanceAlertDTO } from "#/server-actions/lecturer-dashboard";

type AdminAttendancePanelProps = {
  booting: boolean;
  alerts: LecturerAttendanceAlertDTO[];
  integrityIssues: IntegrityIssueDTO[];
};

export function AdminAttendancePanel({
  booting,
  alerts,
  integrityIssues,
}: AdminAttendancePanelProps) {
  const items = [
    ...alerts.map((a) => ({ id: a.id, message: a.message, href: "/admin/attendance" as const })),
    ...integrityIssues.map((i) => ({
      id: i.id,
      message: i.message,
      href: "/admin/attendance" as const,
    })),
  ].slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          Attendance alerts
        </CardTitle>
        <CardDescription>Anomalies across the institution</CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance issues detected.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950"
              >
                <span className="mr-1">⚠</span>
                <Link
                  to={item.href}
                  className="underline-offset-2 hover:underline"
                >
                  {item.message}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
