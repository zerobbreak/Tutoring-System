import { createFileRoute } from "@tanstack/react-router";
import { TutorNotesWorkspace } from "#/components/tutor/notes/tutor-notes-workspace";

export const Route = createFileRoute("/tutor/notes")({
  component: TutorNotesWorkspace,
});
