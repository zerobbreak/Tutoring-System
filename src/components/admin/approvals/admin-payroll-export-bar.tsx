import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { toast } from "#/lib/toast";
import { createPayrollExportFn } from "#/server-actions/admin-approvals";

type AdminPayrollExportBarProps = {
  onExported: () => void;
};

export function AdminPayrollExportBar({ onExported }: AdminPayrollExportBarProps) {
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(
    format(startOfMonth(now), "yyyy-MM-dd"),
  );
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await createPayrollExportFn({
        data: { periodStart, periodEnd },
      });
      const blob = new Blob([result.csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${result.claimCount} claims (${result.totalHours} hours) for ${result.periodLabel}.`,
      );
      onExported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="export-start">Period start</Label>
        <Input
          id="export-start"
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="w-full sm:w-auto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="export-end">Period end</Label>
        <Input
          id="export-end"
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="w-full sm:w-auto"
        />
      </div>
      <Button
        type="button"
        disabled={exporting}
        onClick={() => void handleExport()}
        className="sm:ml-auto"
      >
        {exporting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Download className="mr-2 size-4" />
        )}
        Export approved batch
      </Button>
    </div>
  );
}
