import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { ArrowUpRight, Clock, MoreHorizontal, Settings, Star, TrendingUp, Users, Video } from "lucide-react"
import { TutorSessionsActivityChart } from "#/components/tutor-sessions-activity-chart"
import { Button } from "#/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"

const rootRouteApi = getRouteApi("__root__")

export const Route = createFileRoute("/tutor/")({
  component: TutorDashboard,
})

const KPI_CARDS = [
  {
    label: "Active students",
    value: "12",
    delta: "+2",
    deltaLabel: "from last month",
    trend: "up" as const,
    icon: Users,
  },
  {
    label: "Sessions this week",
    value: "8",
    delta: "+12.5%",
    deltaLabel: "vs prior week",
    trend: "up" as const,
    icon: Video,
  },
  {
    label: "Hours taught",
    value: "45",
    delta: "+4.5%",
    deltaLabel: "steady growth",
    trend: "up" as const,
    icon: Clock,
  },
  {
    label: "Avg. rating",
    value: "4.9",
    delta: "Top 5%",
    deltaLabel: "among tutors",
    trend: "neutral" as const,
    icon: Star,
  },
]

function TutorDashboard() {
  const { sessionData } = rootRouteApi.useLoaderData()
  const user = sessionData?.user

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

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
          <Button variant="outline" size="sm">
            Download report
          </Button>
          <Button size="sm">
            New session
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{k.value}</div>
                <p className="text-xs text-muted-foreground">
                  {k.trend === "up" && (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-500">
                      <TrendingUp className="size-3" />
                      {k.delta}
                    </span>
                  )}
                  {k.trend === "neutral" && (
                    <span className="font-medium text-foreground">{k.delta}</span>
                  )}{" "}
                  <span className="text-muted-foreground">{k.deltaLabel}</span>
                </p>
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
            <TutorSessionsActivityChart />
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
            <CardHeader>
              <CardTitle className="text-base font-semibold">Resources</CardTitle>
              <CardDescription>Guides and templates for your next class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="secondary" className="w-full justify-between" size="sm">
                Lesson plan template
                <ArrowUpRight className="size-4 opacity-60" />
              </Button>
              <Button variant="secondary" className="w-full justify-between" size="sm">
                Parent communication kit
                <ArrowUpRight className="size-4 opacity-60" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
              <CardDescription>Latest updates from your workspace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Sarah Miller</span> submitted session
                  feedback.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Quantum Physics</span> was scheduled for
                  tomorrow.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
