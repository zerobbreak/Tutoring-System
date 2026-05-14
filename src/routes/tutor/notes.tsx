import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Circle, Loader2, NotebookPen, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as z from "zod";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

const notesSearchSchema = z.object({
  claim: z.string().uuid().optional(),
  /** Bumped when opening notes from the schedule so re-selection works for the same claim id. */
  focus: z.coerce.number().optional(),
});

export const Route = createFileRoute("/tutor/notes")({
  validateSearch: notesSearchSchema,
  component: TutorNotesPage,
});

type ClaimStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "DISPUTED"
  | "REJECTED"
  | "VERIFIED"
  | "APPROVED";

type SessionClaimRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  notes: string | null;
  topics_covered: string | null;
  coverage_validated_at: string | null;
  module: { code: string; name: string } | null;
};

function formatClock(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

function statusStyles(status: ClaimStatus): string {
  switch (status) {
    case "VERIFIED":
    case "APPROVED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    case "PENDING_VERIFICATION":
      return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "DISPUTED":
    case "REJECTED":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

function TutorNotesPage() {
  const { claim: claimFromSearch, focus: focusFromSearch } = Route.useSearch();
  const claimAppliedRef = useRef<string | null>(null);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [claims, setClaims] = useState<SessionClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [draftNotes, setDraftNotes] = useState("");
  const [draftTopics, setDraftTopics] = useState("");
  const [draftCoverageConfirmed, setDraftCoverageConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadClaims = useCallback(async (uid: string) => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        session_date,
        start_time,
        end_time,
        hours,
        venue,
        status,
        notes,
        topics_covered,
        coverage_validated_at,
        module:modules ( code, name )
      `,
      )
      .eq("tutor_id", uid)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setClaims([]);
      setLoading(false);
      return;
    }

    type RawRow = Omit<SessionClaimRow, "module"> & {
      module: { code: string; name: string } | { code: string; name: string }[] | null;
    };
    const rows: SessionClaimRow[] = ((data ?? []) as RawRow[]).map((r) => {
      const m = r.module;
      const module =
        m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m;
      return { ...r, module };
    });
    setClaims(rows);
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    claimAppliedRef.current = null;
  }, [claimFromSearch, focusFromSearch]);

  useEffect(() => {
    if (!claimFromSearch || claims.length === 0) return;
    const token = `${claimFromSearch}:${focusFromSearch ?? 0}`;
    if (claimAppliedRef.current === token) return;
    if (!claims.some((c) => c.id === claimFromSearch)) return;
    setSelectedId(claimFromSearch);
    claimAppliedRef.current = token;
  }, [claimFromSearch, focusFromSearch, claims]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setTutorId(null);
        setLoading(false);
        return;
      }
      setTutorId(user.id);
      await loadClaims(user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClaims]);

  const selected = useMemo(
    () => claims.find((c) => c.id === selectedId) ?? null,
    [claims, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setDraftNotes("");
      setDraftTopics("");
      setDraftCoverageConfirmed(false);
      return;
    }
    setDraftNotes(selected.notes ?? "");
    setDraftTopics(selected.topics_covered ?? "");
    setDraftCoverageConfirmed(!!selected.coverage_validated_at);
  }, [selected]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    const notesMatch = draftNotes === (selected.notes ?? "");
    const topicsMatch = draftTopics === (selected.topics_covered ?? "");
    const wasConfirmed = !!selected.coverage_validated_at;
    const confirmMatch = draftCoverageConfirmed === wasConfirmed;
    return !(notesMatch && topicsMatch && confirmMatch);
  }, [selected, draftNotes, draftTopics, draftCoverageConfirmed]);

  const handleSave = async () => {
    if (!selected || !tutorId) return;
    setSaving(true);
    let nextValidatedAt: string | null = selected.coverage_validated_at;
    if (draftCoverageConfirmed && !selected.coverage_validated_at) {
      nextValidatedAt = new Date().toISOString();
    }
    if (!draftCoverageConfirmed) {
      nextValidatedAt = null;
    }

    const { error } = await supabase
      .from("session_claims")
      .update({
        notes: draftNotes.trim() === "" ? null : draftNotes.trim(),
        topics_covered: draftTopics.trim() === "" ? null : draftTopics.trim(),
        coverage_validated_at: nextValidatedAt,
      })
      .eq("id", selected.id)
      .eq("tutor_id", tutorId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setClaims((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? {
              ...c,
              notes: draftNotes.trim() === "" ? null : draftNotes.trim(),
              topics_covered:
                draftTopics.trim() === "" ? null : draftTopics.trim(),
              coverage_validated_at: nextValidatedAt,
            }
          : c,
      ),
    );
    toast.success("Session notes saved");
  };

  return (
    <div className="rise-in flex min-h-0 flex-1 flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Session notes
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every note is tied to a session claim so you can record what was
          covered, keep narrative notes, and confirm that the coverage summary
          matches what happened in that slot.
        </p>
      </div>

      {loadError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">
              Could not load sessions
            </CardTitle>
            <CardDescription className="text-destructive/90">
              {loadError}. If this persists, ensure the latest migration is
              applied and your account is linked in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                public.users
              </code>{" "}
              with RLS policies.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card className="flex min-h-[280px] flex-col overflow-hidden lg:min-h-[420px]">
          <CardHeader className="shrink-0 border-b border-border pb-4">
            <CardTitle className="text-base">Your sessions</CardTitle>
            <CardDescription>
              Newest first. Select a row to edit notes for that session.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <NotebookPen className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No session claims yet. When you log teaching sessions, they
                  will appear here for notes and coverage tracking.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/tutor/sessions">Open sessions</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {claims.map((c) => {
                  const active = c.id === selectedId;
                  const mod = c.module;
                  const label = mod
                    ? `${mod.code} · ${mod.name}`
                    : "Unknown module";
                  const dateStr = (() => {
                    try {
                      return format(parseISO(c.session_date), "d MMM yyyy");
                    } catch {
                      return c.session_date;
                    }
                  })();
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                          active
                            ? "bg-[var(--lagoon-deep)]/10"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {label}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              statusStyles(c.status),
                            )}
                          >
                            {c.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{dateStr}</span>
                          <span aria-hidden>·</span>
                          <span>
                            {formatClock(c.start_time)}–{formatClock(c.end_time)}
                          </span>
                          {c.coverage_validated_at && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="size-3.5 shrink-0" />
                                Coverage OK
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[280px] flex-col overflow-hidden lg:min-h-[420px]">
          {!selected ? (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              Select a session from the list to add or edit notes.
            </CardContent>
          ) : (
            <>
              <CardHeader className="shrink-0 border-b border-border pb-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-snug">
                      {selected.module
                        ? `${selected.module.code} — ${selected.module.name}`
                        : "Session"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {(() => {
                        try {
                          return format(
                            parseISO(selected.session_date),
                            "EEEE, d MMMM yyyy",
                          );
                        } catch {
                          return selected.session_date;
                        }
                      })()}{" "}
                      · {formatClock(selected.start_time)}–
                      {formatClock(selected.end_time)}
                      {selected.venue ? ` · ${selected.venue}` : ""}
                    </CardDescription>
                  </div>
                  {selected.coverage_validated_at && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="size-3.5" />
                      Validated{" "}
                      {format(
                        parseISO(selected.coverage_validated_at),
                        "d MMM yyyy, HH:mm",
                      )}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="topics-covered">What was covered</Label>
                  <p className="text-xs text-muted-foreground">
                    List topics, sections, or exercises you addressed so there is
                    a clear record tied to this date and time.
                  </p>
                  <textarea
                    id="topics-covered"
                    value={draftTopics}
                    onChange={(e) => setDraftTopics(e.target.value)}
                    rows={4}
                    placeholder="e.g. Ch 4 recursion, past paper Q2–5, revision of Big-O for sorting"
                    className={cn(
                      "w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
                      "placeholder:text-muted-foreground",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="session-notes">Additional notes</Label>
                  <p className="text-xs text-muted-foreground">
                    Student progress, homework, issues, or anything else useful
                    for you or coordinators.
                  </p>
                  <textarea
                    id="session-notes"
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    rows={5}
                    placeholder="Optional longer notes…"
                    className={cn(
                      "w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
                      "placeholder:text-muted-foreground",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                    )}
                  />
                </div>

                <Separator />

                <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                    checked={draftCoverageConfirmed}
                    onChange={(e) =>
                      setDraftCoverageConfirmed(e.target.checked)
                    }
                  />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {draftCoverageConfirmed ? (
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      I confirm the &quot;what was covered&quot; summary is
                      accurate for this session
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Turning this on records a timestamp when you save.
                      Uncheck and save to clear validation if you need to correct
                      the summary.
                    </span>
                  </span>
                </label>
              </CardContent>
              <CardFooter className="shrink-0 border-t border-border pt-4">
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !dirty}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save for this session
                </Button>
                {!dirty && (
                  <span className="ml-3 text-xs text-muted-foreground">
                    No unsaved changes
                  </span>
                )}
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
