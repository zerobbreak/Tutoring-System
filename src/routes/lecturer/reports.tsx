import { createFileRoute } from "@tanstack/react-router";
import { LecturerReportsView } from "#/components/lecturer/reports/lecturer-reports-view";

export const Route = createFileRoute("/lecturer/reports")({
  component: LecturerReportsPage,
});

function LecturerReportsPage() {
  return <LecturerReportsView />;
}
