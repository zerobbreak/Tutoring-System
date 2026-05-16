import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { LecturerAnalyticsRowDTO } from "#/server-actions/admin-analytics";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function hours(v: number | null): string {
  if (v == null) return "—";
  if (v < 24) return `${Math.round(v)}h`;
  return `${(v / 24).toFixed(1)}d`;
}

type AdminLecturersTableProps = {
  lecturers: LecturerAnalyticsRowDTO[];
};

export function AdminLecturersTable({ lecturers }: AdminLecturersTableProps) {
  if (!lecturers.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No lecturer activity in this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lecturer</TableHead>
            <TableHead className="text-right">Modules</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Median verify</TableHead>
            <TableHead className="text-right">Actions</TableHead>
            <TableHead className="text-right">Attendance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lecturers.map((row) => (
            <TableRow key={row.lecturerId}>
              <TableCell className="font-medium">{row.fullName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.moduleCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.pendingVerificationCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {hours(row.medianVerifyHours)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.verificationActionsCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {pct(row.averageAttendanceRate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
