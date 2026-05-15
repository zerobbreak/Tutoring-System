import { Loader2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type { LecturerPendingClaimDTO } from "#/server-actions/lecturer-dashboard";
import { PendingVerificationTable } from "./pending-verification-table";

type PendingVerificationPanelProps = {
  booting: boolean;
  pendingVerificationCount: number;
  pendingClaims: LecturerPendingClaimDTO[];
};

export function PendingVerificationPanel({
  booting,
  pendingVerificationCount,
  pendingClaims,
}: PendingVerificationPanelProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>
          Pending verification
          {!booting && pendingVerificationCount > 0 ? (
            <Badge variant="secondary" className="ml-2">
              {pendingVerificationCount} awaiting review
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Tutor session claims waiting for your review
        </CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PendingVerificationTable
            claims={pendingClaims}
            emptyMessage="No claims awaiting verification."
          />
        )}
      </CardContent>
    </Card>
  );
}
