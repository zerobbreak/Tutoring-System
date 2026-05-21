import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  NotebookPen,
  Scale,
  ShieldAlert,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { PrivateSessionFeedbackReadBlock } from "#/components/private-session-feedback/private-session-feedback-read-block";
import {
  getAdminSessionDetailFn,
  type AdminSessionDetailDTO,
} from "#/server-actions/admin-sessions";

type AdminSessionDetailSheetProps = {
  claimId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DetailSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10">
          <Icon className="size-4 text-(--lagoon-deep)" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          {description ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

function completionLabel(session: AdminSessionDetailDTO): string {
  if (session.completion_verified) return "Verified";
  if (session.session_ended) return "Ended";
  return "In progress";
}

function completionClass(session: AdminSessionDetailDTO): string {
  if (session.completion_verified) return "text-emerald-700 dark:text-emerald-400";
  if (session.session_ended) return "text-foreground";
  return "text-(--lagoon-deep)";
}

export function AdminSessionDetailSheet({
  claimId,
  open,
  onOpenChange,
}: AdminSessionDetailSheetProps) {
  const [session, setSession] = useState<AdminSessionDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const data = await getAdminSessionDetailFn({ data: { claimId } });
      setSession(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load session");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [claimId, onOpenChange]);

  useEffect(() => {
    if (open && claimId) void load();
    else setSession(null);
  }, [open, claimId, load]);

  const hasNotes =
    session?.notes ||
    session?.topics_covered ||
    session?.examples_used ||
    session?.student_struggles ||
    session?.revision_topics;

  const inApprovalWorkflow =
    session &&
    ["PENDING_VERIFICATION", "VERIFIED", "DISPUTED"].includes(session.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">Session details</SheetTitle>
          <SheetDescription className="text-pretty">
            Read-only inspection: evidence, disputes, notes, and audit trail.
          </SheetDescription>
        </SheetHeader>

        {loading || !session ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b bg-linear-to-br from-(--lagoon-deep)/10 via-background to-background px-6 py-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">
                  {session.tutor?.full_name ?? "Tutor"}
                </h2>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {session.module?.code}
                  </span>
                  {" — "}
                  {session.module?.name}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge variant={claimBadgeVariant(session.status)}>
                    {claimBadgeLabel(session.status)}
                  </Badge>
                  {session.open_dispute ? (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="size-3" />
                      Open dispute
                    </Badge>
                  ) : null}
                </div>
              </div>

              {inApprovalWorkflow ? (
                <Button variant="outline" size="sm" asChild className="mt-4 w-full sm:w-auto">
                  <Link to="/admin/approvals" search={{ claim: session.id }}>
                    <ExternalLink className="size-4" />
                    Open in approvals
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5">
              <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <Calendar
                      className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        Session
                      </p>
                      <p className="mt-0.5 font-medium leading-snug text-foreground">
                        {format(parseISO(session.session_date), "EEE, d MMM yyyy")}{" "}
                        · {formatClock(session.start_time)}–
                        {formatClock(session.end_time)}
                      </p>
                    </div>
                  </li>
                  {session.venue ? (
                    <li className="flex gap-3">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Venue
                        </p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {session.venue}
                        </p>
                      </div>
                    </li>
                  ) : null}
                </ul>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
                  <div className="rounded-lg bg-muted/25 px-3 py-2.5">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden />
                      Hours
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">
                      {session.hours}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/25 px-3 py-2.5">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Completion
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        completionClass(session),
                      )}
                    >
                      {completionLabel(session)}
                    </dd>
                  </div>
                </dl>
              </section>

              {(session.missing_evidence ||
                session.headcount_matches_scans === false) && (
                <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {session.missing_evidence ? (
                    <p className="flex items-start gap-2 leading-relaxed">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      No attendance register uploaded for this session.
                    </p>
                  ) : null}
                  {session.headcount_matches_scans === false ? (
                    <p className="flex items-start gap-2 leading-relaxed">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      Headcount does not match QR scan count.
                    </p>
                  ) : null}
                </div>
              )}

              <DetailSection
                title="Attendance"
                description="Present count and check-in summary."
                icon={User}
              >
                <p className="text-sm font-medium text-foreground">
                  {session.attendance_present_count != null
                    ? `${session.attendance_present_count} present`
                    : `${session.attendance_scan_count} QR scans`}
                  {session.attendance_expected_count != null
                    ? ` / ${session.attendance_expected_count} expected`
                    : ""}
                </p>
                {Object.keys(session.attendance_by_status).length > 0 ? (
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {Object.entries(session.attendance_by_status).map(
                      ([status, n]) => (
                        <li key={status}>
                          <Badge variant="secondary" className="text-xs">
                            {status}: {n}
                          </Badge>
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
                {session.attendance_rows.length === 0 ? (
                  <EmptyHint className="mt-3">No student check-ins recorded.</EmptyHint>
                ) : (
                  <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                    {session.attendance_rows.map((row) => (
                      <li
                        key={row.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="truncate font-medium">
                          {row.student?.full_name ?? "Student"}
                          {row.student?.student_reference
                            ? ` (${row.student.student_reference})`
                            : ""}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {row.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>

              <DetailSection
                title="Evidence"
                description="Files uploaded for this session claim."
                icon={FileText}
              >
                {session.evidence.length === 0 ? (
                  <EmptyHint>No files uploaded.</EmptyHint>
                ) : (
                  <ul className="space-y-2">
                    {session.evidence.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {ev.file_name}
                        </span>
                        <Button variant="ghost" size="sm" className="shrink-0" asChild>
                          <a
                            href={ev.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-4" />
                            Open
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>

              <DetailSection
                title="Disputes"
                description="Raised issues and resolution notes."
                icon={Scale}
              >
                {session.disputes.length === 0 ? (
                  <EmptyHint>No disputes for this session.</EmptyHint>
                ) : (
                  <ul className="space-y-2">
                    {session.disputes.map((d) => (
                      <li
                        key={d.id}
                        className="rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant={d.status === "OPEN" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {d.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(d.raised_at), "dd MMM yyyy")}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-foreground">
                          {d.reason}
                        </p>
                        {d.resolution_note ? (
                          <p className="mt-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                            Resolution: {d.resolution_note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>

              <DetailSection
                title="Tutor notes"
                description="Topics, examples, and session reflections."
                icon={NotebookPen}
              >
                {!hasNotes ? (
                  <EmptyHint>No notes submitted.</EmptyHint>
                ) : (
                  <div className="space-y-4 text-sm leading-relaxed">
                    {session.topics_covered ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Topics covered
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                          {session.topics_covered}
                        </p>
                      </div>
                    ) : null}
                    {session.examples_used ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Examples used
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                          {session.examples_used}
                        </p>
                      </div>
                    ) : null}
                    {session.student_struggles ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Student struggles
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                          {session.student_struggles}
                        </p>
                      </div>
                    ) : null}
                    {session.revision_topics ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Revision topics
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                          {session.revision_topics}
                        </p>
                      </div>
                    ) : null}
                    {session.notes ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Additional notes
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                          {session.notes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </DetailSection>

              <DetailSection
                title="Verification timeline"
                description="Audit trail of claim review actions."
                icon={History}
              >
                {session.timeline.length === 0 ? (
                  <EmptyHint>No verification actions yet.</EmptyHint>
                ) : (
                  <ol className="space-y-4 border-l-2 border-(--lagoon-deep)/25 pl-4">
                    {session.timeline.map((item) => (
                      <li key={item.id} className="relative text-sm">
                        <span className="absolute -left-[calc(1rem+5px)] top-1.5 size-2 rounded-full bg-(--lagoon-deep)" />
                        <p className="font-medium capitalize text-foreground">
                          {item.action_type.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.actor_name ?? "System"} ·{" "}
                          {format(parseISO(item.acted_at), "dd MMM yyyy, HH:mm")}
                        </p>
                        {item.comment ? (
                          <p className="mt-1.5 leading-relaxed text-muted-foreground">
                            {item.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </DetailSection>

              {claimId ? (
                <PrivateSessionFeedbackReadBlock
                  claimId={claimId}
                  claimStatus={session.status}
                  title="Private lecturer feedback"
                  description="Optional developmental notes visible to staffing — not shared publicly."
                />
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
