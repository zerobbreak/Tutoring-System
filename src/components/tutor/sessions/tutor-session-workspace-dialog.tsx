import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Send,
  Trash2,
  Video,
} from "lucide-react";
import { SessionNotesPanel } from "#/components/tutor/notes/session-notes-panel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
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
  initialTab = "overview",
  onOpenChange,
  onSubmit,
  onDiscard,
}: {
  open: boolean;
  claim: TutorSessionClaimDTO | null;
  initialTab?: "overview" | "notes";
  onOpenChange: (open: boolean) => void;
  onSubmit: (claim: TutorSessionClaimDTO) => void;
  onDiscard: (claimId: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, claim?.id, initialTab]);

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

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "overview" | "notes")}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        <ScrollArea className="max-h-[min(60vh,34rem)] flex-1 px-6 py-4">
          {claim ? (
            <TabsContent value="notes" className="m-0">
              <SessionNotesPanel claimId={claim.id} />
            </TabsContent>
          ) : null}
          {claim ? (
            <TabsContent value="overview" className="m-0">
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
                    What we covered
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {claim.topics_covered}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-left text-xs text-amber-900 hover:bg-amber-500/10 dark:text-amber-100"
                  onClick={() => setTab("notes")}
                >
                  No notes yet — add what you covered before submitting.
                </button>
              )}
              <PrivateSessionFeedbackReadBlock
                claimId={claim.id}
                claimStatus={claim.status}
              />
            </div>
            </TabsContent>
          ) : null}
        </ScrollArea>
        </Tabs>

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
