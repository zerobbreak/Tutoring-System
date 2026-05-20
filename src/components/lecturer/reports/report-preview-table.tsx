import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { formatReportCell } from "#/lib/report-export";
import type { ReportResultDTO } from "#/lib/report-types";

type ReportPreviewTableProps = {
  report: ReportResultDTO;
};

export function ReportPreviewTable({ report }: ReportPreviewTableProps) {
  if (!report.rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No rows match this report and date range.
      </p>
    );
  }

  return (
    <div className="max-h-[min(28rem,50vh)] overflow-auto rounded-md border border-border/80">
      <Table>
        <TableHeader>
          <TableRow>
            {report.columns.map((col) => (
              <TableHead key={col.key} className="whitespace-nowrap">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((row, i) => (
            <TableRow key={i}>
              {report.columns.map((col) => (
                <TableCell key={col.key} className="whitespace-nowrap text-sm">
                  {formatReportCell(col, row[col.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

