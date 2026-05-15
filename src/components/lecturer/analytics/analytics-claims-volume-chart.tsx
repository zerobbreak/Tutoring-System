import { Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClaimsVolumePointDTO } from "#/server-actions/lecturer-analytics";

type AnalyticsClaimsVolumeChartProps = {
  series: ClaimsVolumePointDTO[];
  loading?: boolean;
};

export function AnalyticsClaimsVolumeChart({
  series,
  loading = false,
}: AnalyticsClaimsVolumeChartProps) {
  const data = series.length > 30 ? series.slice(-30) : series;

  return (
    <div className="relative h-[240px] w-full min-w-0">
      {loading ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="size-8 animate-spin" aria-label="Loading chart" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            <Line
              type="monotone"
              dataKey="submitted"
              name="Submitted"
              stroke="var(--lagoon-deep)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="completed"
              name="Approved"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
