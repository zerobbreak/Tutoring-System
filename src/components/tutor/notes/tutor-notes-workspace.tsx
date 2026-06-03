import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { format, parseISO } from "date-fns";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTutorNotesData } from "#/components/tutor/notes/use-tutor-notes-data";
import {
  PageLoadingSpinner,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  formatClock,
  notesStatusStyles,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { updateSessionNotesFn } from "#/server-actions/tutor-notes";

export type NotesSearch = {
  claim?: string;
  focus?: number;
};

type TutorNotesWorkspaceProps = {
  claimFromSearch?: string;
  focusFromSearch?: number;
};

export function TutorNotesWorkspace({
  claimFromSearch,
  focusFromSearch,
}: TutorNotesWorkspaceProps) {
  const claimAppliedRef = useRef<string | null>(null);
  const {
    data: claims = [],
    isLoading,
    isFetching,
    error,
    refetch,
    isSuccess,
    invalidate,
  } = useTutorNotesData();
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form state
  const [draftConcepts, setDraftConcepts] = useState("");
  const [draftExamples, setDraftExamples] = useState("");
  const [draftStruggles, setDraftStruggles] = useState("");
  const [draftRevision, setDraftRevision] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftCoverageConfirmed, setDraftCoverageConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!claims.length) return;
    setSelectedId((prev) => {
      if (prev && claims.some((r) => r.id === prev)) return prev;
      return claims[0]?.id ?? null;
    });
  }, [claims]);

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
    if (!selected) return;
    setSaving(true);
    try {
      await updateSessionNotesFn({
        data: {
          claimId: selected.id,
          topicsCovered: draftConcepts,
          examplesUsed: draftExamples,
          studentStruggles: draftStruggles,
          revisionTopics: draftRevision,
          notes: draftNotes,
          coverageConfirmed: draftCoverageConfirmed,
          existingCoverageValidatedAt: selected.coverage_validated_at,
        },
      });
      void invalidate();
      toast.success("Academic workspace synced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !isSuccess) {
    return <PageLoadingSpinner label="Loading sessions…" />;
  }

  const listLoading = isFetching && !claims.length;

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

      {feedback.loadError ? (
        <QueryErrorBanner
          message={feedback.loadError}
          onRetry={feedback.onRetryLoad}
          retrying={feedback.retryingLoad}
        />
      ) : null}

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
                {listLoading ? (
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
                      <Link to={APP_PATHS.tutor.sessions}>View Sessions</Link>
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
                                notesStatusStyles(c.status),
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
