import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow, isAfter, parseISO } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  QrCode,
  Scale,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  getAdminSessionDetailFn,
  type AdminSessionDetailDTO,
} from "#/server-actions/admin-sessions";

type AdminSessionDetailSheetProps = {
  claimId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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

  const qrExpired = useMemo(() => {
    if (!session?.qr_expires_at) return false;
    return isAfter(new Date(), parseISO(session.qr_expires_at));
  }, [session?.qr_expires_at]);

  const checkInUrl = useMemo(() => {
    if (!session?.qr_check_in_url || typeof window === "undefined") return null;
    const path = session.qr_check_in_url;
    return path.startsWith("http") ? path : `${window.location.origin}${path}`;
  }, [session?.qr_check_in_url]);

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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Session details</SheetTitle>
          <SheetDescription>
            Read-only inspection: attendance, evidence, QR, disputes, and audit trail.
          </SheetDescription>
        </SheetHeader>

        {loading || !session ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6 pb-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">
                  {session.tutor?.full_name ?? "Tutor"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session.module?.code} — {session.module?.name}
                </p>
              </div>
              <Badge variant={claimBadgeVariant(session.status)}>
                {claimBadgeLabel(session.status)}
              </Badge>
            </div>

            {inApprovalWorkflow ? (
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/admin/approvals" search={{ claim: session.id }}>
                  <ExternalLink className="mr-2 size-4" />
                  Open in approvals
                </Link>
              </Button>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Session
                </dt>
                <dd className="font-medium">
                  {format(parseISO(session.session_date), "EEE, d MMM yyyy")} ·{" "}
                  {formatClock(session.start_time)}–{formatClock(session.end_time)}
                </dd>
              </div>
              {session.venue ? (
                <div className="col-span-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" />
                    Venue
                  </dt>
                  <dd className="font-medium">{session.venue}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Hours</dt>
                <dd className="font-medium">{session.hours}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Completion</dt>
                <dd className="font-medium">
                  {session.completion_verified
                    ? "Verified"
                    : session.session_ended
                      ? "Ended"
                      : "In progress"}
                </dd>
              </div>
            </dl>

            {(session.missing_evidence || session.headcount_matches_scans === false) && (
              <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-950">
                {session.missing_evidence ? (
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="size-4 shrink-0" />
                    No attendance register uploaded for this session.
                  </p>
                ) : null}
                {session.headcount_matches_scans === false ? (
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="size-4 shrink-0" />
                    Headcount does not match QR scan count.
                  </p>
                ) : null}
              </div>
            )}

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <User className="size-4" />
                Attendance
              </h3>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p>
                  {session.attendance_present_count != null
                    ? `${session.attendance_present_count} present`
                    : `${session.attendance_scan_count} QR scans`}
                  {session.attendance_expected_count != null
                    ? ` / ${session.attendance_expected_count} expected`
                    : ""}
                </p>
                {Object.keys(session.attendance_by_status).length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {Object.entries(session.attendance_by_status).map(([status, n]) => (
                      <li key={status}>
                        {status}: {n}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {session.attendance_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No check-ins recorded.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {session.attendance_rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {row.notes?.trim() ||
                          (row.check_in_time
                            ? `Check-in · ${format(parseISO(row.check_in_time), "HH:mm")}`
                            : "Unregistered check-in")}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {row.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <QrCode className="size-4" />
                QR attendance
              </h3>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Scans:</span>{" "}
                  {session.attendance_scan_count}
                </p>
                {session.qr_expires_at ? (
                  <p className="mt-1 text-muted-foreground">
                    Expires{" "}
                    {formatDistanceToNow(parseISO(session.qr_expires_at), {
                      addSuffix: true,
                    })}
                    {qrExpired ? " (expired)" : ""}
                  </p>
                ) : null}
                {checkInUrl ? (
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                    {checkInUrl}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" />
                Evidence
              </h3>
              {session.evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {session.evidence.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="truncate">{ev.file_name}</span>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={ev.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 size-4" />
                          Open
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Scale className="size-4" />
                Disputes
              </h3>
              {session.disputes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No disputes for this session.</p>
              ) : (
                <ul className="space-y-2">
                  {session.disputes.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-md border px-3 py-2 text-sm"
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
                      <p className="mt-2 whitespace-pre-wrap">{d.reason}</p>
                      {d.resolution_note ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Resolution: {d.resolution_note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {session.open_dispute ? (
                <p className="text-xs text-destructive">This session has an open dispute.</p>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Tutor notes</h3>
              {!hasNotes ? (
                <p className="text-sm text-muted-foreground">No notes submitted.</p>
              ) : (
                <div className="space-y-3 rounded-lg border p-3 text-sm">
                  {session.topics_covered ? (
                    <div>
                      <p className="font-medium text-muted-foreground">Topics covered</p>
                      <p className="mt-1 whitespace-pre-wrap">{session.topics_covered}</p>
                    </div>
                  ) : null}
                  {session.examples_used ? (
                    <div>
                      <p className="font-medium text-muted-foreground">Examples used</p>
                      <p className="mt-1 whitespace-pre-wrap">{session.examples_used}</p>
                    </div>
                  ) : null}
                  {session.student_struggles ? (
                    <div>
                      <p className="font-medium text-muted-foreground">Student struggles</p>
                      <p className="mt-1 whitespace-pre-wrap">{session.student_struggles}</p>
                    </div>
                  ) : null}
                  {session.revision_topics ? (
                    <div>
                      <p className="font-medium text-muted-foreground">Revision topics</p>
                      <p className="mt-1 whitespace-pre-wrap">{session.revision_topics}</p>
                    </div>
                  ) : null}
                  {session.notes ? (
                    <div>
                      <p className="font-medium text-muted-foreground">Additional notes</p>
                      <p className="mt-1 whitespace-pre-wrap">{session.notes}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <History className="size-4" />
                Verification timeline
              </h3>
              {session.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No verification actions yet.</p>
              ) : (
                <ol className="space-y-3 border-l-2 border-border pl-4">
                  {session.timeline.map((item) => (
                    <li key={item.id} className="relative text-sm">
                      <span className="absolute -left-[1.3rem] top-1 size-2 rounded-full bg-primary" />
                      <p className="font-medium">{item.action_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.actor_name ?? "System"} ·{" "}
                        {format(parseISO(item.acted_at), "dd MMM yyyy, HH:mm")}
                      </p>
                      {item.comment ? (
                        <p className="mt-1 text-muted-foreground">{item.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
