import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { LecturerAttendanceView } from "#/components/lecturer/attendance/lecturer-attendance-view";

const attendanceSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/lecturer/attendance")({
  validateSearch: attendanceSearchSchema,
  component: LecturerAttendancePage,
});

function LecturerAttendancePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <LecturerAttendanceView search={search} navigate={navigate} />;
}
