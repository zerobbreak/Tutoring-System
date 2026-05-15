import { Badge } from "#/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { ModuleAnalyticsRowDTO } from "#/server-actions/lecturer-analytics";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

type AnalyticsModulesTableProps = {
  modules: ModuleAnalyticsRowDTO[];
};

export function AnalyticsModulesTable({ modules }: AnalyticsModulesTableProps) {
  if (!modules.length) {
    return (
      <p className="text-sm text-muted-foreground">No modules assigned.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Attendance</TableHead>
            <TableHead className="text-right">Completion</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Rejected</TableHead>
            <TableHead className="text-right">Disputes</TableHead>
            <TableHead>Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((m) => (
            <TableRow key={m.moduleId}>
              <TableCell>
                <span className="font-medium">{m.moduleCode}</span>
                <span className="ml-2 text-muted-foreground">{m.moduleName}</span>
              </TableCell>
              <TableCell className="text-right">{m.sessionCount}</TableCell>
              <TableCell className="text-right">
                {pct(m.averageAttendanceRate)}
              </TableCell>
              <TableCell className="text-right">{pct(m.completionRate)}</TableCell>
              <TableCell className="text-right">{m.pendingCount}</TableCell>
              <TableCell className="text-right">{pct(m.rejectionRate)}</TableCell>
              <TableCell className="text-right">{m.disputeCount}</TableCell>
              <TableCell>
                {m.isHighRisk ? (
                  <Badge variant="destructive">High risk</Badge>
                ) : (
                  <Badge variant="outline">Normal</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
