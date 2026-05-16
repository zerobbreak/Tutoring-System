import { useMemo } from "react";
import { cn } from "#/lib/utils";
import type { ModuleHeatCellDTO } from "#/server-actions/lecturer-analytics";

type AnalyticsModuleHeatmapProps = {
  cells: ModuleHeatCellDTO[];
};

function cellColor(value: number | null): string {
  if (value == null) return "bg-muted/40";
  if (value >= 80) return "bg-emerald-500/70";
  if (value >= 65) return "bg-emerald-500/40";
  if (value >= 50) return "bg-amber-500/50";
  return "bg-destructive/50";
}

export function AnalyticsModuleHeatmap({ cells }: AnalyticsModuleHeatmapProps) {
  const { modules, weeks, grid } = useMemo(() => {
    const moduleCodes = [...new Set(cells.map((c) => c.moduleCode))].sort();
    const weekLabels = [
      ...new Map(
        cells.map((c) => [c.weekStart, c.weekLabel] as const),
      ).entries(),
    ]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, label]) => label);

    const lookup = new Map<string, number | null>();
    for (const c of cells) {
      lookup.set(`${c.moduleCode}:${c.weekStart}`, c.value);
    }

    const weekStarts = [
      ...new Set(cells.map((c) => c.weekStart)),
    ].sort();

    return {
      modules: moduleCodes,
      weeks: weekLabels,
      grid: moduleCodes.map((code) =>
        weekStarts.map((ws) => lookup.get(`${code}:${ws}`) ?? null),
      ),
    };
  }, [cells]);

  if (!modules.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No attendance data for the heat map period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-background p-2 text-left font-medium text-muted-foreground">
              Module
            </th>
            {weeks.map((w) => (
              <th
                key={w}
                className="p-2 text-center font-medium text-muted-foreground"
              >
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((code, rowIdx) => (
            <tr key={code}>
              <td className="sticky left-0 bg-background p-2 font-medium">{code}</td>
              {grid[rowIdx]?.map((value, colIdx) => (
                <td key={`${code}-${colIdx}`} className="p-1">
                  <div
                    title={
                      value != null ? `${value}% attendance` : "No data"
                    }
                    className={cn(
                      "flex h-9 min-w-[2.5rem] items-center justify-center rounded-md text-[10px] font-medium",
                      cellColor(value),
                      value == null && "text-muted-foreground",
                    )}
                  >
                    {value != null ? `${value}%` : "—"}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
