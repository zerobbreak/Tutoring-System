import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";
import { SESSION_NOTE_MAX_LENGTH } from "#/server-actions/tutor-notes";

export type SharedNotesDraft = {
  topicsCovered: string;
  studentStruggles: string;
  revisionTopics: string;
};

export const EMPTY_SHARED_NOTES: SharedNotesDraft = {
  topicsCovered: "",
  studentStruggles: "",
  revisionTopics: "",
};

export function sharedNotesDraftFrom(row: {
  topics_covered: string | null;
  student_struggles: string | null;
  revision_topics: string | null;
}): SharedNotesDraft {
  return {
    topicsCovered: row.topics_covered ?? "",
    studentStruggles: row.student_struggles ?? "",
    revisionTopics: row.revision_topics ?? "",
  };
}

export function sharedNotesDirty(
  draft: SharedNotesDraft,
  saved: SharedNotesDraft,
): boolean {
  return (
    draft.topicsCovered !== saved.topicsCovered ||
    draft.studentStruggles !== saved.studentStruggles ||
    draft.revisionTopics !== saved.revisionTopics
  );
}

export const noteTextareaClass = cn(
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const FIELDS: {
  key: keyof SharedNotesDraft;
  label: string;
  placeholder: string;
  required?: boolean;
}[] = [
  {
    key: "topicsCovered",
    label: "What we covered",
    placeholder: "e.g. Recursion: base cases, tracing factorial(4), Q3 of tutorial 5",
    required: true,
  },
  {
    key: "studentStruggles",
    label: "Where students struggled",
    placeholder:
      "Describe the topic or mistake, not the student — e.g. mixed up base case and recursive case",
  },
  {
    key: "revisionTopics",
    label: "What to review before next time",
    placeholder: "e.g. Redo tutorial 5 Q3–4; read chapter 7.2 on call stacks",
  },
];

/** The three lecturer-visible note fields, shared by the Notes tab and the submit step. */
export function SessionSharedNotesFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: SharedNotesDraft;
  onChange: (next: SharedNotesDraft) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-${f.key}`} className="text-xs font-semibold">
            {f.label}
            {f.required ? (
              <span className="ml-1 font-normal text-muted-foreground">
                (required to submit)
              </span>
            ) : null}
          </Label>
          <textarea
            id={`${idPrefix}-${f.key}`}
            rows={f.required ? 3 : 2}
            maxLength={SESSION_NOTE_MAX_LENGTH}
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            disabled={disabled}
            className={noteTextareaClass}
          />
        </div>
      ))}
    </div>
  );
}
