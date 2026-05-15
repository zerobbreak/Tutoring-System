import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  return <LecturerPlaceholderPage title="Attendance" />;
}
