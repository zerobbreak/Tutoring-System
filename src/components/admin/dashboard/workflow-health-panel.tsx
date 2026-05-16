import { format, parseISO } from "date-fns";
import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type {
  AdminLecturerActivityDTO,
  AdminPipelineDTO,
} from "#/server-actions/admin-dashboard";

type WorkflowHealthPanelProps = {
  booting: boolean;
  pipeline: AdminPipelineDTO;
  lecturerActivity: AdminLecturerActivityDTO[];
};

export function WorkflowHealthPanel({
  booting,
  pipeline,
  lecturerActivity,
}: WorkflowHealthPanelProps) {
  const pipelineRows = [
    {
      label: "Pending lecturer verifications",
      count: pipeline.pendingLecturerVerifications,
    },
    {
      label: "Pending admin approvals",
      count: pipeline.pendingAdminApprovals,
    },
    {
      label: "Open disputes",
      count: pipeline.openDisputes,
    },
    {
      label: "Claims stuck > 7 days",
      count: pipeline.stalledClaims,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Workflow health
        </CardTitle>
        <CardDescription>Approval pipeline and lecturer activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {booting ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="space-y-2">
            {pipelineRows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span>{row.label}</span>
                <span className="font-semibold tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
        <div>
          <p className="mb-2 text-sm font-medium">Recent lecturer activity</p>
          {booting ? (
            <Skeleton className="h-16 w-full" />
          ) : lecturerActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent verification activity.
            </p>
          ) : (
            <ul className="space-y-2">
              {lecturerActivity.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
                >
                  <p>{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(item.at), "dd MMM yyyy, HH:mm")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
