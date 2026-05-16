import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/admin/schedules")({
  component: AdminSchedulesPage,
});

function AdminSchedulesPage() {
  return <LecturerPlaceholderPage title="Schedules" />;
}
