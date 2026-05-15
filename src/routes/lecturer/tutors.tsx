import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/tutors")({
  component: TutorsPage,
});

function TutorsPage() {
  return <LecturerPlaceholderPage title="Tutors" />;
}
