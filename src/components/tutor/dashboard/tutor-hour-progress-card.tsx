import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { cn } from "#/lib/utils";

type TutorHourProgressCardProps = {
  booting: boolean;
  hourBudget: TutorHourBudgetSummary | null;
};

function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-destructive" : "bg-(--lagoon-deep)",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function TutorHourProgressCard({
  booting,
  hourBudget,
}: TutorHourProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totals = hourBudget?.totals;
  const hasAllocation = (totals?.allocatedHours ?? 0) > 0;

  if (booting) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasAllocation) {
    return (
      <Card className="flex h-full flex-col border-dashed">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Hours allocation</CardTitle>
          <CardDescription>
            No hour cap has been set for your modules yet. Your coordinator can
            assign allocated hours per module and semester.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const allocated = totals!.allocatedHours;
  const reserved = totals!.reservedHours;
  const available = totals!.availableHours;
  const worked = totals!.workedHours;
  const utilization = totals!.utilizationPercent;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base font-semibold">Hours progress</CardTitle>
        <CardDescription>
          Reserved hours include scheduled and submitted sessions. Worked hours
          are completed sessions only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">
              {reserved} / {allocated}h reserved
            </span>
            <span
              className={cn(
                "text-muted-foreground",
                available < 0 && "font-medium text-destructive",
              )}
            >
              {available < 0
                ? `${Math.abs(available)}h over allocation`
                : `${available}h available`}
            </span>
          </div>
          <ProgressBar value={reserved} max={allocated} />
        </div>
        <p className="text-sm text-muted-foreground">
          Worked: <span className="font-medium text-foreground">{worked}h</span>
          {" · "}
          Utilization:{" "}
          <span className="font-medium text-foreground">{utilization}%</span>
        </p>
        {(hourBudget?.byModule.length ?? 0) > 0 ? (
          <div>
            <button
              type="button"
              className="text-xs font-medium text-(--lagoon-deep) hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Hide" : "Show"} per module
            </button>
            {expanded ? (
              <ul className="mt-2 space-y-2 border-t border-border/60 pt-2">
                {hourBudget!.byModule.map((m) => (
                  <li
                    key={`${m.moduleId}:${m.academicTermId}`}
                    className="text-xs"
                  >
                    <div className="flex justify-between gap-2">
                      <span>
                        {m.moduleCode}
                        {m.academicTermLabel
                          ? ` · ${m.academicTermLabel}`
                          : ""}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {m.reservedHours}/{m.allocatedHours}h
                      </span>
                    </div>
                    <ProgressBar
                      value={m.reservedHours}
                      max={m.allocatedHours}
                      className="mt-1 h-1.5"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
