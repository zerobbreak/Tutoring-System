import { FileJson, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { exportReport, type ReportExportFormat } from "#/lib/report-export";
import type { ReportResultDTO } from "#/server-actions/lecturer-reports";
import { toast } from "sonner";

type ReportExportActionsProps = {
  report: ReportResultDTO | null;
  disabled?: boolean;
};

const FORMATS: {
  id: ReportExportFormat;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "csv", label: "CSV", icon: Table2 },
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "json", label: "JSON", icon: FileJson },
];

export function ReportExportActions({
  report,
  disabled,
}: ReportExportActionsProps) {
  const handleExport = (format: ReportExportFormat) => {
    if (!report) {
      toast.error("Generate a report preview first.");
      return;
    }
    try {
      exportReport(report, format);
      toast.success(`Downloaded ${format.toUpperCase()} export`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {FORMATS.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !report}
          className="gap-2"
          onClick={() => handleExport(id)}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
