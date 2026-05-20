import { Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardRecentMessages } from "#/components/tutor/dashboard/dashboard-recent-messages";
import { TutorHourProgressCard } from "#/components/tutor/dashboard/tutor-hour-progress-card";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { useDashboardPreferences } from "#/lib/dashboard-preferences";
import {
  listConversationsFn,
  type ConversationDTO,
} from "#/server-actions/messaging";
import {
  TutorSessionsActivityChart,
  type SessionDayPoint,
} from "#/components/tutor-sessions-activity-chart";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import type { ScheduleParsedEvent } from "#/lib/schedule-spreadsheet";
import { formatClaimStatus } from "#/lib/session-claim-display";
import type {
  DashboardClaimDTO,
  DashboardNotificationDTO,
} from "#/server-actions/tutor-dashboard";

type TutorDashboardViewProps = {
  user: {
    email?: string;
    user_metadata?: Record<string, string | undefined>;
  };
  booting: boolean;
  loadError: string | null;
  activeStudents: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  pendingClaimsCount: number;
  coverageGapCount: number;
  claims: DashboardClaimDTO[];
  chartSeries: SessionDayPoint[] | null;
  pendingPreviewClaims: DashboardClaimDTO[];
  upcomingEvents: ScheduleParsedEvent[];
  notifications: DashboardNotificationDTO[];
  hourBudget: TutorHourBudgetSummary | null;
};

export function TutorDashboardView({
  user,
  booting,
  loadError,
  activeStudents,
  sessionsThisWeek,
  hoursThisWeek,
  pendingClaimsCount,
  coverageGapCount,
  claims,
  chartSeries,
  pendingPreviewClaims,
  upcomingEvents,
  notifications,
}: TutorDashboardViewProps) {
  const { prefs } = useDashboardPreferences();
  const [messageConversations, setMessageConversations] = useState<
    ConversationDTO[]
  >([]);

  useEffect(() => {
    if (!prefs.dashboard_show_messages) {
      setMessageConversations([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const convs = (await listConversationsFn({
          data: {},
        })) as ConversationDTO[];
        if (!cancelled) setMessageConversations(convs);
      } catch {
        if (!cancelled) setMessageConversations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs.dashboard_show_messages]);

  const recentClaims = useMemo(() => {
    return [...claims].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5);
  }, [claims]);

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
  ];

  const rootGap = prefs.dashboard_compact_mode ? "gap-4" : "gap-6";

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className={`mx-auto flex w-full max-w-7xl flex-col p-6 md:p-8 ${rootGap}`}>
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
            <CardTitle className="text-sm font-medium text-destructive">
              Could not load some data
            </CardTitle>
            <CardDescription className="text-destructive/90">{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {prefs.dashboard_show_stats ? (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {k.label}
                </CardTitle>
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
          );
        })}
      </div>
      ) : null}

      <div className={`grid lg:grid-cols-7 ${prefs.dashboard_compact_mode ? "gap-4" : "gap-6"}`}>
        <Card className="border-border shadow-sm lg:col-span-4">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Session activity</CardTitle>
              <CardDescription>
                Sessions per day — hover a point to see hours worked
              </CardDescription>
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

        <div className={`flex flex-col lg:col-span-3 ${prefs.dashboard_compact_mode ? "gap-4" : "gap-6"}`}>
          <TutorHourProgressCard booting={booting} hourBudget={hourBudget} />
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
                  <CardDescription>
                    Profile, email, and preferences — opens the same page as Settings in the sidebar.
                  </CardDescription>
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
                <p className="text-muted-foreground">
                  No upcoming tutorial events. Import a schedule on the Schedules page.
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.map((ev) => (
                    <li
                      key={`${ev.start}-${ev.title}`}
                      className="flex gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
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
                <Link to="/tutor/claims">View All</Link>
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
                    <li
                      key={c.id}
                      className="flex flex-col gap-0.5 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
                      <Link
                        to="/tutor/claims/$claimId"
                        params={{ claimId: c.id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {c.module?.code ?? "Session"} · {c.session_date}
                      </Link>
                      <span className="text-xs capitalize text-muted-foreground">
                        {formatClaimStatus(c.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {prefs.dashboard_show_messages ? (
            <DashboardRecentMessages
              booting={booting}
              conversations={messageConversations}
            />
          ) : null}

          {prefs.dashboard_show_notifications ? (
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
                    <li
                      key={n.id}
                      className="flex gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
                      <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {n.subject ?? n.type.replace(/_/g, " ")}
                        </p>
                        {n.body ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        ) : null}
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
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Coverage</CardTitle>
              <CardDescription>
                Claims still missing a coverage confirmation (non-draft)
              </CardDescription>
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
                <p className="text-muted-foreground">No recent claim activity.</p>
              ) : (
                recentClaims.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.module?.name ?? c.module?.code ?? "Session"}
                      </span>{" "}
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
    </ScrollArea>
  );
}
