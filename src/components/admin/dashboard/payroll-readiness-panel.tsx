import { Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";

type PayrollReadinessPanelProps = {
  booting: boolean;
  approvedHours: number;
};

export function PayrollReadinessPanel({
  booting,
  approvedHours,
}: PayrollReadinessPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          Payroll readiness
        </CardTitle>
        <CardDescription>Export batches coming soon</CardDescription>
      </CardHeader>
      <CardContent>
        {booting ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Payroll batch export is not available yet. Approved hours are
              tracked and will feed export-ready claims when payroll launches.
            </div>
            <p className="text-sm">
              <span className="font-semibold text-foreground">
                {approvedHours.toLocaleString()}
              </span>{" "}
              hours approved (verified + approved claims)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
