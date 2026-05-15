import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, QrCode, UserCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { toast } from "#/lib/toast";
import { checkInStudentFn } from "#/server-actions/tutor-sessions";

export const Route = createFileRoute("/student/check-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
    session: (search.session as string) || "",
  }),
  component: StudentCheckInPage,
});

function StudentCheckInPage() {
  const { token, session: sessionId } = Route.useSearch();
  const [studentRef, setStudentRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentRef) {
      toast.error("Please enter your Student ID / Reference");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await checkInStudentFn({
        data: {
          token,
          sessionId,
          studentReference: studentRef,
        },
      });
      setSuccess(result.studentName);
      toast.success(`Check-in successful! Welcome, ${result.studentName}`);
    } catch (err: any) {
      const msg = err.message || "Failed to check in";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md rise-in border-emerald-500/20 bg-emerald-500/[0.02]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-10" />
            </div>
            <CardTitle className="text-2xl font-display">Check-in Complete</CardTitle>
            <CardDescription className="text-lg">
              Welcome, <span className="font-semibold text-foreground">{success}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            Your attendance has been recorded for this session. You can now close this window or return to your dashboard.
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30 font-sans">
      <Card className="w-full max-w-md rise-in shadow-xl">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-lagoon-deep/10 text-lagoon-deep">
            <QrCode className="size-6" />
          </div>
          <CardTitle className="text-2xl font-display font-bold">Session Check-in</CardTitle>
          <CardDescription>
            Scan successful. Please enter your student details to verify attendance.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCheckIn}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-600 border border-rose-500/20">
                <XCircle className="size-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="studentRef">Student ID / Reference Number</Label>
              <Input
                id="studentRef"
                placeholder="e.g. STU12345"
                value={studentRef}
                onChange={(e) => setStudentRef(e.target.value)}
                disabled={loading}
                autoFocus
                className="h-12 text-lg"
              />
              <p className="text-[10px] text-muted-foreground italic">
                Enter your official institutional ID to confirm your presence.
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Session ID:</span>
                <span className="font-mono text-[10px] opacity-60">{sessionId.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Verification:</span>
                <Badge variant="outline" className="text-[9px] h-4 bg-background px-1.5">Secure QR Token</Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full h-12 gap-2 text-base font-semibold bg-lagoon-deep hover:bg-lagoon-deep/90 shadow-lg shadow-lagoon-deep/20" 
              disabled={loading || !token || !sessionId}
            >
              {loading ? <Loader2 className="size-5 animate-spin" /> : <UserCheck className="size-5" />}
              Verify Attendance
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Branding / Footer */}
      <div className="fixed bottom-8 text-center w-full">
        <p className="text-xs text-muted-foreground font-medium opacity-50 uppercase tracking-widest">
          Tutoring System Attendance
        </p>
      </div>
    </div>
  );
}
