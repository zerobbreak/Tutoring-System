import { format, parseISO } from "date-fns";
import { Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
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
  const [phoneScannerOpen, setPhoneScannerOpen] = useState(false);
  const [phoneScannerUrl, setPhoneScannerUrl] = useState("");

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

  const handleOpenPhoneScanner = () => {
    if (!claim) return;
    const url = `${window.location.origin}/tutor/mobile-scan?sessionId=${claim.id}`;
    setPhoneScannerUrl(url);
    setPhoneScannerOpen(true);
  };

  const handleCopyPhoneScannerLink = async () => {
    if (!phoneScannerUrl || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(phoneScannerUrl);
      toast.success("Phone scanner link copied.");
    } catch {
      toast.error("Could not copy the phone scanner link.");
    }
  };

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
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Use a phone as the scanner</p>
                  <p className="text-xs text-muted-foreground">
                    Open the mobile scanner on another device and keep this
                    attendance dialog open.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleOpenPhoneScanner}
                >
                  <Smartphone className="size-4" />
                  Open phone scanner
                </Button>
              </div>
            </div>
            <StudentCardScanner
              enabled={scanEnabled}
              busy={scanning}
              onScan={handleScan}
            />
          </div>
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
        <Dialog open={phoneScannerOpen} onOpenChange={setPhoneScannerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Phone scanner link</DialogTitle>
              <DialogDescription>
                Open this link on the phone you want to use for scanning.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-center rounded-lg border bg-muted/40 p-3">
                {phoneScannerUrl ? (
                  <QRCodeSVG value={phoneScannerUrl} size={220} level="M" />
                ) : null}
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="break-all text-sm font-mono">{phoneScannerUrl}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopyPhoneScannerLink}
                >
                  Copy link
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => setPhoneScannerOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
