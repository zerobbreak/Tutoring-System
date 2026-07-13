import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Loader2,
  QrCode,
  ShieldCheck,
  UserCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { StudentCardScanner } from "#/components/tutor/attendance/student-card-scanner";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
import { Separator } from "#/components/ui/separator";
import { parseStudentCardPayload } from "#/lib/student-card-payload";
import { cn } from "#/lib/utils";
import { toast } from "#/lib/toast";
import {
  checkInStudentFn,
  getCheckInSessionPreviewFn,
} from "#/server-actions/tutor-sessions";
import type { CheckInSessionPreview } from "#/server-actions/tutor-sessions/student-roster";

export const Route = createFileRoute("/student/check-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
    session: (search.session as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Mark attendance" }],
  }),
  component: StudentCheckInPage,
});

function CheckInShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-(--bg-base) font-sans text-(--sea-ink)">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 size-80 rounded-full bg-(--hero-a) blur-3xl" />
        <div className="absolute -right-16 bottom-0 size-96 rounded-full bg-(--hero-b) blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--foam)_0%,transparent_55%)]" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        <header className="border-b border-(--line) bg-(--header-bg) px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-(--lagoon-deep)/15 text-(--lagoon-deep)">
              <QrCode className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--kicker)">
                Attendance
              </p>
              <p className="truncate font-display text-lg font-semibold tracking-tight">
                Mark attendance
              </p>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-lg">{children}</div>
        </main>

        <footer className="border-t border-(--line)/60 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-(--sea-ink-soft)">
            Tutoring system · secure QR attendance
          </p>
        </footer>
      </div>
    </div>
  );
}

function AlertBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
    >
      <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

function SessionPreviewCard({
  loading,
  preview,
}: {
  loading: boolean;
  preview: CheckInSessionPreview | null;
}) {
  return (
    <Card className="overflow-hidden border-(--lagoon-deep)/25 bg-(--surface-strong) shadow-md shadow-(--lagoon-deep)/5">
      <div className="h-1 bg-linear-to-r from-(--lagoon) via-(--lagoon-deep) to-(--palm)" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-(--sea-ink)">
            Your session
          </CardTitle>
          <Badge
            variant="outline"
            className="gap-1 border-(--lagoon-deep)/30 bg-(--lagoon-deep)/5 text-[10px] text-(--lagoon-deep)"
          >
            <ShieldCheck className="size-3" aria-hidden />
            Verified link
          </Badge>
        </div>
        <CardDescription className="text-(--sea-ink-soft)">
          Confirm this is the class you attended, then mark yourself present.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-(--lagoon-deep)" />
            Loading session details…
          </div>
        ) : preview ? (
          <ul className="space-y-3">
            <SessionDetailRow
              icon={BookOpen}
              label="Module"
              value={
                preview.moduleName
                  ? `${preview.moduleCode} · ${preview.moduleName}`
                  : preview.moduleCode
              }
            />
            <SessionDetailRow
              icon={CalendarDays}
              label="When"
              value={preview.sessionWhen}
            />
            {preview.tutorName ? (
              <SessionDetailRow
                icon={UserRound}
                label="Tutor"
                value={preview.tutorName}
              />
            ) : null}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Session details unavailable.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SessionDetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-(--line)/80 bg-(--foam)/80 px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10 text-(--lagoon-deep)">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
          {label}
        </p>
        <p className="text-sm font-medium leading-snug text-(--sea-ink)">
          {value}
        </p>
      </div>
    </li>
  );
}

