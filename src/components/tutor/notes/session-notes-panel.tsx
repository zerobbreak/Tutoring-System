import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Eye, History, Lock, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
  EMPTY_SHARED_NOTES,
  noteTextareaClass,
  SessionSharedNotesFields,
  sharedNotesDirty,
  sharedNotesDraftFrom,
  type SharedNotesDraft,
} from "#/components/tutor/notes/session-shared-notes-fields";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { Skeleton } from "#/components/ui/skeleton";
import { formatQueryError } from "#/lib/query-error";
import { queryKeys } from "#/lib/query-keys";
import { toast } from "#/lib/toast";
import {
  getSessionNotesFn,
  savePrivateSessionNoteFn,
  SESSION_NOTE_MAX_LENGTH,
  updateSessionNotesFn,
} from "#/server-actions/tutor-notes";

/** Invalidate everything that shows a session's notes. */
export function invalidateSessionNotes(
  queryClient: ReturnType<typeof useQueryClient>,
  claimId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.sessionNotes(claimId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.notesClaims }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.sessionClaims }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.dashboard }),
  ]);
}

/** Notes tab of the session window: shared notes, private note, last session's follow-ups. */
export function SessionNotesPanel({ claimId }: { claimId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.tutor.sessionNotes(claimId),
    queryFn: () => getSessionNotesFn({ data: { claimId } }),
  });
  const notes = query.data;

  const saved = notes ? sharedNotesDraftFrom(notes) : EMPTY_SHARED_NOTES;
  const [shared, setShared] = useState<SharedNotesDraft>(EMPTY_SHARED_NOTES);
  const [privateNote, setPrivateNote] = useState("");
  const [savingShared, setSavingShared] = useState(false);
  const [savingPrivate, setSavingPrivate] = useState(false);

  useEffect(() => {
    if (!notes) return;
    setShared(sharedNotesDraftFrom(notes));
    setPrivateNote(notes.private_note ?? "");
  }, [notes]);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!notes) {
    return (
      <QueryErrorBanner
        message={formatQueryError(query.error) ?? "Could not load notes."}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const sharedChanged = sharedNotesDirty(shared, saved);
  const privateChanged = privateNote !== (notes.private_note ?? "");

  const saveShared = async () => {
    setSavingShared(true);
    try {
      await updateSessionNotesFn({ data: { claimId, ...shared } });
      await invalidateSessionNotes(queryClient, claimId);
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save notes");
    } finally {
      setSavingShared(false);
    }
  };

  const savePrivate = async () => {
    setSavingPrivate(true);
    try {
      await savePrivateSessionNoteFn({ data: { claimId, body: privateNote } });
      await invalidateSessionNotes(queryClient, claimId);
      toast.success("Private note saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setSavingPrivate(false);
    }
  };

  const prev = notes.previous;

  return (
    <div className="space-y-4 text-sm">
      {prev ? (
        <div className="rounded-lg border border-lagoon/30 bg-lagoon/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-lagoon-deep">
            <History className="size-3.5" aria-hidden />
            From your last session ·{" "}
            {format(parseISO(`${prev.session_date}T12:00:00`), "d MMM")}
          </p>
          {prev.student_struggles ? (
            <p className="mt-2 whitespace-pre-wrap text-foreground">
              <span className="text-muted-foreground">Struggled with: </span>
              {prev.student_struggles}
            </p>
          ) : null}
          {prev.revision_topics ? (
            <p className="mt-1 whitespace-pre-wrap text-foreground">
              <span className="text-muted-foreground">To review: </span>
              {prev.revision_topics}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border/70 bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Shared with your lecturer</h4>
            <p className="text-xs text-muted-foreground">
              Lecturers see these on submitted claims. Keep them about the work, not individual students.
            </p>
            <p className="mt-1 text-xs text-muted-foreground italic">
              Good example: “Covered recursion base cases · most mixed up the base and recursive case · review tutorial 5 Q3.”
            </p>
          </div>
          {notes.seen_by_lecturer_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
              <Eye className="size-3" aria-hidden />
              Seen by lecturer
            </span>
          ) : null}
        </div>

        {!notes.shared_editable ? (
          <p className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Locked because the claim was submitted. Reopen a rejected or disputed claim to edit.
          </p>
        ) : null}

        <SessionSharedNotesFields
          idPrefix={`notes-${claimId}`}
          value={shared}
          onChange={setShared}
          disabled={!notes.shared_editable || savingShared}
        />

        {notes.examples_used || notes.notes ? (
          <div className="space-y-1 rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
            {notes.examples_used ? (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">Examples used (earlier notes): </span>
                {notes.examples_used}
              </p>
            ) : null}
            {notes.notes ? (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">Additional notes (shared): </span>
                {notes.notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {notes.shared_editable ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={!sharedChanged || savingShared}
              onClick={() => void saveShared()}
            >
              {savingShared ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save notes
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-2 rounded-lg border border-dashed border-border/70 p-3">
        <Label htmlFor={`private-${claimId}`} className="flex items-center gap-1.5 text-xs font-semibold">
          <Lock className="size-3.5 text-muted-foreground" aria-hidden />
          Private note
          <span className="font-normal text-muted-foreground">(only you can see this)</span>
        </Label>
        <textarea
          id={`private-${claimId}`}
          rows={2}
          maxLength={SESSION_NOTE_MAX_LENGTH}
          value={privateNote}
          onChange={(e) => setPrivateNote(e.target.value)}
          placeholder="Reminders for yourself, e.g. bring printed past papers"
          disabled={savingPrivate}
          className={noteTextareaClass}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!privateChanged || savingPrivate}
            onClick={() => void savePrivate()}
          >
            {savingPrivate ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save private note
          </Button>
        </div>
      </section>
    </div>
  );
}
