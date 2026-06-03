import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Percent,
  UserMinus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
  getLecturerTutorDetailFn,
  getOrCreateDirectConversationFn,
  removeTutorFromModuleFn,
  type LecturerTutorDetailDTO,
} from "#/server-actions/lecturer-tutors";
import { TutorHourAllocationsPanel } from "./tutor-hour-allocations-panel";

type LecturerTutorDetailSheetProps = {
  tutorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onMessage: (conversationId: string) => void;
  modules: { id: string; code: string; name: string }[];
};

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function DetailSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10">
          <Icon className="size-4 text-(--lagoon-deep)" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          {description ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/20 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export function LecturerTutorDetailSheet({
  tutorId,
  open,
  onOpenChange,
  onUpdated,
  onMessage,
  modules,
}: LecturerTutorDetailSheetProps) {
  const [detail, setDetail] = useState<LecturerTutorDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tutorId) return;
    setLoading(true);
    try {
      const data = await getLecturerTutorDetailFn({ data: { tutorId } });
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tutor");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [tutorId, onOpenChange]);

  useEffect(() => {
    if (open && tutorId) void load();
    else setDetail(null);
  }, [open, tutorId, load]);

  const handleMessage = async () => {
    if (!tutorId) return;
    setMessaging(true);
    try {
      const { conversationId } = await getOrCreateDirectConversationFn({
        data: { tutorId },
      });
      onMessage(conversationId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open conversation");
    } finally {
      setMessaging(false);
    }
  };

  const handleRemove = async (moduleId: string) => {
    if (!tutorId) return;
    setRemovingId(moduleId);
    try {
      await removeTutorFromModuleFn({ data: { moduleId, tutorId } });
      toast.success("Tutor removed from module.");
      await load();
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove tutor");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">Tutor profile</SheetTitle>
          <SheetDescription className="text-pretty">
            Performance, workload, and module assignments.
          </SheetDescription>
        </SheetHeader>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b bg-linear-to-br from-(--lagoon-deep)/10 via-background to-background px-6 py-5">
              <div className="flex items-start gap-4">
                <Avatar className="size-14 shrink-0 ring-2 ring-(--lagoon-deep)/15">
                  <AvatarFallback className="text-lg">
                    {getInitials(detail.fullName) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="truncate text-lg font-semibold tracking-tight">
                    {detail.fullName}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {detail.email}
                  </p>
                  {detail.lastLoginAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last login{" "}
                      {formatDistanceToNow(parseISO(detail.lastLoginAt), {
                        addSuffix: true,
                      })}
                    </p>
                  ) : null}
                  <div className="mt-2.5">
                    {detail.isInactive ? (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-800"
                      >
                        Inactive
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-800"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleMessage()}
                  disabled={messaging}
                >
                  <MessageSquare className="size-4" />
                  Message
                </Button>
                {detail.pendingClaims > 0 ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={APP_PATHS.lecturer.verificationQueue}>
                      Review {detail.pendingClaims} pending
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5">
              <section className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Sessions completed"
                  value={detail.sessionsCompleted}
                  icon={CheckCircle2}
                />
                <StatCard
                  label="Attendance avg"
                  value={formatPercent(detail.attendanceAverage)}
                  icon={Percent}
                />
                <StatCard
                  label="Approval rate"
                  value={formatPercent(detail.approvalRate)}
                  icon={Percent}
                />
                <StatCard
                  label="Total hours"
                  value={detail.totalHours.toFixed(1)}
                  icon={Clock}
                />
              </section>

              <DetailSection
                title="Insights"
                description="Claims, sessions, and dispute activity."
                icon={BarChart3}
              >
                <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                  <li>
                    Open disputes:{" "}
                    <span className="font-medium text-foreground">
                      {detail.openDisputes} of {detail.disputeCount} total
                    </span>
                  </li>
                  <li>
                    Upcoming sessions:{" "}
                    <span className="font-medium text-foreground">
                      {detail.upcomingSessions}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · Cancelled: {detail.cancelledSessions}
                    </span>
                  </li>
                  <li>
                    Schedule-linked claims:{" "}
                    <span className="font-medium text-foreground">
                      {formatPercent(detail.scheduleLinkedRate)}
                    </span>
                  </li>
                  <li>
                    Rejected claims:{" "}
                    <span className="font-medium text-foreground">
                      {detail.rejectedClaims}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · Disputed: {detail.disputedClaims}
                    </span>
                  </li>
                </ul>
              </DetailSection>

              {detail.workloadByMonth.length > 0 ? (
                <DetailSection
                  title="Workload"
                  description="Recent months by session count and hours."
                  icon={CalendarDays}
                >
                  <ul className="divide-y rounded-lg border bg-muted/20">
                    {detail.workloadByMonth.slice(-6).map((p) => (
                      <li
                        key={p.label}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {p.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {p.sessionCount} sessions · {p.hours.toFixed(1)}h
                        </span>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              ) : null}

              <DetailSection
                title="Assigned modules"
                description="Modules this tutor is currently assigned to."
                icon={Users}
              >
                {detail.assignedModules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active module assignments.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.assignedModules.map((a) => (
                      <li
                        key={a.assignmentId}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 font-medium leading-snug">
                          <span className="text-foreground">{a.moduleCode}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — {a.moduleName}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-destructive hover:text-destructive"
                          disabled={removingId === a.moduleId}
                          onClick={() => void handleRemove(a.moduleId)}
                        >
                          <UserMinus className="size-4" />
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>

              <DetailSection
                title="Hour allocations"
                description="Caps per module and semester; scheduled sessions reserve hours immediately."
                icon={Clock}
              >
                {tutorId ? (
                  <TutorHourAllocationsPanel tutorId={tutorId} modules={modules} />
                ) : null}
              </DetailSection>

              {detail.recentClaimIds.length > 0 ? (
                <DetailSection
                  title="Recent sessions"
                  icon={CheckCircle2}
                >
                  <ul className="space-y-1.5">
                    {detail.recentClaimIds.map((id) => (
                      <li key={id}>
                        <Link
                          to={APP_PATHS.lecturer.sessions}
                          search={{ claim: id }}
                          className="text-sm font-medium text-(--lagoon-deep) hover:underline"
                        >
                          View session
                        </Link>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              ) : null}

              <Button variant="outline" className="w-full" asChild>
                <a href={`mailto:${detail.email}`}>
                  <Mail className="size-4" />
                  Email tutor
                </a>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
