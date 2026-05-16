import { Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileEdit,
  FileWarning,
  History,
  Info,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
  listTutorSessionClaimsFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

const STAT_CARDS = [
  {
    label: "Drafts",
    key: "DRAFT" as const,
    icon: FileEdit,
    cardClass: "border-border/70 bg-muted/30",
    iconWrap: "bg-muted text-muted-foreground",
  },
  {
    label: "Pending",
    key: "PENDING" as const,
    icon: Clock,
    cardClass: "border-amber-500/25 bg-amber-500/5",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    label: "Disputed",
    key: "DISPUTED" as const,
    icon: AlertCircle,
    cardClass: "border-destructive/25 bg-destructive/5",
    iconWrap: "bg-destructive/15 text-destructive",
  },
  {
    label: "Approved",
    key: "APPROVED" as const,
    icon: CheckCircle2,
    cardClass: "border-emerald-500/25 bg-emerald-500/5",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
] as const;

function claimRowAccent(status: ClaimStatus): string {
  switch (status) {
    case "APPROVED":
    case "VERIFIED":
      return "border-l-emerald-500";
    case "PENDING_VERIFICATION":
      return "border-l-amber-500";
    case "DISPUTED":
    case "REJECTED":
      return "border-l-destructive";
    default:
      return "border-l-muted-foreground/35";
  }
}

export function ClaimsDashboard() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<TutorSessionClaimDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listTutorSessionClaimsFn();
      setClaims(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load claims");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const grouped = {
    DRAFT: claims.filter((c) => c.status === "DRAFT"),
    PENDING: claims.filter((c) => c.status === "PENDING_VERIFICATION"),
    DISPUTED: claims.filter((c) => c.status === "DISPUTED"),
    APPROVED: claims.filter(
      (c) => c.status === "APPROVED" || c.status === "VERIFIED",
    ),
  };

  const statCounts = {
    DRAFT: grouped.DRAFT.length,
    PENDING: grouped.PENDING.length,
    DISPUTED: grouped.DISPUTED.length,
    APPROVED: grouped.APPROVED.length,
  };

  const sortedClaims = useMemo(
    () =>
      [...claims].sort((a, b) =>
        a.session_date < b.session_date ? 1 : a.session_date > b.session_date ? -1 : 0,
      ),
    [claims],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-lagoon-deep" />
        <p className="animate-pulse text-muted-foreground">
          Loading claims dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="rise-in flex min-h-0 w-full flex-1 flex-col gap-6 overflow-hidden p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Claims dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your hour verification workflow and lecturer approvals.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link to="/tutor/sessions">
            <History className="size-4" />
            Session history
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((stat) => (
          <Card
            key={stat.label}
            className={cn("border shadow-sm", stat.cardClass)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  stat.iconWrap,
                )}
              >
                <stat.icon className="size-4" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {statCounts[stat.key]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 bg-card shadow-sm">
        <CardHeader className="shrink-0 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">All verification claims</CardTitle>
              <CardDescription>
                Detailed list of your submitted and upcoming claims.
                {claims.length > 0 ? (
                  <span className="mt-1 block font-medium text-foreground/80">
                    {claims.length} total
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" aria-hidden />
              <span>Click a row to open history and evidence</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="h-0 max-h-[calc(100svh-18rem)] min-h-64 flex-1">
            <Table className="[&_[data-slot=table-container]]:overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                <TableRow className="border-b border-border/80 hover:bg-transparent">
                  <TableHead className="h-11 w-[7.5rem] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="h-11 min-w-[12rem] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Module
                  </TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Kind
                  </TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Hours
                  </TableHead>
                  <TableHead className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Evidence
                  </TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-11 w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClaims.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-40 p-0">
                      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
                          <ClipboardList
                            className="size-6 text-muted-foreground"
                            aria-hidden
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            No claims yet
                          </p>
                          <p className="max-w-sm text-sm text-muted-foreground">
                            Session claims you submit will appear here for
                            tracking and verification.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/tutor/sessions">Go to sessions</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedClaims.map((claim, index) => {
                    const status = claim.status as ClaimStatus;
                    return (
                      <TableRow
                        key={claim.id}
                        className={cn(
                          "group cursor-pointer border-b border-border/40 border-l-[3px] transition-colors",
                          claimRowAccent(status),
                          index % 2 === 1 && "bg-muted/20",
                          "hover:bg-lagoon/5 hover:border-l-lagoon-deep",
                        )}
                        onClick={() => {
                          void navigate({
                            to: "/tutor/claims/$claimId",
                            params: { claimId: claim.id },
                          });
                        }}
                      >
                        <TableCell className="px-4 py-3.5 align-top whitespace-normal">
                          <p className="font-semibold tabular-nums text-foreground">
                            {format(parseISO(claim.session_date), "MMM d")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(claim.session_date), "EEEE")}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-[14rem] px-4 py-3.5 align-top whitespace-normal">
                          <div className="flex flex-col gap-1">
                            {claim.module?.code ? (
                              <span className="w-fit rounded-md bg-lagoon/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-lagoon-deep">
                                {claim.module.code}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                            <span
                              className="line-clamp-2 text-xs leading-snug text-muted-foreground"
                              title={claim.module?.name ?? undefined}
                            >
                              {claim.module?.name ?? "Unknown module"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 align-top whitespace-normal">
                          <Badge
                            variant="secondary"
                            className="font-normal capitalize"
                          >
                            {claim.session_kind || "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-right align-top">
                          <span className="inline-flex min-w-11 justify-center rounded-md bg-muted/50 px-2 py-1 text-sm font-semibold tabular-nums text-foreground">
                            {claim.hours.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-center align-top">
                          {claim.evidenceCount > 0 ? (
                            <Badge
                              variant="success"
                              className="mx-auto gap-1 px-2.5 py-0.5"
                            >
                              <CheckCircle2 className="size-3" />
                              {claim.evidenceCount}
                            </Badge>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                              title="No evidence attached"
                            >
                              <FileWarning className="size-3.5 opacity-60" />
                              None
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 align-top">
                          <Badge variant={claimBadgeVariant(status)}>
                            {claimBadgeLabel(status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-3.5 text-right align-middle">
                          <ChevronRight
                            className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-lagoon-deep"
                            aria-hidden
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          {sortedClaims.length > 0 ? (
            <div className="shrink-0 border-t border-border/60 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">
                {sortedClaims.length}
              </span>{" "}
              claim{sortedClaims.length === 1 ? "" : "s"} · newest first
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
