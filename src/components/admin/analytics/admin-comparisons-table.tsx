import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import type { ComparisonSliceDTO } from "#/server-actions/admin-analytics";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

type AdminComparisonsTableProps = {
  title: string;
  slices: ComparisonSliceDTO[];
  emptyMessage: string;
};

export function AdminComparisonsTable({
  title,
  slices,
  emptyMessage,
}: AdminComparisonsTableProps) {
  if (!slices.length) {
    return (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cohort</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
              <TableHead className="text-right">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slices.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.sessionCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pct(row.utilizationRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.pendingCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
