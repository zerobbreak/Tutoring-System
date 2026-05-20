import { format } from "date-fns";
import { AlertTriangle, MessageSquare, X } from "lucide-react";
import { useState } from "react";
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
import type { TutorSessionRequestDTO } from "#/server-actions/lecturer-schedule";

type TutorSessionRequestsPanelProps = {
  requests: TutorSessionRequestDTO[];
  busyId: string | null;
  onReview: (
    claimId: string,
    decision: "REJECTED" | "CHANGES_REQUESTED",
    feedback?: string,
  ) => void;
};

export function TutorSessionRequestsPanel({
  requests,
  busyId,
  onReview,
}: TutorSessionRequestsPanelProps) {
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackMode, setFeedbackMode] = useState<
    "CHANGES_REQUESTED" | "REJECTED"
  >("CHANGES_REQUESTED");

  if (!requests.length) return null;

  const openFeedback = (
    claimId: string,
    mode: "CHANGES_REQUESTED" | "REJECTED",
  ) => {
    setFeedbackOpen(claimId);
    setFeedbackMode(mode);
    setFeedbackText("");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tutor session requests</CardTitle>
          <CardDescription>
            New sessions tutors asked to add. Admin approves and adds them to the
            schedule; you can reject or suggest changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {requests.map((req) => {
            const busy = busyId === req.id;
            const cap = req.capacity;
            return (
              <article
                key={req.id}
                className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 lg:flex-row lg:items-start lg:justify-between"
              >
                <section className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {req.moduleCode} · {req.moduleName}
                  </p>
                  <p className="text-muted-foreground">
                    {req.tutorName} · {req.sessionKind ?? "session"} ·{" "}
                    {req.sessionDate} · {req.startTime.slice(0, 5)}–
                    {req.endTime.slice(0, 5)}
                    {req.venue ? ` · ${req.venue}` : ""}
                  </p>
                  <p className="text-foreground">
                    {req.hours.toFixed(1)}h requested
                    {req.requestReason ? ` — ${req.requestReason}` : ""}
                  </p>
                  {cap.warning ? (
                    <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {cap.warning}
                    </p>
                  ) : cap.allocatedHours != null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cap.availableHours}h available of {cap.allocatedHours}h
                      allocated ({cap.reservedHours}h already reserved)
                    </p>
                  ) : null}
                  {req.reviewFeedback ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prior feedback: {req.reviewFeedback}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {format(new Date(req.updatedAt), "MMM d, yyyy HH:mm")}
                  </p>
                </section>
                <section className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openFeedback(req.id, "REJECTED")}
                  >
                    <X className="mr-1 size-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => openFeedback(req.id, "CHANGES_REQUESTED")}
                  >
                    <MessageSquare className="mr-1 size-4" />
                    Suggest changes
                  </Button>
                </section>
              </article>
            );
          })}
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
                : "Describe what the tutor should change before resubmitting."}
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
              onClick={() => {
                if (!feedbackOpen) return;
                onReview(feedbackOpen, feedbackMode, feedbackText.trim());
                setFeedbackOpen(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
