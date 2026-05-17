import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export type SessionDayPoint = {
  date: number
  dateLabel: string
  sessions: number
  hoursWorked: number
}

/** Largest range toggle; parent should supply at least this many daily points when using `series`. */
export const TUTOR_SESSION_CHART_MAX_DAYS = 90

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Deterministic demo series when `series` is not provided. */
export function generateSessionSeries(dayCount: number): SessionDayPoint[] {
  const result: SessionDayPoint[] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  for (let offset = dayCount - 1; offset >= 0; offset--) {
    const d = new Date(today)
    d.setDate(d.getDate() - offset)
    d.setHours(12, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
    const sessions = Math.abs(hash % 7)
    const hoursWorked =
      sessions === 0
        ? 0
        : Math.round((sessions * 0.72 + (Math.abs(hash >> 5) % 35) / 35) * 10) / 10
    result.push({
      date: d.getTime(),
      dateLabel: formatDayLabel(d),
      sessions,
      hoursWorked,
    })
  }
  return result
}

type RangeKey = "7" | "30" | "90"

const RANGE_DAYS: Record<RangeKey, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
}

function formatHours(h: number) {
  if (h === 0) return "0 hours worked"
  const rounded = Math.round(h * 10) / 10
  const unit = rounded === 1 ? "hour" : "hours"
  return `${rounded} ${unit} worked`
}

function SessionsTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: SessionDayPoint
}) {
  if (!active || !payload?.dateLabel) return null
  const row = payload
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium text-foreground">{row.dateLabel}</p>
      <p className="text-muted-foreground">{formatHours(row.hoursWorked)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {row.sessions} session{row.sessions === 1 ? "" : "s"}
      </p>
    </div>
  )
}

export type TutorSessionsActivityChartProps = {
  /**
   * Daily points ascending by calendar day; include at least {@link TUTOR_SESSION_CHART_MAX_DAYS} trailing days
   * (zeros for days with no claims) so range toggles stay accurate.
   */
  series?: SessionDayPoint[] | null
  seriesLoading?: boolean
}

export function TutorSessionsActivityChart({
  series: seriesProp,
  seriesLoading = false,
}: TutorSessionsActivityChartProps) {
  const [range, setRange] = useState<RangeKey>("30")

  const data = useMemo(() => {
    if (seriesLoading) return []
    const dayCount = RANGE_DAYS[range]
    if (seriesProp != null) {
      return seriesProp.length <= dayCount ? seriesProp : seriesProp.slice(-dayCount)
    }
    return generateSessionSeries(dayCount)
  }, [seriesProp, seriesLoading, range])

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

      <div className="relative h-[260px] w-full min-h-[260px] min-w-0 shrink-0">
        {seriesLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-8 animate-spin" aria-label="Loading chart" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tutorSessionsArea" x1="0" y1="0" x2="0" y2="1">
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
                minTickGap={24}
              />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={({ active, payload }) => (
                  <SessionsTooltip
                    active={active}
                    payload={payload?.[0]?.payload as SessionDayPoint | undefined}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="var(--lagoon-deep)"
                strokeWidth={2}
                fill="url(#tutorSessionsArea)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)", fill: "var(--lagoon-deep)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
