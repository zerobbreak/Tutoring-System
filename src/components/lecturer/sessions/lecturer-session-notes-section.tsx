import { NotebookPen } from "lucide-react";
import {
  DetailSection,
  EmptyHint,
} from "#/components/lecturer/sheets/detail-section";

export function LecturerSessionNotesSection({
  notes,
  topicsCovered,
  examplesUsed,
  studentStruggles,
  revisionTopics,
}: {
  notes: string | null;
  topicsCovered: string | null;
  examplesUsed: string | null;
  studentStruggles: string | null;
  revisionTopics: string | null;
}) {
  const hasNotes =
    notes ||
    topicsCovered ||
    examplesUsed ||
    studentStruggles ||
    revisionTopics;

  return (
    <DetailSection
      title="Tutor notes"
      description="Topics, examples, and session reflections."
      icon={NotebookPen}
    >
      {!hasNotes ? (
        <EmptyHint>No notes submitted.</EmptyHint>
      ) : (
        <div className="space-y-4 text-sm leading-relaxed">
          {topicsCovered ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Topics covered
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                {topicsCovered}
              </p>
            </div>
          ) : null}
          {examplesUsed ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Examples used
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                {examplesUsed}
              </p>
            </div>
          ) : null}
          {studentStruggles ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Student struggles
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                {studentStruggles}
              </p>
            </div>
          ) : null}
          {revisionTopics ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Revision topics
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                {revisionTopics}
              </p>
            </div>
          ) : null}
          {notes ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Additional notes
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                {notes}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </DetailSection>
  );
}
