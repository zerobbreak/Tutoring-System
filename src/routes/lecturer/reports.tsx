import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return <LecturerPlaceholderPage title="Reports" />;
}
