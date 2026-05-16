import { Link } from "@tanstack/react-router";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  BarChart3,
  Loader2,
  Mail,
  MessageSquare,
  UserMinus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
  getLecturerTutorDetailFn,
  getOrCreateDirectConversationFn,
  removeTutorFromModuleFn,
  type LecturerTutorDetailDTO,
} from "#/server-actions/lecturer-tutors";

type LecturerTutorDetailSheetProps = {
  tutorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onMessage: (conversationId: string) => void;
};

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function LecturerTutorDetailSheet({
  tutorId,
  open,
  onOpenChange,
  onUpdated,
  onMessage,
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Tutor profile</SheetTitle>
          <SheetDescription>
            Performance, workload, and module assignments.
          </SheetDescription>
        </SheetHeader>

        {loading || !detail ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6 pb-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{detail.fullName}</p>
                <p className="text-sm text-muted-foreground">{detail.email}</p>
                {detail.lastLoginAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last login{" "}
                    {formatDistanceToNow(parseISO(detail.lastLoginAt), {
                      addSuffix: true,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                {detail.isInactive ? (
                  <Badge variant="outline" className="text-amber-800">
                    Inactive
                  </Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleMessage()}
                disabled={messaging}
              >
                <MessageSquare className="mr-2 size-4" />
                Message
              </Button>
              {detail.pendingClaims > 0 ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/lecturer/verification-queue">
                    Review {detail.pendingClaims} pending
                  </Link>
                </Button>
              ) : null}
            </div>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-muted-foreground">Sessions completed</p>
                <p className="text-lg font-semibold">{detail.sessionsCompleted}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-muted-foreground">Attendance avg</p>
                <p className="text-lg font-semibold">
                  {formatPercent(detail.attendanceAverage)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-muted-foreground">Approval rate</p>
                <p className="text-lg font-semibold">
                  {formatPercent(detail.approvalRate)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-muted-foreground">Total hours</p>
                <p className="text-lg font-semibold">
                  {detail.totalHours.toFixed(1)}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="size-4" />
                Insights
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  Open disputes: {detail.openDisputes} of {detail.disputeCount}{" "}
                  total
                </li>
                <li>
                  Upcoming sessions: {detail.upcomingSessions} · Cancelled:{" "}
                  {detail.cancelledSessions}
                </li>
                <li>
                  Schedule-linked claims:{" "}
                  {formatPercent(detail.scheduleLinkedRate)}
                </li>
                <li>
                  Rejected claims: {detail.rejectedClaims} · Disputed:{" "}
                  {detail.disputedClaims}
                </li>
              </ul>
              {detail.workloadByMonth.length > 0 ? (
                <div className="rounded-lg border p-3 text-xs">
                  <p className="mb-2 font-medium text-foreground">
                    Workload (recent months)
                  </p>
                  <ul className="space-y-1">
                    {detail.workloadByMonth.slice(-6).map((p) => (
                      <li
                        key={p.label}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>{p.label}</span>
                        <span>
                          {p.sessionCount} sessions · {p.hours.toFixed(1)}h
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4" />
                Assigned modules
              </h3>
              {detail.assignedModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active module assignments.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.assignedModules.map((a) => (
                    <li
                      key={a.assignmentId}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        {a.moduleCode} — {a.moduleName}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={removingId === a.moduleId}
                        onClick={() => void handleRemove(a.moduleId)}
                      >
                        <UserMinus className="mr-1 size-4" />
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detail.recentClaimIds.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Recent sessions</h3>
                <ul className="space-y-1">
                  {detail.recentClaimIds.map((id) => (
                    <li key={id}>
                      <Link
                        to="/lecturer/sessions"
                        search={{ claim: id }}
                        className="text-sm text-(--lagoon-deep) hover:underline"
                      >
                        View session
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Button variant="outline" className="w-full" asChild>
              <a href={`mailto:${detail.email}`}>
                <Mail className="mr-2 size-4" />
                Email tutor
              </a>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
