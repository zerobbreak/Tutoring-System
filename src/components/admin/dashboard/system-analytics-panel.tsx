import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { AdminAnalyticsSummaryDTO } from "#/server-actions/admin-dashboard";

type SystemAnalyticsPanelProps = {
  booting: boolean;
  summary: AdminAnalyticsSummaryDTO;
};

export function SystemAnalyticsPanel({
  booting,
  summary,
}: SystemAnalyticsPanelProps) {
  const stats = [
    { label: "Modules", value: summary.totalModules },
    { label: "Active tutors", value: summary.activeTutors },
    { label: "Lecturers", value: summary.totalLecturers },
    { label: "Pending claims", value: summary.claimsPending },
    { label: "Verified", value: summary.claimsVerified },
    { label: "Approved", value: summary.claimsApproved },
    { label: "Open disputes", value: summary.openDisputes },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          System analytics overview
        </CardTitle>
        <CardDescription>Institution-wide operational snapshot</CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-border/60 px-3 py-2 text-center"
                >
                  <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link
              to="/admin/analytics"
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View full analytics
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
