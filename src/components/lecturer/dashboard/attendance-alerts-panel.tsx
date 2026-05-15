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
import type { LecturerAttendanceAlertDTO } from "#/server-actions/lecturer-dashboard";

type AttendanceAlertsPanelProps = {
  booting: boolean;
  alerts: LecturerAttendanceAlertDTO[];
};

export function AttendanceAlertsPanel({
  booting,
  alerts,
}: AttendanceAlertsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          Attendance alerts
        </CardTitle>
        <CardDescription>Anomalies on your modules</CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance issues detected.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950"
              >
                <span className="mr-1">⚠</span>
                {alert.claimId ? (
                  <Link
                    to="/lecturer/sessions"
                    search={{ claim: alert.claimId }}
                    className="underline-offset-2 hover:underline"
                  >
                    {alert.message}
                  </Link>
                ) : (
                  alert.message
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
