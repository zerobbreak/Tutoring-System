import type { InstitutionSnapshotDTO } from "#/server-actions/admin-analytics";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

type AdminInstitutionSnapshotProps = {
  snapshot: InstitutionSnapshotDTO;
  institutionName: string | null;
};

export function AdminInstitutionSnapshot({
  snapshot,
  institutionName,
}: AdminInstitutionSnapshotProps) {
  const items = [
    { label: "Modules", value: String(snapshot.totalModules) },
    { label: "Active tutors", value: String(snapshot.activeTutors) },
    {
      label: "Sessions this week",
      value: String(snapshot.activeScheduledSessions),
    },
    {
      label: "Schedule utilization",
      value: pct(snapshot.utilizationRate),
    },
  ];

  return (
    <div className="space-y-3">
      {institutionName ? (
        <p className="text-sm text-muted-foreground">{institutionName}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border/60 px-4 py-3 text-center"
          >
            <p className="text-lg font-bold tabular-nums">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
