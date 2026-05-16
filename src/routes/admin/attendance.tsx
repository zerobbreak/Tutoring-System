import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/admin/attendance")({
  component: AdminAttendancePage,
});

function AdminAttendancePage() {
  return <LecturerPlaceholderPage title="Attendance" />;
}
