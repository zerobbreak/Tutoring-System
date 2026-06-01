import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { ScrollArea } from "#/components/ui/scroll-area";
import { StudentCardScanner } from "#/components/tutor/attendance/student-card-scanner";
import {
  attendanceScanWindowLabel,
  canTutorScanAttendanceForClaim,
} from "#/lib/session-attendance-open";
import { toast } from "#/lib/toast";
import {
  getAttendanceDataFn,
  scanStudentForSessionFn,
  type AttendanceRecordDTO,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

export function TutorSessionAttendanceDialog({
  open,
  onOpenChange,
  claim,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: TutorSessionClaimDTO | null;
  onUpdated: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<AttendanceRecordDTO[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const loadRows = useCallback(async (claimId: string) => {
    const data = await getAttendanceDataFn({ data: { claimId } });
    setRows(data);
  }, []);

  useEffect(() => {
    if (!open || !claim) {
      setRows(null);
      return;
    }
    void loadRows(claim.id).catch((e) => {
      toast.error(
        e instanceof Error ? e.message : "Could not load attendance",
      );
      setRows([]);
    });
  }, [open, claim, loadRows]);

  const scanEnabled = useMemo(() => {
    if (!claim) return false;
    return canTutorScanAttendanceForClaim({
      attendance_locked_at: claim.attendance_locked_at,
      session_date: claim.session_date,
      start_time: claim.start_time,
      end_time: claim.end_time,
    });
  }, [claim]);

  const handleScan = async (payload: string) => {
    if (!claim) return;
    setScanning(true);
    try {
      const result = await scanStudentForSessionFn({
        data: { claimId: claim.id, payload },
      });
      if (result.alreadyPresent) {
        toast.info(`${result.studentName} is already marked present.`);
      } else if (result.registered) {
        toast.success(`${result.studentName} registered and marked present.`);
      } else {
        toast.success(`${result.studentName} marked present.`);
      }
      await loadRows(claim.id);
      await onUpdated();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not record attendance",
      );
    } finally {
      setScanning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setRows(null);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record attendance</DialogTitle>
          <DialogDescription>
            {claim?.module
              ? `${claim.module.code} — scan student cards to mark who was present.`
              : "Scan student cards to mark who was present."}
          </DialogDescription>
        </DialogHeader>
        {claim ? (
          <StudentCardScanner
            enabled={scanEnabled}
            busy={scanning}
            onScan={handleScan}
          />
        ) : null}
        {!scanEnabled && claim ? (
          <p className="text-xs text-amber-700 dark:text-amber-200">
            {attendanceScanWindowLabel({
              attendance_locked_at: claim.attendance_locked_at,
              session_date: claim.session_date,
              start_time: claim.start_time,
              end_time: claim.end_time,
            }) ?? "Scanning is closed for this session."}
          </p>
        ) : null}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Present ({rows?.length ?? 0})
          </p>
          <ScrollArea className="max-h-48 pr-4">
            <div className="space-y-2 text-sm">
              {rows?.length ? (
                rows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.student.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.student.student_reference ??
                          r.student.email ??
                          "—"}
                        {r.check_in_time
                          ? ` · ${format(parseISO(r.check_in_time), "HH:mm")}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {r.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  No students recorded yet. Scan a card to mark someone present.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
