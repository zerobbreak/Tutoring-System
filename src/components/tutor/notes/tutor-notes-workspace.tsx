import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ChevronRight, Eye, Lock, NotebookPen } from "lucide-react";
import { useMemo, useState } from "react";
import { useTutorNotesData } from "#/components/tutor/notes/use-tutor-notes-data";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  PageLoadingSpinner,
  QueryEmptyState,
  QueryErrorBanner,
} from "#/components/ui/query-fetch-feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { APP_PATHS } from "#/lib/app-paths";
import { formatQueryError } from "#/lib/query-error";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
} from "#/lib/session-claim-display";
import { hasSessionEnded } from "#/lib/session-kanban-column";
import { cn } from "#/lib/utils";
import type { TutorNotesClaimDTO } from "#/server-actions/tutor-notes";

type NotesFilter = "all" | "missing";

/** Ended draft sessions with no "what we covered" — these block submit. */
function needsNotes(c: TutorNotesClaimDTO, now: Date): boolean {
  return (
    c.status === "DRAFT" &&
    !c.topics_covered?.trim() &&
    hasSessionEnded(now, c.session_date, c.start_time, c.end_time)
  );
}

/** Read-only history of session notes; editing happens in the session's Notes tab. */
export function TutorNotesWorkspace() {
  const query = useTutorNotesData();
  const claims = query.data ?? [];
  const [moduleId, setModuleId] = useState("all");
  const [filter, setFilter] = useState<NotesFilter>("all");
  const now = useMemo(() => new Date(), [query.dataUpdatedAt]);

  const modules = useMemo(() => {
    const byId = new Map<string, { id: string; code: string; name: string }>();
    for (const c of claims) if (c.module) byId.set(c.module.id, c.module);
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [claims]);

  const missingCount = useMemo(
    () => claims.filter((c) => needsNotes(c, now)).length,
    [claims, now],
  );

  const visible = useMemo(
    () =>
      claims.filter((c) => {
        if (moduleId !== "all" && c.module?.id !== moduleId) return false;
        if (filter === "missing") return needsNotes(c, now);
        // History shows sessions that have happened or already have notes.
        return (
          hasSessionEnded(now, c.session_date, c.start_time, c.end_time) ||
          !!c.topics_covered?.trim()
        );
      }),
    [claims, moduleId, filter, now],
  );

  if (query.isLoading) {
    return <PageLoadingSpinner label="Loading notes…" />;
  }

  return (
    <div className="rise-in flex min-h-0 flex-1 flex-col gap-5 p-1 md:p-2">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <NotebookPen className="size-5 text-lagoon-deep" aria-hidden />
          Session notes
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          What you covered, where students struggled, and what to review. Your lecturer sees the shared
          notes on submitted claims. Open a session to add or edit its notes.
        </p>
      </div>

      {query.error ? (
        <QueryErrorBanner
          message={formatQueryError(query.error) ?? "Could not load notes."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={moduleId} onValueChange={setModuleId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.code} — {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={filter === "all" ? "secondary" : "ghost"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "missing" ? "secondary" : "ghost"}
            onClick={() => setFilter("missing")}
            className="gap-1.5"
          >
            Add notes
            {missingCount > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-100">
                {missingCount}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <QueryEmptyState
          description={
            filter === "missing"
              ? "Every finished session has notes. Nothing is blocking a submit."
              : "Notes from your sessions will appear here once sessions have taken place."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <NotesHistoryRow key={c.id} claim={c} missing={needsNotes(c, now)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotesHistoryRow({
  claim,
  missing,
}: {
  claim: TutorNotesClaimDTO;
  missing: boolean;
}) {
  const fields = [
    { label: "What we covered", value: claim.topics_covered },
    { label: "Where students struggled", value: claim.student_struggles },
    { label: "What to review", value: claim.revision_topics },
  ].filter((f) => f.value?.trim());

  return (
    <li
      className={cn(
        "rounded-lg border border-border/70 bg-card p-4 shadow-sm",
        missing && "border-amber-500/40 bg-amber-500/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {claim.module?.code ? (
              <span className="rounded bg-lagoon/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-lagoon-deep uppercase">
                {claim.module.code}
              </span>
            ) : null}
            <Badge variant={claimBadgeVariant(claim.status)} className="px-1.5 py-0 text-[10px]">
              {claimBadgeLabel(claim.status)}
            </Badge>
            {claim.seen_by_lecturer_at ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                <Eye className="size-3" aria-hidden />
                Seen by lecturer
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {format(parseISO(`${claim.session_date}T12:00:00`), "EEE d MMM yyyy")} ·{" "}
            {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {claim.module?.name ?? "Unknown module"}
          </p>
        </div>
        <Button size="sm" variant={missing ? "default" : "outline"} className="gap-1" asChild>
          <Link
            to={APP_PATHS.tutor.sessions}
            search={{ claim: claim.id, tab: "notes" }}
          >
            {missing ? "Add notes" : "Open"}
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      {fields.length ? (
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[11px] font-semibold text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : missing ? (
        <p className="mt-3 text-xs text-amber-900 dark:text-amber-100">
          No notes yet — this claim can't be submitted until you add what you covered.
        </p>
      ) : null}

      {claim.private_note ? (
        <details className="mt-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Private note
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{claim.private_note}</p>
        </details>
      ) : null}
    </li>
  );
}
