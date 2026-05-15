import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { TutorNotesWorkspace } from "#/components/tutor/notes/tutor-notes-workspace";

const notesSearchSchema = z.object({
  claim: z.string().uuid().optional(),
  focus: z.coerce.number().optional(),
});

export const Route = createFileRoute("/tutor/notes")({
  validateSearch: notesSearchSchema,
  component: TutorNotesPage,
});

function TutorNotesPage() {
  const { claim, focus } = Route.useSearch();
  return <TutorNotesWorkspace claimFromSearch={claim} focusFromSearch={focus} />;
}
