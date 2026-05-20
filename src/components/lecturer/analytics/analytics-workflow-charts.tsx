import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActionMixItemDTO,
  PendingAgeBucketDTO,
  WeeklyActionCountDTO,
} from "#/server-actions/lecturer-analytics";

type AnalyticsPendingAgeChartProps = {
  buckets: PendingAgeBucketDTO[];
};

export function AnalyticsPendingAgeChart({
  buckets,
}: AnalyticsPendingAgeChartProps) {
  return (
    <div className="h-[200px] min-h-[200px] w-full min-w-0 shrink-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="count"
            name="Claims"
            fill="var(--lagoon-deep)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type AnalyticsActionsByWeekChartProps = {
  series: WeeklyActionCountDTO[];
};

export function AnalyticsActionsByWeekChart({
  series,
}: AnalyticsActionsByWeekChartProps) {
  return (
    <div className="h-[200px] min-h-[200px] w-full min-w-0 shrink-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="count"
            name="Review actions"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type AnalyticsActionMixListProps = {
  items: ActionMixItemDTO[];
  total: number;
};

export function AnalyticsActionMixList({
  items,
  total,
}: AnalyticsActionMixListProps) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">No review actions recorded.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.actionType} className="flex items-center justify-between text-sm">
          <span>{item.label}</span>
          <span className="tabular-nums text-muted-foreground">
            {item.count}
            {total > 0 ? ` (${Math.round((item.count / total) * 100)}%)` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
