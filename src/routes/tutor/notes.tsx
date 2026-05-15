import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  MessageSquare,
  NotebookPen,
  Save,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
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
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
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
  examples_used: string | null;
  student_struggles: string | null;
  revision_topics: string | null;
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

  // Form state
  const [draftConcepts, setDraftConcepts] = useState("");
  const [draftExamples, setDraftExamples] = useState("");
  const [draftStruggles, setDraftStruggles] = useState("");
  const [draftRevision, setDraftRevision] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
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
        examples_used,
        student_struggles,
        revision_topics,
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
      setDraftConcepts("");
      setDraftExamples("");
      setDraftStruggles("");
      setDraftRevision("");
      setDraftNotes("");
      setDraftCoverageConfirmed(false);
      return;
    }
    setDraftConcepts(selected.topics_covered ?? "");
    setDraftExamples(selected.examples_used ?? "");
    setDraftStruggles(selected.student_struggles ?? "");
    setDraftRevision(selected.revision_topics ?? "");
    setDraftNotes(selected.notes ?? "");
    setDraftCoverageConfirmed(!!selected.coverage_validated_at);
  }, [selected]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    return (
      draftConcepts !== (selected.topics_covered ?? "") ||
      draftExamples !== (selected.examples_used ?? "") ||
      draftStruggles !== (selected.student_struggles ?? "") ||
      draftRevision !== (selected.revision_topics ?? "") ||
      draftNotes !== (selected.notes ?? "") ||
      draftCoverageConfirmed !== !!selected.coverage_validated_at
    );
  }, [selected, draftConcepts, draftExamples, draftStruggles, draftRevision, draftNotes, draftCoverageConfirmed]);

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
        topics_covered: draftConcepts.trim() === "" ? null : draftConcepts.trim(),
        examples_used: draftExamples.trim() === "" ? null : draftExamples.trim(),
        student_struggles: draftStruggles.trim() === "" ? null : draftStruggles.trim(),
        revision_topics: draftRevision.trim() === "" ? null : draftRevision.trim(),
        notes: draftNotes.trim() === "" ? null : draftNotes.trim(),
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
              topics_covered: draftConcepts.trim() === "" ? null : draftConcepts.trim(),
              examples_used: draftExamples.trim() === "" ? null : draftExamples.trim(),
              student_struggles: draftStruggles.trim() === "" ? null : draftStruggles.trim(),
              revision_topics: draftRevision.trim() === "" ? null : draftRevision.trim(),
              notes: draftNotes.trim() === "" ? null : draftNotes.trim(),
              coverage_validated_at: nextValidatedAt,
            }
          : c,
      ),
    );
    toast.success("Academic workspace synced");
  };

  return (
    <div className="rise-in flex min-h-0 flex-1 flex-col gap-6 p-1 md:p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-5 text-[var(--lagoon-deep)]" />
            <h2 className="display-title text-2xl font-bold tracking-tight text-[var(--sea-ink)]">
              Academic Productivity Workspace
            </h2>
          </div>
          <p className="max-w-2xl text-sm text-[var(--sea-ink-soft)]">
            Record session metrics, reflect on student progress, and leverage AI insights to optimize your tutoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="animate-pulse text-xs font-medium text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="island-shell bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon-deep)]/90"
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Sync Workspace
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">
              Workspace load failed
            </CardTitle>
            <CardDescription className="text-destructive/90">
              {loadError}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Sidebar: Session History */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
              <History className="size-4" />
              Session History
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              {claims.length} Sessions
            </span>
          </div>
          <div className="island-shell flex flex-1 flex-col overflow-hidden rounded-2xl border-white/40 bg-white/40 backdrop-blur-md dark:bg-black/20">
            <ScrollArea className="flex-1">
              <div className="px-1 py-2">
                {loading ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : claims.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                    <div className="rounded-full bg-[var(--lagoon)]/10 p-4">
                      <NotebookPen className="size-8 text-[var(--lagoon)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--sea-ink-soft)]">
                      No sessions found. Log your first session to begin.
                    </p>
                    <Button variant="outline" size="sm" asChild className="mt-2">
                      <Link to="/tutor/sessions">View Sessions</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/20">
                    {claims.map((c) => {
                      const active = c.id === selectedId;
                      const mod = c.module;
                      const dateStr = (() => {
                        try {
                          return format(parseISO(c.session_date), "MMM d, yyyy");
                        } catch {
                          return c.session_date;
                        }
                      })();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            "group flex w-full flex-col gap-2 p-4 text-left transition-all",
                            active
                              ? "bg-white/60 dark:bg-white/5"
                              : "hover:bg-white/30 dark:hover:bg-white/5",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="block text-[10px] font-bold tracking-widest text-[var(--lagoon-deep)] uppercase">
                                {mod?.code ?? "SESSION"}
                              </span>
                              <span className="line-clamp-1 text-sm font-semibold text-[var(--sea-ink)]">
                                {mod?.name ?? "Independent Study"}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter",
                                statusStyles(c.status),
                              )}
                            >
                              {c.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--sea-ink-soft)]">
                              <span className="flex items-center gap-1">
                                {dateStr}
                              </span>
                              <span className="size-1 rounded-full bg-border" />
                              <span>
                                {formatClock(c.start_time)}–{formatClock(c.end_time)}
                              </span>
                            </div>
                            <ChevronRight className={cn(
                              "size-4 transition-transform",
                              active ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                            )} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {!selected ? (
            <div className="island-shell flex flex-1 flex-col items-center justify-center rounded-3xl border-dashed bg-white/20 p-12 text-center backdrop-blur-sm">
              <Sparkles className="mb-4 size-12 text-[var(--lagoon)]/40" />
              <h4 className="text-lg font-semibold text-[var(--sea-ink)]">Ready to reflect?</h4>
              <p className="max-w-xs text-sm text-[var(--sea-ink-soft)]">
                Select a session from the history to open your academic workspace and start documenting.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <Tabs defaultValue="reflection" className="flex flex-1 flex-col">
                <div className="mb-4 flex items-center justify-between px-1">
                  <TabsList className="h-10 rounded-full bg-white/40 p-1 backdrop-blur-md dark:bg-white/5">
                    <TabsTrigger
                      value="reflection"
                      className="rounded-full px-6 data-[state=active]:bg-[var(--lagoon-deep)] data-[state=active]:text-white"
                    >
                      <NotebookPen className="mr-2 size-4" />
                      Session Reflection
                    </TabsTrigger>
                    <TabsTrigger
                      value="ai-insights"
                      className="rounded-full px-6 data-[state=active]:bg-[var(--lagoon-deep)] data-[state=active]:text-white"
                    >
                      <Sparkles className="mr-2 size-4" />
                      AI Insights
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="hidden items-center gap-2 lg:flex">
                     {selected.coverage_validated_at && (
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          COVERAGE VERIFIED
                        </div>
                      )}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="reflection" className="m-0 h-full">
                    <div className="grid h-full gap-6 lg:grid-cols-2">
                      {/* Section: Coverage & Reflection */}
                      <div className="island-shell flex flex-col overflow-hidden rounded-3xl border-white/60 bg-white/60 p-6 shadow-xl backdrop-blur-xl dark:bg-black/30">
                        <div className="mb-6 flex items-center gap-2">
                          <div className="rounded-lg bg-[var(--lagoon)]/10 p-2">
                            <BookOpen className="size-5 text-[var(--lagoon)]" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[var(--sea-ink)]">Knowledge Capture</h4>
                            <p className="text-[10px] font-bold tracking-widest text-[var(--sea-ink-soft)] uppercase">The Core Pillars</p>
                          </div>
                        </div>

                        <ScrollArea className="flex-1 pr-4">
                          <div className="space-y-6 pt-1 pb-4">
                            <div className="space-y-2">
                              <Label htmlFor="concepts" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--sea-ink)]">
                                <Target className="size-3.5" />
                                Concepts Covered
                              </Label>
                              <textarea
                                id="concepts"
                                value={draftConcepts}
                                onChange={(e) => setDraftConcepts(e.target.value)}
                                placeholder="Key academic themes addressed today..."
                                className="min-h-[80px] w-full resize-none rounded-2xl border-white/50 bg-white/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-[var(--lagoon)] focus:ring-4 focus:ring-[var(--lagoon)]/10 dark:bg-black/20"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="examples" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--sea-ink)]">
                                <Lightbulb className="size-3.5" />
                                Examples & Exercises
                              </Label>
                              <textarea
                                id="examples"
                                value={draftExamples}
                                onChange={(e) => setDraftExamples(e.target.value)}
                                placeholder="Specific problems or real-world cases used..."
                                className="min-h-[80px] w-full resize-none rounded-2xl border-white/50 bg-white/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-[var(--lagoon)] focus:ring-4 focus:ring-[var(--lagoon)]/10 dark:bg-black/20"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="struggles" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--sea-ink)]">
                                <HelpCircle className="size-3.5" />
                                Student Struggles
                              </Label>
                              <textarea
                                id="struggles"
                                value={draftStruggles}
                                onChange={(e) => setDraftStruggles(e.target.value)}
                                placeholder="Where did they face friction? Any blockers?"
                                className="min-h-[80px] w-full resize-none rounded-2xl border-white/50 bg-white/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-[var(--lagoon)] focus:ring-4 focus:ring-[var(--lagoon)]/10 dark:bg-black/20"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="revision" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--sea-ink)]">
                                <Zap className="size-3.5" />
                                Revision Topics
                              </Label>
                              <textarea
                                id="revision"
                                value={draftRevision}
                                onChange={(e) => setDraftRevision(e.target.value)}
                                placeholder="What should they review before next time?"
                                className="min-h-[80px] w-full resize-none rounded-2xl border-white/50 bg-white/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-[var(--lagoon)] focus:ring-4 focus:ring-[var(--lagoon)]/10 dark:bg-black/20"
                              />
                            </div>
                          </div>
                        </ScrollArea>
                      </div>

                      {/* Section: Narrative Notes & Validation */}
                      <div className="flex flex-col gap-6">
                        <div className="island-shell flex flex-1 flex-col rounded-3xl border-white/60 bg-white/60 p-6 shadow-xl backdrop-blur-xl dark:bg-black/30">
                          <div className="mb-6 flex items-center gap-2">
                            <div className="rounded-lg bg-indigo-500/10 p-2">
                              <FileText className="size-5 text-indigo-500" />
                            </div>
                            <div>
                              <h4 className="font-bold text-[var(--sea-ink)]">Personal Notes</h4>
                              <p className="text-[10px] font-bold tracking-widest text-[var(--sea-ink-soft)] uppercase">Narrative Context</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-1 flex-col gap-4">
                            <textarea
                              id="notes"
                              value={draftNotes}
                              onChange={(e) => setDraftNotes(e.target.value)}
                              placeholder="Any additional context, behavior observations, or coordinator notes..."
                              className="w-full flex-1 resize-none rounded-2xl border-white/50 bg-white/50 px-4 py-3 text-sm shadow-inner transition-all focus:border-[var(--lagoon)] focus:ring-4 focus:ring-[var(--lagoon)]/10 dark:bg-black/20"
                            />
                            
                            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/40 bg-white/40 p-4 transition-all hover:bg-white/60">
                              <div className="mt-1 flex items-center">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded-full border-2 border-[var(--lagoon)] accent-[var(--lagoon)]"
                                  checked={draftCoverageConfirmed}
                                  onChange={(e) => setDraftCoverageConfirmed(e.target.checked)}
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-sm font-bold text-[var(--sea-ink)]">
                                  Verify Knowledge Capture
                                </span>
                                <p className="text-[11px] leading-relaxed text-[var(--sea-ink-soft)]">
                                  By checking this, you confirm the structured data above accurately reflects the session's academic delivery.
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="ai-insights" className="m-0 h-full">
                    <div className="grid h-full gap-6 lg:grid-cols-3">
                      <Card className="island-shell flex flex-col justify-between border-dashed border-[var(--lagoon)]/30 bg-white/40 p-6 backdrop-blur-md">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-orange-500/10 p-2">
                              <Sparkles className="size-6 text-orange-500" />
                            </div>
                            <h4 className="text-lg font-bold">Session Summary</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Automatically generate a concise summary of the concepts, examples, and struggles captured in this session.
                          </p>
                        </div>
                        <Button variant="outline" className="mt-6 rounded-full border-[var(--lagoon)]/40 text-[var(--lagoon-deep)]" disabled>
                          Generate with AI
                        </Button>
                      </Card>

                      <Card className="island-shell flex flex-col justify-between border-dashed border-[var(--lagoon)]/30 bg-white/40 p-6 backdrop-blur-md">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-blue-500/10 p-2">
                              <Brain className="size-6 text-blue-500" />
                            </div>
                            <h4 className="text-lg font-bold">Concept Explainer</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Draft simplified explanations or analogies for the core concepts to share with your student.
                          </p>
                        </div>
                        <Button variant="outline" className="mt-6 rounded-full border-[var(--lagoon)]/40 text-[var(--lagoon-deep)]" disabled>
                          Coming Soon
                        </Button>
                      </Card>

                      <div className="grid grid-rows-3 gap-4">
                        <div className="island-shell flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3 backdrop-blur-md">
                          <div className="flex items-center gap-3">
                            <Zap className="size-4 text-yellow-500" />
                            <span className="text-sm font-bold">Flashcard Deck</span>
                          </div>
                          <Sparkles className="size-4 text-muted-foreground/40" />
                        </div>
                        <div className="island-shell flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3 backdrop-blur-md">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="size-4 text-emerald-500" />
                            <span className="text-sm font-bold">Quiz Generation</span>
                          </div>
                          <Sparkles className="size-4 text-muted-foreground/40" />
                        </div>
                        <div className="island-shell flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3 backdrop-blur-md">
                          <div className="flex items-center gap-3">
                            <Target className="size-4 text-rose-500" />
                            <span className="text-sm font-bold">Revision Plan</span>
                          </div>
                          <Sparkles className="size-4 text-muted-foreground/40" />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
