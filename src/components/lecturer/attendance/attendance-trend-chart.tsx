import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceTrendPointDTO } from "#/server-actions/lecturer-attendance";

type RangeKey = "30" | "60" | "90";

const RANGE_DAYS: Record<RangeKey, number> = {
  "30": 30,
  "60": 60,
  "90": 90,
};

type AttendanceTrendChartProps = {
  series: AttendanceTrendPointDTO[];
  loading?: boolean;
};

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: AttendanceTrendPointDTO;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{payload.dateLabel}</p>
      {payload.rate != null ? (
        <p className="text-muted-foreground">{payload.rate}% attendance</p>
      ) : (
        <p className="text-muted-foreground">No headcount data</p>
      )}
      <p className="mt-0.5 text-xs text-muted-foreground">
        {payload.present} / {payload.expected} · {payload.sessionCount} session
        {payload.sessionCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function AttendanceTrendChart({
  series,
  loading = false,
}: AttendanceTrendChartProps) {
  const [range, setRange] = useState<RangeKey>("30");

  const data = useMemo(() => {
    const days = RANGE_DAYS[range];
    return series.length <= days ? series : series.slice(-days);
  }, [series, range]);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        rateValue: d.rate ?? 0,
      })),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5"
          role="group"
          aria-label="Date range"
        >
          {(Object.keys(RANGE_DAYS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={
                range === key
                  ? "rounded-md bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm"
                  : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Last {RANGE_DAYS[key]} days
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[240px] w-full min-w-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-8 animate-spin" aria-label="Loading chart" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lagoon-deep)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--lagoon-deep)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={36}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={({ active, payload }) => (
                  <TrendTooltip
                    active={active}
                    payload={payload?.[0]?.payload as AttendanceTrendPointDTO | undefined}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="rateValue"
                stroke="var(--lagoon-deep)"
                strokeWidth={2}
                fill="url(#attendanceTrendArea)"
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "var(--background)",
                  fill: "var(--lagoon-deep)",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
