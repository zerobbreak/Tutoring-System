import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  History as HistoryIcon,
  Info,
  Loader2,
  MessageSquare,
  Send,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  claimBadgeLabel,
  claimBadgeVariant,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
  getClaimDetailsFn,
  submitSessionClaimFn,
  type ClaimDetailsDTO,
} from "#/server-actions/tutor-sessions";

function DetailIconWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type ClaimDetailsViewProps = {
  claimId: string;
};

export function ClaimDetailsView({ claimId }: ClaimDetailsViewProps) {
  const [claim, setClaim] = useState<ClaimDetailsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getClaimDetailsFn({ data: { claimId } });
      setClaim(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load claim details",
      );
    } finally {
      setIsLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmitForVerification = async () => {
    setSubmitting(true);
    try {
      await submitSessionClaimFn({ data: { claimId } });
      toast.success("Claim submitted for verification");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-lagoon-deep" />
        <p className="animate-pulse text-muted-foreground">
          Loading claim details…
        </p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="mx-auto mt-20 max-w-md space-y-4 p-8 text-center">
        <div className="mx-auto w-fit rounded-full bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="size-12" />
        </div>
        <h2 className="text-2xl font-semibold">Claim not found</h2>
        <p className="text-muted-foreground">
          The claim you are looking for might have been deleted or you do not
          have access to it.
        </p>
        <Button asChild>
          <Link to="/tutor/claims">Back to claims</Link>
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="rise-in flex w-full flex-col gap-6 p-4 md:p-8">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/tutor/claims">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                Claim details
              </h1>
              <Badge variant={claimBadgeVariant(claim.status as ClaimStatus)}>
                {claimBadgeLabel(claim.status as ClaimStatus)}
              </Badge>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              ID:{" "}
              <span className="font-mono text-xs text-foreground/80">
                {claim.id}
              </span>
            </p>
          </div>
          {claim.status === "DRAFT" ? (
            <Button
              className="bg-lagoon-deep hover:bg-lagoon-deep/90"
              disabled={submitting}
              onClick={() => void handleSubmitForVerification()}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Submit for verification
            </Button>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Card className="border-border/80 bg-card shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-5 text-(--lagoon-deep)" aria-hidden />
                  Session information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <DetailIconWrap>
                      <Calendar className="size-4 text-(--lagoon-deep)" />
                    </DetailIconWrap>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Date & time
                      </p>
                      <p className="font-semibold text-foreground">
                        {format(parseISO(claim.session_date), "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {claim.start_time?.slice(0, 5)} –{" "}
                        {claim.end_time?.slice(0, 5)} ({claim.hours} hrs)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DetailIconWrap>
                      <User className="size-4 text-(--lagoon-deep)" />
                    </DetailIconWrap>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Module & lecturer
                      </p>
                      <p className="font-semibold text-foreground">
                        {claim.module?.code}: {claim.module?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Lecturer:{" "}
                        {claim.module?.lecturer?.full_name || "Unassigned"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <DetailIconWrap>
                      <MessageSquare className="size-4 text-(--lagoon-deep)" />
                    </DetailIconWrap>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Topics & notes
                      </p>
                      <p className="text-sm text-foreground">
                        {claim.topics_covered || (
                          <span className="text-muted-foreground">
                            No topics specified
                          </span>
                        )}
                      </p>
                      {claim.notes ? (
                        <p className="mt-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
                          {claim.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DetailIconWrap>
                      <FileSearch className="size-4 text-(--lagoon-deep)" />
                    </DetailIconWrap>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Attendance
                      </p>
                      <p className="font-semibold tabular-nums text-foreground">
                        {claim.attendance_present_count ?? 0} /{" "}
                        {claim.attendance_expected_count ?? 0} present
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        Source: {claim.session_kind || "manual"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 bg-muted/20">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText
                      className="size-5 text-(--lagoon-deep)"
                      aria-hidden
                    />
                    Attendance evidence
                  </CardTitle>
                  <CardDescription>
                    Documents uploaded to support this claim.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {claim.evidence.length} files
                </Badge>
              </CardHeader>
              <CardContent className="pt-6">
                {claim.evidence.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-12 text-center">
                    <FileText className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No evidence uploaded yet.
                    </p>
                    {claim.status === "DRAFT" ? (
                      <Button variant="outline" size="sm" className="mt-4" asChild>
                        <Link to="/tutor/sessions" search={{ claim: claim.id }}>
                          Upload from sessions
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {claim.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 transition-colors hover:border-(--lagoon-deep)/30 hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                            <FileText className="size-4 text-emerald-700 dark:text-emerald-300" />
                          </span>
                          <div className="min-w-0 overflow-hidden">
                            <p
                              className="truncate text-sm font-medium text-foreground"
                              title={ev.file_name}
                            >
                              {ev.file_name}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {format(parseISO(ev.uploaded_at), "MMM d, HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            asChild
                          >
                            <a
                              href={ev.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" asChild>
                            <a href={ev.file_url} download>
                              <Download className="size-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="flex h-full flex-col border-border/80 bg-card shadow-sm md:col-span-1">
            <CardHeader className="border-b border-border/60 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base">
                <HistoryIcon className="size-5 text-(--lagoon-deep)" aria-hidden />
                Workflow timeline
              </CardTitle>
              <CardDescription>Tracking verification stages.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pt-6">
              {claim.history.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <Clock className="mb-2 size-8 opacity-30" aria-hidden />
                  No verification actions recorded yet.
                </div>
              ) : (
                <ol className="relative space-y-8 border-l-2 border-(--lagoon-deep)/25 pl-6">
                  {claim.history.map((action, idx) => (
                    <li key={action.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[calc(1rem+5px)] top-1.5 size-2.5 rounded-full ring-2 ring-background",
                          idx === 0
                            ? "bg-(--lagoon-deep)"
                            : "bg-muted-foreground/40",
                        )}
                      />
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold capitalize text-foreground">
                            {action.action_type.replace(/_/g, " ")}
                          </p>
                          <time className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {format(parseISO(action.acted_at), "MMM d, HH:mm")}
                          </time>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {action.actor?.full_name || "System"}
                          </Badge>
                          {action.to_status ? (
                            <>
                              <ArrowRight className="size-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium text-(--lagoon-deep)">
                                {action.to_status}
                              </span>
                            </>
                          ) : null}
                        </div>
                        {action.comment ? (
                          <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                            {action.comment}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