function StudentCheckInPage() {
  const { token, session: sessionId } = Route.useSearch();
  const [fullName, setFullName] = useState("");
  const [studentReference, setStudentReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionPreview, setSessionPreview] =
    useState<CheckInSessionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !sessionId) {
      setSessionPreview(null);
      setPreviewLoading(false);
      setPreviewError("This attendance link is missing required parameters.");
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    void getCheckInSessionPreviewFn({
      data: { token, sessionId },
    })
      .then((preview) => {
        if (!cancelled) setSessionPreview(preview);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Could not load session";
          setPreviewError(msg);
          setSessionPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  const submitCheckIn = async ({
    fullName: incomingFullName,
    studentReference: incomingStudentReference,
    email: incomingEmail,
  }: {
    fullName: string;
    studentReference: string;
    email: string;
  }) => {
    const trimmedFullName = incomingFullName.trim();
    const trimmedStudentReference = incomingStudentReference.trim();
    const trimmedEmail = incomingEmail.trim();

    if (!trimmedFullName || !trimmedStudentReference) {
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
          fullName: trimmedFullName,
          studentReference: trimmedStudentReference,
          email: trimmedEmail || undefined,
        },
      });
      setSuccess(result.studentName);
      toast.success(
        result.registered
          ? `Welcome, ${result.studentName}! You are registered and marked present.`
          : `You are marked present. Welcome, ${result.studentName}.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not mark attendance";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCheckIn({ fullName, studentReference, email });
  };

  const handleCardScan = async (payload: string) => {
    try {
      const card = parseStudentCardPayload(payload);
      const nextFullName = card.fullName?.trim() ?? "";
      const nextStudentReference = card.studentReference.trim();
      const nextEmail = card.email?.trim() ?? "";

      setStudentReference(nextStudentReference);
      setFullName(nextFullName);
      setEmail(nextEmail);

      if (!nextFullName || !nextStudentReference) {
        setError("The card was scanned, but it is missing the required details. Please complete the form and submit.");
        toast.error("The card is missing the required details. Please complete the form and submit.");
        return;
      }

      await submitCheckIn({
        fullName: nextFullName,
        studentReference: nextStudentReference,
        email: nextEmail,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not read the card.";
      setError(msg);
      toast.error(msg);
    }
  };

  const formDisabled =
    loading || previewLoading || !!previewError || !token || !sessionId;
  const bannerMessage = previewError ?? error;

  if (success) {
    return (
      <CheckInShell>
        <Card className="rise-in overflow-hidden border-emerald-500/30 bg-(--surface-strong) shadow-lg shadow-emerald-500/10">
          <div className="h-1 bg-linear-to-r from-emerald-400 via-emerald-500 to-(--lagoon)" />
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/10">
              <CheckCircle2 className="size-11 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <CardTitle className="display-title text-2xl font-bold text-(--sea-ink)">
                You&apos;re marked present
              </CardTitle>
              <CardDescription className="text-base text-(--sea-ink-soft)">
                Welcome,{" "}
                <span className="font-semibold text-(--sea-ink)">
                  {success}
                </span>
                . Your attendance is recorded.
              </CardDescription>
            </div>
          </CardHeader>
          {sessionPreview ? (
            <CardContent className="px-6 pb-2">
              <div className="rounded-xl border border-(--line) bg-(--foam)/60 px-4 py-3 text-center text-sm text-(--sea-ink-soft)">
                <span className="font-medium text-(--sea-ink)">
                  {sessionPreview.moduleCode}
                </span>
                {sessionPreview.moduleName
                  ? ` · ${sessionPreview.moduleName}`
                  : null}
                <span className="mx-2 text-(--line)">·</span>
                {sessionPreview.sessionWhen}
              </div>
            </CardContent>
          ) : null}
          <CardFooter className="flex flex-col gap-2 pb-8 pt-4">
            <Button
              variant="outline"
              className="w-full border-(--line)"
              onClick={() => window.close()}
            >
              Close this window
            </Button>
          </CardFooter>
        </Card>
      </CheckInShell>
    );
  }

  return (
    <CheckInShell>
      <div className="rise-in flex flex-col gap-5">
        <SessionPreviewCard loading={previewLoading} preview={sessionPreview} />

        <Card className="border-(--line) bg-(--surface-strong) shadow-lg shadow-black/5">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="display-title text-xl font-bold text-(--sea-ink)">
              Your details
            </CardTitle>
            <CardDescription className="text-(--sea-ink-soft)">
              First time here? We&apos;ll register you, then mark you present.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleCheckIn}>
            <CardContent className="space-y-4">
              {bannerMessage ? <AlertBanner message={bannerMessage} /> : null}

              <div className="rounded-xl border border-(--line)/70 bg-(--foam)/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-(--sea-ink)">
                      Scan from your phone
                    </p>
                    <p className="text-xs text-(--sea-ink-soft)">
                      Open this link on your phone and scan the student card to
                      fill your details.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-(--lagoon-deep)/25 bg-(--lagoon-deep)/10 text-[10px] text-(--lagoon-deep)"
                  >
                    Mobile ready
                  </Badge>
                </div>
                <div className="mt-4">
                  <StudentCardScanner
                    enabled={Boolean(token && sessionId && !previewError)}
                    busy={loading}
                    onScan={handleCardScan}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-(--sea-ink)">
                  Full name
                </Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={formDisabled}
                  autoFocus
                  autoComplete="name"
                  className="h-11 border-(--line) bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentReference" className="text-(--sea-ink)">
                  Student number
                </Label>
                <Input
                  id="studentReference"
                  placeholder="e.g. STU12345"
                  value={studentReference}
                  onChange={(e) => setStudentReference(e.target.value)}
                  disabled={formDisabled}
                  autoComplete="off"
                  className="h-11 border-(--line) bg-background"
                />
                <p className="text-xs text-(--sea-ink-soft)">
                  Your official student ID at this campus.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-(--sea-ink)">
                  Email{" "}
                  <span className="font-normal text-(--sea-ink-soft)">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formDisabled}
                  autoComplete="email"
                  className="h-11 border-(--line) bg-background"
                />
              </div>
            </CardContent>

            <Separator className="bg-(--line)" />

            <CardFooter className="flex-col gap-3 pt-6">
              <Button
                type="submit"
                size="lg"
                className={cn(
                  "h-12 w-full gap-2 text-base font-semibold shadow-lg",
                  "bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90",
                  "shadow-(--lagoon-deep)/25",
                )}
                disabled={formDisabled}
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <UserCheck className="size-5" />
                )}
                Mark present
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-(--sea-ink-soft)">
                You confirm you attended this session only.
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </CheckInShell>
  );
}
