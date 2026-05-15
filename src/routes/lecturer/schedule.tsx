import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  return <LecturerPlaceholderPage title="Schedule" />;
}
