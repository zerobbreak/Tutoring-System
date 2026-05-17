import { Badge } from "#/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { TutorAnalyticsRowDTO } from "#/server-actions/lecturer-analytics";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function hours(v: number | null): string {
  if (v == null) return "—";
  if (v < 24) return `${Math.round(v)}h`;
  return `${(v / 24).toFixed(1)}d`;
}

type AnalyticsTutorsTableProps = {
  tutors: TutorAnalyticsRowDTO[];
};

export function AnalyticsTutorsTable({ tutors }: AnalyticsTutorsTableProps) {
  if (!tutors.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No tutor activity in this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tutor</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Approval</TableHead>
            <TableHead className="text-right">Turnaround</TableHead>
            <TableHead className="text-right">Attendance</TableHead>
            <TableHead className="text-right">Consistency</TableHead>
            <TableHead className="text-right">Disputes</TableHead>
            <TableHead className="text-right">Pending</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tutors.map((t) => (
            <TableRow key={t.tutorId}>
              <TableCell className="font-medium">{t.fullName}</TableCell>
              <TableCell className="text-right">
                {t.performanceScore != null ? (
                  <Badge variant={t.performanceScore >= 70 ? "default" : "secondary"}>
                    {t.performanceScore}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">{t.sessionsCompleted}</TableCell>
              <TableCell className="text-right">{pct(t.approvalRate)}</TableCell>
              <TableCell className="text-right">
                {hours(t.medianTurnaroundHours)}
              </TableCell>
              <TableCell className="text-right">{pct(t.attendanceAverage)}</TableCell>
              <TableCell className="text-right">
                {pct(t.attendanceConsistency)}
              </TableCell>
              <TableCell className="text-right">{t.disputeCount}</TableCell>
              <TableCell className="text-right">{t.pendingClaims}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
