import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { LecturerTutorsView } from "#/components/lecturer/tutors/lecturer-tutors-view";

const tutorsSearchSchema = z.object({
  tutor: z.string().uuid().optional(),
});

export const Route = createFileRoute("/lecturer/tutors")({
  validateSearch: tutorsSearchSchema,
  component: LecturerTutorsPage,
});

function LecturerTutorsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <LecturerTutorsView search={search} navigate={navigate} />;
}
