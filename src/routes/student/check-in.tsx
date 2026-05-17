import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, QrCode, UserCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
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
  const [fullName, setFullName] = useState("");
  const [studentReference, setStudentReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !studentReference.trim()) {
      toast.error("Please enter your full name and student number.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await checkInStudentFn({
        data: {
          token,
          sessionId,
          fullName: fullName.trim(),
          studentReference: studentReference.trim(),
          email: email.trim() || undefined,
        },
      });
      setSuccess(result.studentName);
      toast.success(
        result.registered
          ? `Welcome, ${result.studentName}! You are registered and checked in.`
          : `Check-in successful! Welcome, ${result.studentName}.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="rise-in w-full max-w-md border-emerald-500/20 bg-emerald-500/[0.02]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-10" />
            </div>
            <CardTitle className="font-display text-2xl">Check-in complete</CardTitle>
            <CardDescription className="text-lg">
              Welcome,{" "}
              <span className="font-semibold text-foreground">{success}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            Your attendance has been recorded for this session. You can close this
            window when you are done.
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.close()}>
              Close window
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4 font-sans">
      <Card className="rise-in w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-lagoon-deep/10 text-lagoon-deep">
            <QrCode className="size-6" />
          </div>
          <CardTitle className="font-display text-2xl font-bold">
            Session check-in
          </CardTitle>
          <CardDescription>
            Enter your details to register and confirm attendance. Your institution
            is set automatically from this session.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCheckIn}>
          <CardContent className="space-y-4">
            {error ? (
              <div className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600">
                <XCircle className="size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="e.g. Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                autoFocus
                autoComplete="name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentReference">Student number</Label>
              <Input
                id="studentReference"
                placeholder="e.g. STU12345"
                value={studentReference}
                onChange={(e) => setStudentReference(e.target.value)}
                disabled={loading}
                autoComplete="off"
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Your official student ID at this campus.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Session</span>
                <span className="font-mono text-[10px] opacity-60">
                  {sessionId ? `${sessionId.slice(0, 8)}…` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Verification</span>
                <Badge
                  variant="outline"
                  className="h-4 bg-background px-1.5 text-[9px]"
                >
                  Secure QR token
                </Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="h-12 w-full gap-2 bg-lagoon-deep text-base font-semibold shadow-lg shadow-lagoon-deep/20 hover:bg-lagoon-deep/90"
              disabled={loading || !token || !sessionId}
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <UserCheck className="size-5" />
              )}
              Register & check in
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="fixed bottom-8 w-full text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground opacity-50">
          Tutoring system attendance
        </p>
      </div>
    </div>
  );
}
