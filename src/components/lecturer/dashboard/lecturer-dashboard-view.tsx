import { format, parseISO } from "date-fns";
import { BookOpen, Clock, ClipboardList, Loader2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { formatClaimStatus } from "#/lib/session-claim-display";
import type {
  LecturerClaimDTO,
  LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard";

type LecturerDashboardViewProps = {
  user: {
    email?: string;
    user_metadata?: Record<string, string | undefined>;
  };
  booting: boolean;
  loadError: string | null;
  modulesCount: number;
  pendingVerificationCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  modules: LecturerModuleDTO[];
  pendingClaims: LecturerClaimDTO[];
  recentClaims: LecturerClaimDTO[];
  weekStart: string;
  weekEnd: string;
};

function ClaimStatusBadge({ status }: { status: LecturerClaimDTO["status"] }) {
  const variant =
    status === "PENDING_VERIFICATION"
      ? "secondary"
      : status === "DISPUTED"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{formatClaimStatus(status)}</Badge>;
}

function ClaimsTable({
  claims,
  emptyMessage,
}: {
  claims: LecturerClaimDTO[];
  emptyMessage: string;
}) {
  if (!claims.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Module</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((claim) => (
          <TableRow key={claim.id}>
            <TableCell className="font-medium">
              {claim.module
                ? `${claim.module.code} — ${claim.module.name}`
                : "—"}
            </TableCell>
            <TableCell>
              {format(parseISO(claim.session_date), "dd MMM yyyy")}
            </TableCell>
            <TableCell>{claim.hours}</TableCell>
            <TableCell>
              <ClaimStatusBadge status={claim.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LecturerDashboardView({
  user,
  booting,
  loadError,
  modulesCount,
  pendingVerificationCount,
  sessionsThisWeek,
  hoursThisWeek,
  modules,
  pendingClaims,
  recentClaims,
  weekStart,
  weekEnd,
}: LecturerDashboardViewProps) {
  const displayName =
    user.user_metadata?.full_name || user.email || "Lecturer";

  const kpiItems = [
    {
      label: "Modules",
      value: booting ? null : modulesCount,
      sub: "Assigned to you",
      icon: BookOpen,
    },
    {
      label: "Awaiting verification",
      value: booting ? null : pendingVerificationCount,
      sub: "Tutor claims to review",
      icon: ClipboardList,
    },
    {
      label: "Sessions this week",
      value: booting ? null : sessionsThisWeek,
      sub: `${weekStart} — ${weekEnd}`,
      icon: Clock,
    },
    {
      label: "Hours this week",
      value: booting ? null : hoursThisWeek,
      sub: "Across your modules",
      icon: Clock,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Welcome back,{" "}
          <span className="font-medium text-foreground">{displayName}</span>.
          Review tutor session claims for your modules.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiItems.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              <item.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {item.value === null ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{item.value}</p>
              )}
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending verification</CardTitle>
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
              <ClaimsTable
                claims={pendingClaims}
                emptyMessage="No claims awaiting verification."
              />
            )}
          </CardContent>
        </Card>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your modules</CardTitle>
          <CardDescription>
            Modules where you are the assigned lecturer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {booting ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : modules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No modules are linked to your account yet. Contact your
              institution admin to assign modules.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {modules.map((mod) => (
                <li
                  key={mod.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="font-medium">{mod.code}</span>
                  <span className="text-muted-foreground">{mod.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
