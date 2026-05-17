import { Badge } from "#/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { AdminTutorAnalyticsRowDTO } from "#/server-actions/admin-analytics";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

type AdminTutorsTableProps = {
  tutors: AdminTutorAnalyticsRowDTO[];
};

export function AdminTutorsTable({ tutors }: AdminTutorsTableProps) {
  if (!tutors.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No tutor activity in this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tutor</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Approval</TableHead>
            <TableHead className="text-right">Submissions</TableHead>
            <TableHead>Engagement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tutors.map((row) => (
            <TableRow key={row.tutorId}>
              <TableCell className="font-medium">{row.fullName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.performanceScore ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.sessionsCompleted}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {pct(row.approvalRate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.submissionsInPeriod}
              </TableCell>
              <TableCell>
                {row.lastLoginAt ? (
                  <Badge variant="secondary" className="font-normal">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-normal">
                    No login
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
