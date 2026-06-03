import { AlertTriangle, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { DetailSection } from "#/components/lecturer/sheets/detail-section";
import { cn } from "#/lib/utils";
import type { ScheduleComparisonDTO } from "#/server-actions/lecturer-verification";

function ComparisonRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/50 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 text-right font-medium tabular-nums",
          highlight ? "text-amber-700 dark:text-amber-300" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function VerificationScheduleComparisonSection({
  comparison,
}: {
  comparison: ScheduleComparisonDTO;
}) {
  return (
    <DetailSection
      title="Schedule vs attendance"
      description="Compare the claimed slot with timetable and QR data."
      icon={Clock}
    >
      <div className="divide-y rounded-lg border border-border/60 bg-muted/20">
        <ComparisonRow
          label="Claimed slot"
          value={
            <>
              {comparison.claim_date} · {comparison.claim_start?.slice(0, 5)}–
              {comparison.claim_end?.slice(0, 5)}
            </>
          }
        />
        <ComparisonRow
          label="From timetable"
          value={
            comparison.linked_from_schedule ? "Linked import" : "Manual entry"
          }
        />
        <ComparisonRow
          label="QR scans"
          value={comparison.attendance_scan_count}
        />
      </div>
      {comparison.headcount_matches_scans === false ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Headcount does not match scan count.
        </p>
      ) : null}
    </DetailSection>
  );
}
