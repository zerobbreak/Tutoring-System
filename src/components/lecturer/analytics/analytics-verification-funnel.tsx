import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VerificationFunnelStepDTO } from "#/server-actions/lecturer-analytics";

const FUNNEL_COLORS = [
  "var(--muted-foreground)",
  "var(--lagoon-deep)",
  "var(--chart-4)",
  "var(--destructive)",
  "var(--chart-2)",
  "var(--chart-1)",
];

type AnalyticsVerificationFunnelProps = {
  steps: VerificationFunnelStepDTO[];
};

export function AnalyticsVerificationFunnel({
  steps,
}: AnalyticsVerificationFunnelProps) {
  const data = steps.filter((s) => s.count > 0 || s.status !== "DRAFT");

  return (
    <div className="h-[280px] min-h-[280px] w-full min-w-0 shrink-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={entry.status}
                fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
