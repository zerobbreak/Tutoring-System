import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type { LecturerClaimDTO } from "#/server-actions/lecturer-dashboard";
import { ClaimsTable } from "./claims-table";

type WeeklySessionsPanelProps = {
  booting: boolean;
  recentClaims: LecturerClaimDTO[];
};

export function WeeklySessionsPanel({
  booting,
  recentClaims,
}: WeeklySessionsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This week&apos;s sessions</CardTitle>
        <CardDescription>
          Claims recorded on your modules this calendar week
        </CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ClaimsTable
            claims={recentClaims}
            emptyMessage="No sessions logged this week."
          />
        )}
      </CardContent>
    </Card>
  );
}
