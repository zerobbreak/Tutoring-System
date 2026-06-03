import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { BarChart3, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { InstitutionDashboardDTO } from "#/server-actions/admin-institutions";

type InstitutionDashboardCardProps = {
  booting: boolean;
  dashboard: InstitutionDashboardDTO | null;
};

function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function InstitutionDashboardCard({
  booting,
  dashboard,
}: InstitutionDashboardCardProps) {
  const verification = dashboard?.verification;

  const kpis = [
    { label: "Active users", value: dashboard?.activeUsers ?? 0 },
    { label: "Active tutors", value: dashboard?.activeTutors ?? 0 },
    { label: "Lecturers", value: dashboard?.totalLecturers ?? 0 },
    { label: "Session claims", value: dashboard?.totalClaims ?? 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          Institution overview
        </CardTitle>
        <CardDescription>
          Operational metrics for your institution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {booting ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-md border border-border/60 px-3 py-2 text-center"
                >
                  <p className="text-lg font-bold tabular-nums">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Verification</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  Pending verification:{" "}
                  <span className="font-medium text-foreground">
                    {verification?.pendingVerificationCount ?? 0}
                  </span>
                </li>
                <li>
                  Open disputes:{" "}
                  <span className="font-medium text-foreground">
                    {verification?.openDisputes ?? 0}
                  </span>
                </li>
                <li>
                  Median lecturer turnaround:{" "}
                  <span className="font-medium text-foreground">
                    {verification?.medianTurnaroundHours != null
                      ? `${verification.medianTurnaroundHours.toFixed(1)}h`
                      : "—"}
                  </span>
                </li>
              </ul>
              {verification?.claimsByStatus?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {verification.claimsByStatus
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <span
                        key={s.status}
                        className="rounded-md border border-border/60 px-2 py-0.5 text-xs"
                      >
                        {formatStatusLabel(s.status)}: {s.count}
                      </span>
                    ))}
                </div>
              ) : null}
            </div>

            <Link
              to={APP_PATHS.admin.analytics}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <BarChart3 className="size-3.5" />
              View full analytics
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
