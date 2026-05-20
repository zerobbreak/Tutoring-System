import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { TutorSessionsWorkspace } from "#/components/tutor/sessions/tutor-sessions-workspace";

const sessionsSearchSchema = z.object({
  claim: z.string().uuid().optional(),
  session: z.string().uuid().optional(),
});

export const Route = createFileRoute("/tutor/sessions")({
  validateSearch: sessionsSearchSchema,
  component: TutorSessionsPage,
});

function TutorSessionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <TutorSessionsWorkspace search={search} navigate={navigate} />;
}
