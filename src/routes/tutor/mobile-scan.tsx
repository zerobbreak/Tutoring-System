import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Copy, Loader2, ScanLine, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { StudentCardScanner } from "#/components/tutor/attendance/student-card-scanner";
import {
  attendanceScanWindowLabel,
  canTutorScanAttendanceForClaim,
} from "#/lib/session-attendance-open";
import { toast } from "#/lib/toast";
import {
  listTutorSessionClaimsFn,
  scanStudentForSessionFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

export const Route = createFileRoute("/tutor/mobile-scan")({
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: (search.sessionId as string) || "",
  }),
  component: TutorMobileScanPage,
});

function TutorMobileScanPage() {
  const { sessionId } = Route.useSearch();
  const [claims, setClaims] = useState<TutorSessionClaimDTO[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState(sessionId);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void listTutorSessionClaimsFn()
      .then((data) => {
        if (cancelled) return;
        setClaims(data);
        if (data.length > 0) {
          setSelectedClaimId((current) => current || data[0].id);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Could not load sessions";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId || claims.length === 0) return;
    if (claims.some((claim) => claim.id === sessionId)) {
      setSelectedClaimId(sessionId);
    }
  }, [claims, sessionId]);

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.id === selectedClaimId) ?? null,
    [claims, selectedClaimId],
  );

  const scanEnabled = useMemo(() => {
    if (!selectedClaim) return false;
    return canTutorScanAttendanceForClaim({
      attendance_locked_at: selectedClaim.attendance_locked_at,
      session_date: selectedClaim.session_date,
      start_time: selectedClaim.start_time,
      end_time: selectedClaim.end_time,
    });
  }, [selectedClaim]);

  const scanHint = useMemo(() => {
    if (!selectedClaim) return null;
    return attendanceScanWindowLabel({
      attendance_locked_at: selectedClaim.attendance_locked_at,
      session_date: selectedClaim.session_date,
      start_time: selectedClaim.start_time,
      end_time: selectedClaim.end_time,
    });
  }, [selectedClaim]);

  const mobileScanUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!selectedClaim?.id) return window.location.href;
    return `${window.location.origin}/tutor/mobile-scan?sessionId=${selectedClaim.id}`;
  }, [selectedClaim?.id]);

  const handleScan = async (payload: string) => {
    if (!selectedClaim) return;
    setScanning(true);
    setLastResult(null);

    try {
      const result = await scanStudentForSessionFn({
        data: { claimId: selectedClaim.id, payload },
      });

      const message = result.alreadyPresent
        ? `${result.studentName} is already marked present.`
        : result.registered
          ? `${result.studentName} registered and marked present.`
          : `${result.studentName} marked present.`;

      setLastResult(message);
      toast.success(message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not record attendance";
      toast.error(message);
    } finally {
      setScanning(false);
    }
  };

  const copyLink = async () => {
    if (!mobileScanUrl) return;
    try {
      await navigator.clipboard.writeText(mobileScanUrl);
      toast.success("Mobile scanner link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Card className="border-primary/20 bg-card/80 shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Smartphone className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">
                  Tutor phone scanner
                </CardTitle>
                <CardDescription>
                  Open this page on your phone, select a session, and scan student cards directly.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={copyLink}>
                <Copy className="size-4" />
                Copy this link
              </Button>
              <Badge variant="secondary" className="gap-1">
                <ScanLine className="size-3.5" />
                Camera ready
              </Badge>
            </div>
            {lastResult ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p>{lastResult}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Choose session</CardTitle>
            <CardDescription>
              Pick the session you want to mark attendance for on this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading sessions…
              </div>
            ) : (
              <>
                <Select value={selectedClaimId} onValueChange={setSelectedClaimId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a session" />
                  </SelectTrigger>
                  <SelectContent>
                    {claims.map((claim) => (
                      <SelectItem key={claim.id} value={claim.id}>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-medium">
                            {claim.module?.code} — {claim.module?.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {claim.session_date} · {claim.start_time?.slice(0, 5) || "--:--"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedClaim ? (
                  <div className="space-y-2">
                    {scanEnabled ? null : (
                      <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
                        {scanHint ?? "Scanning is closed for this session."}
                      </p>
                    )}
                    <StudentCardScanner
                      enabled={Boolean(selectedClaimId) && scanEnabled}
                      busy={scanning}
                      onScan={handleScan}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No open sessions are available right now.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
