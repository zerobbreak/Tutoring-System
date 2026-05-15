import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  return <LecturerPlaceholderPage title="Sessions" />;
}
