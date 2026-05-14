import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { endOfWeek, format, startOfWeek, subDays } from "date-fns"
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Settings,
  Users,
  Video,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  TUTOR_SESSION_CHART_MAX_DAYS,
  TutorSessionsActivityChart,
  type SessionDayPoint,
} from "#/components/tutor-sessions-activity-chart"
import { Button } from "#/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"
import { Skeleton } from "#/components/ui/skeleton"
import {
  isTutorialTimetableEvent,
  type ScheduleParseResult,
  type ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet"
import { supabase } from "#/lib/supabase"
import {
  mergeScheduleSources,
  parseScheduleParseResultFromJson,
  type TutorScheduleImportSource,
} from "#/lib/tutor-schedule-imports"

const rootRouteApi = getRouteApi("__root__")

export const Route = createFileRoute("/tutor/")({
  component: TutorDashboard,
})

type ClaimStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "DISPUTED"
  | "REJECTED"
  | "VERIFIED"
  | "APPROVED"

type SessionClaimRow = {
  id: string
  session_date: string
  start_time: string
  hours: number
  status: ClaimStatus
  updated_at: string
  topics_covered: string | null
  coverage_validated_at: string | null
  module: { code: string; name: string } | null
}

type RawClaimRow = Omit<SessionClaimRow, "module"> & {
  module: { code: string; name: string } | { code: string; name: string }[] | null
}

function mapClaimRow(r: RawClaimRow): SessionClaimRow {
  const m = r.module
  const module = m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m
  return { ...r, module }
}

type NotificationRow = {
  id: string
  subject: string | null
  body: string | null
  is_read: boolean | null
  sent_at: string | null
  type: string
}

function typeColumnFlagForEvent(
  ev: ScheduleParsedEvent,
  merged: ScheduleParseResult,
): boolean {
  return ev.sessionTypeFromSource ?? merged.sessionTypeColumnPresent
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function buildDailyPointsFromClaims(
  claims: { session_date: string; hours: number | string }[],
  dayCount: number,
): SessionDayPoint[] {
  const byDay = new Map<string, { sessions: number; hours: number }>()
  for (const c of claims) {
    const key = c.session_date
    const raw = typeof c.hours === "string" ? Number.parseFloat(c.hours) : c.hours
    const h = Number.isFinite(raw) ? raw : 0
    const prev = byDay.get(key) ?? { sessions: 0, hours: 0 }
    byDay.set(key, { sessions: prev.sessions + 1, hours: prev.hours + h })
  }
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const result: SessionDayPoint[] = []
  for (let offset = dayCount - 1; offset >= 0; offset--) {
    const d = new Date(today)
    d.setDate(d.getDate() - offset)
    d.setHours(12, 0, 0, 0)
    const key = format(d, "yyyy-MM-dd")
    const agg = byDay.get(key) ?? { sessions: 0, hours: 0 }
    result.push({
      date: d.getTime(),
      dateLabel: formatDayLabel(d),
      sessions: agg.sessions,
      hoursWorked: Math.round(agg.hours * 10) / 10,
    })
  }
  return result
}

function formatClaimStatus(s: ClaimStatus): string {
  return s.replace(/_/g, " ").toLowerCase()
}

function TutorDashboard() {
  const { sessionData } = rootRouteApi.useLoaderData()
  const user = sessionData?.user

  const [booting, setBooting] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeStudents, setActiveStudents] = useState(0)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [hoursThisWeek, setHoursThisWeek] = useState(0)
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0)
  const [coverageGapCount, setCoverageGapCount] = useState(0)
  const [claims, setClaims] = useState<SessionClaimRow[]>([])
  const [chartSeries, setChartSeries] = useState<SessionDayPoint[] | null>(null)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleParsedEvent[]>([])
  const [pendingPreviewClaims, setPendingPreviewClaims] = useState<SessionClaimRow[]>([])

  const weekBounds = useMemo(() => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return {
      startStr: format(start, "yyyy-MM-dd"),
      endStr: format(end, "yyyy-MM-dd"),
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setBooting(false)
      return
    }

    let cancelled = false

    ;(async () => {
      setBooting(true)
      setLoadError(null)
      try {
        const uid = user.id
        const chartFrom = format(subDays(new Date(), TUTOR_SESSION_CHART_MAX_DAYS - 1), "yyyy-MM-dd")

        const claimsSelect = `
        id,
        session_date,
        start_time,
        hours,
        status,
        updated_at,
        topics_covered,
        coverage_validated_at,
        module:modules ( code, name )
      `

        const [
          rosterRes,
          claimsRes,
          pendingCountRes,
          pendingListRes,
          schedulesRes,
          notificationsRes,
        ] = await Promise.all([
          supabase
            .from("tutor_student_assignments")
            .select("id", { count: "exact", head: true })
            .eq("tutor_id", uid)
            .eq("is_active", true),
          supabase
            .from("session_claims")
            .select(claimsSelect)
            .eq("tutor_id", uid)
            .gte("session_date", chartFrom)
            .order("session_date", { ascending: false }),
          supabase
            .from("session_claims")
            .select("id", { count: "exact", head: true })
            .eq("tutor_id", uid)
            .in("status", ["DRAFT", "PENDING_VERIFICATION"]),
          supabase
            .from("session_claims")
            .select(claimsSelect)
            .eq("tutor_id", uid)
            .in("status", ["DRAFT", "PENDING_VERIFICATION"])
            .order("session_date", { ascending: false })
            .limit(5),
          supabase
            .from("tutor_schedule_imports")
            .select("id, file_name, parse_result")
            .eq("tutor_id", uid)
            .order("created_at", { ascending: true }),
          supabase
            .from("notifications")
            .select("id, subject, body, is_read, sent_at, type")
            .eq("recipient_id", uid)
            .order("sent_at", { ascending: false })
            .limit(5),
        ])

        if (cancelled) return

        const errs = [
          rosterRes.error,
          claimsRes.error,
          pendingCountRes.error,
          pendingListRes.error,
          schedulesRes.error,
          notificationsRes.error,
        ].filter(Boolean) as { message: string }[]
        if (errs.length) {
          setLoadError(errs.map((e) => e.message).join(" · "))
        }

      if (!rosterRes.error && typeof rosterRes.count === "number") {
        setActiveStudents(rosterRes.count)
      } else if (!rosterRes.error) {
        setActiveStudents(0)
      }

      if (!pendingCountRes.error && typeof pendingCountRes.count === "number") {
        setPendingClaimsCount(pendingCountRes.count)
      } else {
        setPendingClaimsCount(0)
      }

      if (!pendingListRes.error && pendingListRes.data) {
        setPendingPreviewClaims((pendingListRes.data as RawClaimRow[]).map(mapClaimRow))
      } else {
        setPendingPreviewClaims([])
      }

      let claimRows: SessionClaimRow[] = []
      if (!claimsRes.error && claimsRes.data) {
        claimRows = (claimsRes.data as RawClaimRow[]).map(mapClaimRow)
        setClaims(claimRows)
        setChartSeries(buildDailyPointsFromClaims(claimRows, TUTOR_SESSION_CHART_MAX_DAYS))

        const { startStr, endStr } = weekBounds
        const thisWeek = claimRows.filter((c) => c.session_date >= startStr && c.session_date <= endStr)
        setSessionsThisWeek(thisWeek.length)
        setHoursThisWeek(
          Math.round(thisWeek.reduce((s, c) => s + Number(c.hours ?? 0), 0) * 10) / 10,
        )

        setCoverageGapCount(
          claimRows.filter((c) => !c.coverage_validated_at && c.status !== "DRAFT").length,
        )
      } else {
        setClaims([])
        setChartSeries(buildDailyPointsFromClaims([], TUTOR_SESSION_CHART_MAX_DAYS))
        setSessionsThisWeek(0)
        setHoursThisWeek(0)
        setCoverageGapCount(0)
      }

      if (!schedulesRes.error && schedulesRes.data?.length) {
        const sources: TutorScheduleImportSource[] = []
        for (const row of schedulesRes.data) {
          const parsed = parseScheduleParseResultFromJson(row.parse_result)
          if (parsed) {
            sources.push({
              id: row.id,
              fileName: row.file_name,
              result: parsed,
            })
          }
        }
        const merged = mergeScheduleSources(sources)
        const tuition = merged.events.filter((ev) =>
          isTutorialTimetableEvent(ev, typeColumnFlagForEvent(ev, merged)),
        )
        const nowMs = Date.now()
        const next = tuition
          .filter((ev) => new Date(ev.start).getTime() >= nowMs)
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 5)
        setUpcomingEvents(next)
      } else {
        setUpcomingEvents([])
      }

      if (!notificationsRes.error && notificationsRes.data) {
        setNotifications(notificationsRes.data as NotificationRow[])
      } else {
        setNotifications([])
      }
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, weekBounds.startStr, weekBounds.endStr])

  const recentClaims = useMemo(() => {
    return [...claims].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5)
  }, [claims])

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const kpiItems = [
    {
      label: "Active students",
      value: booting ? null : activeStudents,
      sub: "Assigned on your roster",
      icon: Users,
    },
    {
      label: "Sessions this week",
      value: booting ? null : sessionsThisWeek,
      sub: "Claims in this calendar week (Mon–Sun)",
      icon: Video,
    },
    {
      label: "Hours this week",
      value: booting ? null : hoursThisWeek,
      sub: "Sum of claim hours this week",
      icon: Clock,
    },
    {
      label: "Pending claims",
      value: booting ? null : pendingClaimsCount,
      sub: "Draft or pending verification",
      icon: ListTodo,
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="font-medium text-foreground">
              {user.user_metadata?.full_name || user.email}
            </span>
            . Here&apos;s what&apos;s happening with your students.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" type="button" disabled>
            Download report
          </Button>
          <Button size="sm" type="button" disabled>
            New session
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </div>

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-destructive">Could not load some data</CardTitle>
            <CardDescription className="text-destructive/90">{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                {booting ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold tracking-tight">{k.value}</div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="border-border shadow-sm lg:col-span-4">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Session activity</CardTitle>
              <CardDescription>Sessions per day — hover a point to see hours worked</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="More options">
              <MoreHorizontal className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <TutorSessionsActivityChart
              series={chartSeries ?? undefined}
              seriesLoading={booting || chartSeries === null}
            />
          </CardContent>
          <CardFooter className="border-t bg-muted/20 py-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/tutor/sessions">View all sessions</Link>
            </Button>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-3">
          <Link
            to="/settings"
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-colors group-hover:border-primary/25 group-hover:bg-muted/25">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  <Settings className="size-5 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-base font-semibold">Account &amp; settings</CardTitle>
                  <CardDescription>Profile, email, and preferences — opens the same page as Settings in the sidebar.</CardDescription>
                </div>
                <ArrowUpRight
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </CardHeader>
            </Card>
          </Link>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-semibold">Upcoming sessions</CardTitle>
                <CardDescription>Tutorial slots from your saved timetable imports</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground" asChild>
                <Link to="/tutor/schedules">Calendar</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {booting ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground">No upcoming tutorial events. Import a schedule on the Schedules page.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.map((ev) => (
                    <li key={`${ev.start}-${ev.title}`} className="flex gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ev.start).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {ev.location ? ` · ${ev.location}` : ""}
                          {ev.moduleCode ? ` · ${ev.moduleCode}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-semibold">Pending claims</CardTitle>
                <CardDescription>Draft or awaiting verification</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-foreground" asChild>
                <Link to="/tutor/notes">Notes</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {booting ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : pendingPreviewClaims.length === 0 ? (
                <p className="text-muted-foreground">No pending claims right now.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingPreviewClaims.map((c) => (
                    <li key={c.id} className="flex flex-col gap-0.5 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <Link to="/tutor/notes" className="font-medium text-foreground hover:underline">
                        {c.module?.code ?? "Session"} · {c.session_date}
                      </Link>
                      <span className="text-xs capitalize text-muted-foreground">{formatClaimStatus(c.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Notifications</CardTitle>
              <CardDescription>Latest in-app messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {booting ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-muted-foreground">No notifications yet.</p>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{n.subject ?? n.type.replace(/_/g, " ")}</p>
                        {n.body ? <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                        {n.sent_at ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(n.sent_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {n.is_read === false ? " · Unread" : ""}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Coverage</CardTitle>
              <CardDescription>Claims still missing a coverage confirmation (non-draft)</CardDescription>
            </CardHeader>
            <CardContent>
              {booting ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">{coverageGapCount}</p>
              )}
              <Button variant="link" className="mt-1 h-auto px-0 text-xs" asChild>
                <Link to="/tutor/notes">Review in session notes</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
              <CardDescription>Latest updates to your session claims</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {booting ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : recentClaims.length === 0 ? (
                <p className="text-muted-foreground">No claims in the last {TUTOR_SESSION_CHART_MAX_DAYS} days.</p>
              ) : (
                recentClaims.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{c.module?.name ?? c.module?.code ?? "Session"}</span>{" "}
                      ({c.session_date}) — {formatClaimStatus(c.status)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
