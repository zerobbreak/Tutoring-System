import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { Activity, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { LecturerSessionDetailSheetHeader } from "#/components/lecturer/sessions/lecturer-session-detail-sheet-header";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { ClaimEvidenceSection } from "#/components/lecturer/sheets/claim-evidence-section";
import { ClaimVerificationTimelineSection } from "#/components/lecturer/sheets/claim-verification-timeline-section";
import { DetailSection } from "#/components/lecturer/sheets/detail-section";
import { SessionDateTimeVenue } from "#/components/lecturer/sheets/session-datetime-venue";
import { LecturerSessionAttendanceSection } from "#/components/lecturer/sessions/lecturer-session-attendance-section";
import { LecturerSessionNotesSection } from "#/components/lecturer/sessions/lecturer-session-notes-section";
import { LecturerSessionQrSection } from "#/components/lecturer/sessions/lecturer-session-qr-section";
import { SessionActivityTimeline } from "#/components/sessions/session-activity-timeline";
import { cn } from "#/lib/utils";
import { useLecturerSessionDetail } from "#/components/lecturer/sessions/use-lecturer-session-detail";
import type { LecturerSessionDetailDTO } from "#/server-actions/lecturer-sessions";

type LecturerSessionDetailSheetProps = {
  claimId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function completionLabel(session: LecturerSessionDetailDTO): string {
  if (session.completion_verified) return "Verified";
  if (session.session_ended) return "Ended";
  return "In progress";
}

function completionClass(session: LecturerSessionDetailDTO): string {
  if (session.completion_verified) return "text-emerald-700";
  if (session.session_ended) return "text-foreground";
  return "text-(--lagoon-deep)";
}

export function LecturerSessionDetailSheet({
  claimId,
  open,
  onOpenChange,
}: LecturerSessionDetailSheetProps) {
  const { loading, session, activity, qrUrl, timeline } = useLecturerSessionDetail(
    claimId,
    open,
    onOpenChange,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">Session details</SheetTitle>
          <SheetDescription className="text-pretty">
            Monitor attendance, evidence, tutor notes, and claim status.
          </SheetDescription>
        </SheetHeader>

        {loading || !session ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <LecturerSessionDetailSheetHeader session={session} />

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5">
              <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <SessionDateTimeVenue
                  sessionDate={session.session_date}
                  startTime={session.start_time}
                  endTime={session.end_time}
                  venue={session.venue}
                />

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
                <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950">
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

              <LecturerSessionAttendanceSection
                attendancePresentCount={session.attendance_present_count}
                attendanceExpectedCount={session.attendance_expected_count}
                attendanceScanCount={session.attendance_scan_count}
                attendanceByStatus={session.attendance_by_status}
                attendanceRows={session.attendance_rows}
              />

              <LecturerSessionQrSection
                attendanceScanCount={session.attendance_scan_count}
                qrExpiresAt={session.qr_expires_at}
                qrUrl={qrUrl}
              />

              <ClaimEvidenceSection
                evidence={session.evidence}
                emptyHint="No files uploaded."
              />

              <LecturerSessionNotesSection
                notes={session.notes}
                topicsCovered={session.topics_covered}
                examplesUsed={session.examples_used}
                studentStruggles={session.student_struggles}
                revisionTopics={session.revision_topics}
              />

              <DetailSection
                title="Activity"
                description="Schedule changes, claim workflow, and system events."
                icon={Activity}
              >
                <SessionActivityTimeline entries={activity} />
              </DetailSection>

              <ClaimVerificationTimelineSection timeline={timeline} />

              {session.can_verify ? (
                <Button asChild className="w-full">
                  <Link
                    to={APP_PATHS.lecturer.verificationQueue}
                    search={{ claim: session.id }}
                  >
                    <CheckCircle2 className="size-4" />
                    Review in verification queue
                  </Link>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
