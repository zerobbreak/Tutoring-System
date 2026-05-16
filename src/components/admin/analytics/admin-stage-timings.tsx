import type { WorkflowStageTimingDTO } from "#/server-actions/admin-analytics";

function formatHours(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

type AdminStageTimingsProps = {
  stages: WorkflowStageTimingDTO[];
};

export function AdminStageTimings({ stages }: AdminStageTimingsProps) {
  if (!stages.length) {
    return (
      <p className="text-sm text-muted-foreground">No workflow timing data yet.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stages.map((stage) => (
        <div
          key={stage.stage}
          className="rounded-lg border border-border/60 px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">{stage.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatHours(stage.medianHours)}
          </p>
          <p className="text-xs text-muted-foreground">Median time</p>
        </div>
      ))}
    </div>
  );
}
