import { Check, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { formatTimeRange } from "#/lib/schedule-display";
import type { ScheduleChangeRequestDTO } from "#/server-actions/lecturer-schedule";

type ScheduleChangeRequestsPanelProps = {
  requests: ScheduleChangeRequestDTO[];
  busyId: string | null;
  onReview: (requestId: string, decision: "APPROVED" | "REJECTED") => void;
};

export function ScheduleChangeRequestsPanel({
  requests,
  busyId,
  onReview,
}: ScheduleChangeRequestsPanelProps) {
  if (!requests.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending schedule changes</CardTitle>
        <CardDescription>
          Tutors requested changes to assigned sessions — approve or reject.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requests.map((req) => (
          <article
            key={req.id}
            className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <section className="min-w-0 text-sm">
              <p className="font-medium">
                {req.moduleCode} · {req.sessionTitle}
              </p>
              <p className="text-muted-foreground">
                {req.tutorName} · was{" "}
                {formatTimeRange(req.currentStartsAt, req.currentEndsAt)}
              </p>
              <p className="text-foreground">
                Proposed:{" "}
                {formatTimeRange(req.proposedStartsAt, req.proposedEndsAt)}
                {req.proposedVenueName ? ` · ${req.proposedVenueName}` : ""}
              </p>
              {req.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">{req.reason}</p>
              ) : null}
            </section>
            <section className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === req.id}
                onClick={() => onReview(req.id, "REJECTED")}
              >
                <X className="mr-1 size-4" />
                Reject
              </Button>
              <Button
                size="sm"
                disabled={busyId === req.id}
                onClick={() => onReview(req.id, "APPROVED")}
              >
                <Check className="mr-1 size-4" />
                Approve
              </Button>
            </section>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
