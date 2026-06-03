import { format, parseISO } from "date-fns";
import { APP_PATHS } from "#/lib/app-paths";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Coins, Loader2, TrendingUp } from "lucide-react";
import { useTutorEarningsData } from "#/components/tutor/earnings/use-tutor-earnings-data";
import {
  PageLoadingSpinner,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
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
import {
  payrollStageBadgeClass,
  type ClaimPayrollStageId,
} from "#/lib/claim-payroll-stage";
import { formatZarFromCents } from "#/lib/money";

export function TutorEarningsView() {
  const { data, isLoading, isFetching, error, refetch, isSuccess } =
    useTutorEarningsData();
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });
  const booting = isLoading;

  if (isLoading && !isSuccess) {
    return <PageLoadingSpinner label="Loading earnings…" />;
  }

  const issues = data?.issues;
  const hasIssues =
    issues &&
    (issues.disputedCount > 0 ||
      issues.rejectedCount > 0 ||
      issues.missingEvidenceCount > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 pb-10 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Coins className="size-8 text-(--lagoon-deep)" />
          Earnings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Compensation transparency for verified sessions — expected amounts are
          calculated from approved hours at your institution rate (R225/hr unless
          overridden).
        </p>
      </div>

      {feedback.loadError ? (
        <QueryErrorBanner
          message={feedback.loadError}
          onRetry={feedback.onRetryLoad}
          retrying={feedback.retryingLoad}
        />
      ) : null}

      {booting ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {hasIssues ? (
            <Card className="border-amber-300/60 bg-amber-50/80">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                  <AlertTriangle className="size-4" />
                  Needs attention
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-sm text-amber-950">
                {issues.disputedCount > 0 ? (
                  <span>{issues.disputedCount} claim(s) disputed</span>
                ) : null}
                {issues.rejectedCount > 0 ? (
                  <span>{issues.rejectedCount} claim(s) rejected</span>
                ) : null}
                {issues.missingEvidenceCount > 0 ? (
                  <span>
                    {issues.missingEvidenceCount} session(s) missing attendance
                    evidence
                  </span>
                ) : null}
                <Button variant="link" className="h-auto p-0 text-amber-950" asChild>
                  <Link to={APP_PATHS.tutor.claims}>Review claims</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Hours worked"
              value={`${data.summary.totalHoursWorked} h`}
            />
            <KpiCard
              label="Pending verification"
              value={`${data.summary.pendingVerificationHours} h`}
            />
            <KpiCard
              label="Approved hours"
              value={`${data.summary.approvedHours} h`}
            />
            <KpiCard
              label="Awaiting export"
              value={`${data.summary.awaitingExportHours} h`}
            />
            <KpiCard
              label="Expected earnings"
              value={formatZarFromCents(data.summary.expectedEarningsCents)}
              highlight
            />
            <KpiCard
              label="In payroll batches"
              value={formatZarFromCents(data.summary.includedInPayrollCents)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                Recent claim activity
              </CardTitle>
              <CardDescription>
                Status of your sessions through verification and payroll export.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No claims yet. Submit session claims to track earnings.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentClaims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <Link
                            to={APP_PATHS.tutor.claimDetail}
                            params={{ claimId: claim.id }}
                            className="font-medium hover:underline"
                          >
                            {claim.moduleCode}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {claim.moduleName}
                          </p>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(claim.sessionDate), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>{claim.hours}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={payrollStageBadgeClass(
                              claim.payrollStageId as ClaimPayrollStageId,
                            )}
                          >
                            {claim.payrollStageLabel}
                          </Badge>
                          {claim.payrollStageDetail ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {claim.payrollStageDetail}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {claim.amountCents != null
                            ? formatZarFromCents(claim.amountCents)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payroll batches</CardTitle>
              <CardDescription>
                Export batches that include your approved claims (processed by
                your institution&apos;s finance team).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.payrollBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None of your approved claims have been included in a payroll
                  export yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Your claims</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payrollBatches.map((batch) => (
                      <TableRow key={batch.exportId}>
                        <TableCell className="font-medium">
                          {batch.periodLabel}
                        </TableCell>
                        <TableCell>{batch.claimCount}</TableCell>
                        <TableCell>{batch.totalHours}</TableCell>
                        <TableCell>
                          {formatZarFromCents(batch.totalAmountCents)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{batch.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-(--lagoon-deep)/30 bg-(--lagoon-deep)/5" : undefined}>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
