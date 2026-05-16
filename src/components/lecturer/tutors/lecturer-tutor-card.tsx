import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import type { LecturerTutorCardDTO } from "#/server-actions/lecturer-tutors";

type LecturerTutorCardProps = {
  tutor: LecturerTutorCardDTO;
  selected?: boolean;
  onSelect: (tutor: LecturerTutorCardDTO) => void;
};

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function LecturerTutorCard({
  tutor,
  selected,
  onSelect,
}: LecturerTutorCardProps) {
  const moduleLabel =
    tutor.assignedModules.length === 0
      ? "No active modules"
      : tutor.assignedModules.length === 1
        ? tutor.assignedModules[0]!.moduleCode
        : tutor.assignedModules
            .map((m) => m.moduleCode)
            .slice(0, 3)
            .join(", ") +
          (tutor.assignedModules.length > 3
            ? ` +${tutor.assignedModules.length - 3}`
            : "");

  return (
    <button
      type="button"
      onClick={() => onSelect(tutor)}
      className={cn(
        "group w-full rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition-all hover:border-(--lagoon-deep)/50 hover:shadow-md",
        selected &&
          "border-(--lagoon-deep) ring-2 ring-(--lagoon-deep)/20 shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            tutor.isInactive
              ? "bg-muted text-muted-foreground"
              : "bg-(--lagoon-deep)/15 text-(--lagoon-deep)",
          )}
          aria-hidden
        >
          {initials(tutor.fullName) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground group-hover:text-(--lagoon-deep)">
                {tutor.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {tutor.email}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {tutor.isInactive ? (
                <Badge
                  variant="outline"
                  className="border-amber-300/80 text-[10px] text-amber-800"
                >
                  Inactive
                </Badge>
              ) : null}
              {tutor.pendingClaims > 0 ? (
                <Badge variant="secondary" className="text-[10px]">
                  {tutor.pendingClaims} pending
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {moduleLabel}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
        {[
          { label: "Sessions", value: String(tutor.sessionsCompleted) },
          {
            label: "Attendance",
            value: formatPercent(tutor.attendanceAverage),
          },
          { label: "Approval", value: formatPercent(tutor.approvalRate) },
          {
            label: "Workload",
            value: `${tutor.totalHours.toFixed(1)}h`,
            sub: `${tutor.upcomingSessions} upcoming`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-md bg-muted/25 px-2.5 py-2"
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {stat.value}
            </dd>
            {"sub" in stat && stat.sub ? (
              <dd className="text-[10px] text-muted-foreground">{stat.sub}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </button>
  );
}
