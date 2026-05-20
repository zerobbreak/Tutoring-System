import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertTriangle, Check, Loader2, MessageSquare, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { toast } from "#/lib/toast";
import {
  approveTutorSessionCreationFn,
  listPendingTutorSessionCreationsFn,
  rejectTutorSessionCreationFn,
  suggestChangesTutorSessionCreationFn,
  type PendingTutorSessionCreationDTO,
} from "#/server-actions/admin-sessions";

function formatRequestedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "MMM d, yyyy HH:mm");
}

export function AdminTutorSessionCreationsPanel({
  items: controlledItems,
  loading: controlledLoading,
  onChanged,
  showViewAllLink = false,
}: {
  items?: PendingTutorSessionCreationDTO[];
  loading?: boolean;
  onChanged?: () => void;
  showViewAllLink?: boolean;
}) {
  const isControlled = controlledItems !== undefined;
  const [loading, setLoading] = useState(!isControlled);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTutorSessionCreationDTO[]>(
    controlledItems ?? [],
  );
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackMode, setFeedbackMode] = useState<
    "CHANGES_REQUESTED" | "REJECTED"
  >("CHANGES_REQUESTED");

  const load = useCallback(async () => {
    if (isControlled) return;
    setLoading(true);
    try {
      const rows = await listPendingTutorSessionCreationsFn();
      setPending(rows);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load tutor session requests",
      );
    } finally {
      setLoading(false);
    }
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) {
      setPending(controlledItems);
      return;
    }
    void load();
  }, [isControlled, controlledItems, load]);

  const refresh = async () => {
    if (isControlled) {
      onChanged?.();
    } else {
      await load();
    }
  };

  const approve = async (claimId: string, canApprove: boolean) => {
    if (!canApprove) {
      toast.error("Cannot approve — hour allocation would be exceeded.");
      return;
    }
    setBusyId(claimId);
    try {
      await approveTutorSessionCreationFn({ data: { claimId } });
      toast.success("Session approved and added to schedule");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  };

  const confirmFeedback = async () => {
    if (!feedbackOpen) return;
    setBusyId(feedbackOpen);
    try {
      if (feedbackMode === "REJECTED") {
        await rejectTutorSessionCreationFn({
          data: {
            claimId: feedbackOpen,
            feedback: feedbackText.trim() || undefined,
          },
        });
        toast.success("Session request rejected");
      } else {
        await suggestChangesTutorSessionCreationFn({
          data: { claimId: feedbackOpen, feedback: feedbackText.trim() },
        });
        toast.success("Feedback sent to tutor");
      }
      setFeedbackOpen(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update request");
    } finally {
      setBusyId(null);
    }
  };

  const showLoading = isControlled ? (controlledLoading ?? false) : loading;

  if (showLoading) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" />
            Tutor session requests
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (pending.length === 0) return null;

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4 text-amber-700 dark:text-amber-300" />
              Tutor session requests
            </CardTitle>
            <CardDescription>
              {pending.length} request{pending.length === 1 ? "" : "s"} awaiting
              approval. Approved sessions are published to the schedule.
            </CardDescription>
          </div>
          {showViewAllLink ? (
            <Button variant="ghost" size="sm" className="shrink-0" asChild>
              <Link to="/admin/sessions">All sessions</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="divide-y rounded-md border bg-card/80">
            {pending.map((row) => {
              const busy = busyId === row.id;
              const tutorName =
                row.tutor?.full_name?.trim() || row.tutor?.email || "Tutor";
              const moduleLabel = row.module
                ? `${row.module.code} — ${row.module.name}`
                : "Module";
              const cap = row.capacity;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">{moduleLabel}</p>
                    <p className="text-muted-foreground">
                      {tutorName} · {row.session_kind ?? "session"} ·{" "}
                      {row.session_date} · {row.start_time.slice(0, 5)}–
                      {row.end_time.slice(0, 5)}
                      {row.venue ? ` · ${row.venue}` : ""}
                    </p>
                    {row.request_reason ? (
                      <p className="mt-1 text-foreground">{row.request_reason}</p>
                    ) : null}
                    {cap.warning ? (
                      <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {cap.warning}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Requested {formatRequestedAt(row.updated_at)} ·{" "}
                      {row.hours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setFeedbackMode("REJECTED");
                        setFeedbackText("");
                        setFeedbackOpen(row.id);
                      }}
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setFeedbackMode("CHANGES_REQUESTED");
                        setFeedbackText("");
                        setFeedbackOpen(row.id);
                      }}
                    >
                      <MessageSquare className="size-4" />
                      Suggest changes
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || !cap.canApprove}
                      title={
                        !cap.canApprove ? (cap.warning ?? undefined) : undefined
                      }
                      onClick={() => void approve(row.id, cap.canApprove)}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Approve
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog
        open={feedbackOpen != null}
        onOpenChange={(o) => !o && setFeedbackOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feedbackMode === "REJECTED"
                ? "Reject session request"
                : "Suggest changes"}
            </DialogTitle>
            <DialogDescription>
              {feedbackMode === "REJECTED"
                ? "Optional note for the tutor."
                : "Required — tutor can edit and resubmit."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Feedback</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                feedbackMode === "CHANGES_REQUESTED" &&
                feedbackText.trim().length < 3
              }
              onClick={() => void confirmFeedback()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
