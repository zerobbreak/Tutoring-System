import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkloadBarDTO } from "#/server-actions/lecturer-analytics";

type AnalyticsWorkloadChartProps = {
  data: WorkloadBarDTO[];
};

export function AnalyticsWorkloadChart({ data }: AnalyticsWorkloadChartProps) {
  const chartData = data.map((d) => ({
    name: d.tutorName.split(" ")[0] ?? d.tutorName,
    hours: d.hours,
    reviews: d.verificationActions,
  }));

  return (
    <div className="h-[280px] min-h-[280px] w-full min-w-0 shrink-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar
            yAxisId="left"
            dataKey="hours"
            name="Hours"
            fill="var(--lagoon-deep)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="reviews"
            name="Your reviews"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
