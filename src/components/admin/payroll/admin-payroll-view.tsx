import { format } from "date-fns";
import { APP_PATHS } from "#/lib/app-paths";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Loader2, Wallet } from "lucide-react";
import { useAdminPayrollData } from "#/components/admin/payroll/use-admin-payroll-data";
import {
  PageLoadingSpinner,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { AdminPayrollExportBar } from "#/components/admin/approvals/admin-payroll-export-bar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";

export function AdminPayrollView() {
  const { data, isLoading, isFetching, error, refetch, isSuccess, invalidate } =
    useAdminPayrollData();
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });
  const summary = data?.summary ?? null;
  const exports = data?.exports ?? [];
  const booting = isLoading;

  if (isLoading && !isSuccess) {
    return <PageLoadingSpinner label="Loading payroll…" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Wallet className="size-7 text-(--lagoon-deep)" />
              Payroll operations
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Export approved hours for finance. This does not process payments —
              it prepares compensation batches from verified academic work.
            </p>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <Link to={APP_PATHS.admin.approvals}>
              <ClipboardCheck className="mr-2 size-4" />
              Approvals queue
            </Link>
          </Button>
        </div>

        {feedback.loadError ? (
          <QueryErrorBanner
            message={feedback.loadError}
            onRetry={feedback.onRetryLoad}
            retrying={feedback.retryingLoad}
          />
        ) : null}

        {booting ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Awaiting export"
                value={`${summary?.approvedHoursAwaitingExport ?? 0} h`}
                sub={`${summary?.approvedClaimsAwaitingExport ?? 0} approved claims`}
              />
              <SummaryCard
                title="Exports this month"
                value={String(summary?.exportsThisMonth ?? 0)}
                sub={`${summary?.totalExportedHoursThisMonth ?? 0} h exported`}
              />
              <SummaryCard
                title="Default rate"
                value="R225/hr"
                sub="Institution tutor rate"
              />
              <SummaryCard
                title="Batches on record"
                value={String(exports.length)}
                sub="All-time export history"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Create payroll batch</CardTitle>
                <CardDescription>
                  Select a period and export approved claims not yet included in a
                  batch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminPayrollExportBar onExported={() => void invalidate()} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll batches</CardTitle>
                <CardDescription>
                  Previously generated exports for your institution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {exports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payroll batches yet. Approve claims in Approvals, then
                    export a period above.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Claims</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Generated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exports.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.period_label}
                            <p className="text-xs text-muted-foreground">
                              {row.period_start} – {row.period_end}
                            </p>
                          </TableCell>
                          <TableCell>{row.claim_count}</TableCell>
                          <TableCell>{row.total_hours}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(
                              new Date(row.generated_at),
                              "d MMM yyyy HH:mm",
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
