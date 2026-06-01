import { User } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
  DetailSection,
  EmptyHint,
} from "#/components/lecturer/sheets/detail-section";
import type { SessionAttendanceRowDTO } from "#/server-actions/lecturer-sessions";

export function LecturerSessionAttendanceSection({
  attendancePresentCount,
  attendanceExpectedCount,
  attendanceScanCount,
  attendanceByStatus,
  attendanceRows,
}: {
  attendancePresentCount: number | null;
  attendanceExpectedCount: number | null;
  attendanceScanCount: number;
  attendanceByStatus: Record<string, number>;
  attendanceRows: SessionAttendanceRowDTO[];
}) {
  return (
    <DetailSection
      title="Attendance"
      description="Present count, QR scans, and student check-ins."
      icon={User}
    >
      <p className="text-sm font-medium text-foreground">
        {attendancePresentCount != null
          ? `${attendancePresentCount} present`
          : `${attendanceScanCount} QR scans`}
        {attendanceExpectedCount != null
          ? ` / ${attendanceExpectedCount} expected`
          : ""}
      </p>
      {Object.keys(attendanceByStatus).length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {Object.entries(attendanceByStatus).map(([status, n]) => (
            <li key={status}>
              <Badge variant="secondary" className="text-xs">
                {status}: {n}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {attendanceRows.length === 0 ? (
        <EmptyHint className="mt-3">
          No student check-ins recorded.
        </EmptyHint>
      ) : (
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {attendanceRows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
            >
              <span className="truncate font-medium">
                {row.student?.full_name ?? "Student"}
                {row.student?.student_reference
                  ? ` (${row.student.student_reference})`
                  : ""}
              </span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {row.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
