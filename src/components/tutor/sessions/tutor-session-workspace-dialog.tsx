import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  MapPin,
  Send,
  StickyNote,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { ScrollArea } from "#/components/ui/scroll-area";
import { PrivateSessionFeedbackReadBlock } from "#/components/private-session-feedback/private-session-feedback-read-block";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
} from "#/lib/session-claim-display";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

export function TutorSessionWorkspaceDialog({
  open,
  claim,
  onOpenChange,
  onSubmit,
  onDiscard,
}: {
  open: boolean;
  claim: TutorSessionClaimDTO | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (claim: TutorSessionClaimDTO) => void;
  onDiscard: (claimId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 border-b border-border/60 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {claim?.module?.code ? (
              <span className="rounded-md bg-lagoon/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-lagoon-deep">
                {claim.module.code}
              </span>
            ) : null}
            {claim ? (
              <>
                <Badge variant={claimBadgeVariant(claim.status)}>
                  {claimBadgeLabel(claim.status)}
                </Badge>
                {claim.session_kind ? (
                  <Badge variant="outline" className="font-normal capitalize">
                    {claim.session_kind}
                  </Badge>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="space-y-1 text-left">
            <DialogTitle className="font-display text-xl leading-tight">
              Session workspace
            </DialogTitle>
            <DialogDescription className="text-sm leading-snug">
              {claim?.module?.name ?? "Teaching session"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[min(52vh,28rem)] flex-1 px-6 py-4">
          {claim ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                    Date
                  </p>
                  <p className="mt-1 font-medium tabular-nums text-foreground">
                    {format(
                      parseISO(`${claim.session_date}T12:00:00`),
                      "d MMM yyyy",
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    Time
                  </p>
                  <p className="mt-1 font-medium tabular-nums text-foreground">
                    {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    Venue
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {claim.venue ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Video className="size-3.5 shrink-0" aria-hidden />
                    Hours
                  </p>
                  <p className="mt-1 font-medium tabular-nums text-foreground">
                    {claim.hours.toFixed(1)}
                  </p>
                </div>
              </div>

              {claim.topics_covered ? (
                <div className="rounded-lg border border-border/70 bg-card p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Topics covered
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {claim.topics_covered}
                  </p>
                </div>
              ) : null}
              {claim.notes ? (
                <div className="rounded-lg border border-border/70 bg-card p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Session notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {claim.notes}
                  </p>
                </div>
              ) : null}
              <PrivateSessionFeedbackReadBlock
                claimId={claim.id}
                claimStatus={claim.status}
              />
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="flex-col gap-3 border-t border-border/60 bg-muted/10 px-6 py-4 sm:flex-col">
          {claim?.status === "DRAFT" ? (
            <Button
              type="button"
              className="w-full gap-2 bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90"
              onClick={() => onSubmit(claim)}
            >
              <Send className="size-4" />
              Submit claim
            </Button>
          ) : null}
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <Link
                to="/tutor/notes"
                search={{
                  claim: claim?.id,
                  focus: Date.now(),
                }}
              >
                <StickyNote className="size-4 text-(--lagoon-deep)" />
                Open notes
              </Link>
            </Button>
            {claim?.status === "DRAFT" ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDiscard(claim.id)}
              >
                <Trash2 className="size-4" />
                Discard draft
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
