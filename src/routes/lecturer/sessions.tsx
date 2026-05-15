import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { LecturerSessionsView } from "#/components/lecturer/sessions/lecturer-sessions-view";

const sessionsSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/lecturer/sessions")({
  validateSearch: sessionsSearchSchema,
  component: LecturerSessionsPage,
});

function LecturerSessionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <LecturerSessionsView search={search} navigate={navigate} />;
}
