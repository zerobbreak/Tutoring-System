import { useState } from "react";
import { format, isToday, parseISO } from "date-fns";
import { Lock, Unlock } from "lucide-react";
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
import { venueUnlockStatusLabel } from "#/lib/venue-access";
import { toast } from "#/lib/toast";
import type { VenueUnlockBoardItemDTO } from "#/server-actions/venue-unlock";
import {
  claimVenueUnlockFn,
  releaseVenueUnlockFn,
} from "#/server-actions/venue-unlock";
import { boardItemUnlockBadgeClass } from "./room-access-helpers";

type RoomAccessSessionDialogProps = {
  item: VenueUnlockBoardItemDTO | null;
  currentUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function RoomAccessSessionDialog({
  item,
  currentUserId,
  open,
  onOpenChange,
  onUpdated,
}: RoomAccessSessionDialogProps) {
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const start = parseISO(item.startsAt);
  const end = parseISO(item.endsAt);
  const canClaim = item.status === "PENDING" || item.status === "URGENT";
  const isClaimant =
    item.claimedById != null && item.claimedById === currentUserId;

  const handleClaim = async () => {
    setBusy(true);
    try {
      await claimVenueUnlockFn({
        data: { scheduledSessionId: item.scheduledSessionId },
      });
      toast.success("You will open this room.");
      onOpenChange(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not claim");
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async () => {
    setBusy(true);
    try {
      await releaseVenueUnlockFn({
        data: { scheduledSessionId: item.scheduledSessionId },
      });
      toast.success("Claim released.");
      onOpenChange(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not release");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-amber-600" />
            {item.venueName ?? "Computer room"}
          </DialogTitle>
          <DialogDescription>
            {item.moduleCode} · {item.tutorName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">When: </span>
            {format(start, "EEE d MMM yyyy")} · {format(start, "HH:mm")}–
            {format(end, "HH:mm")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={boardItemUnlockBadgeClass(item.status)}>
              {venueUnlockStatusLabel(item.status)}
            </Badge>
            {item.claimedByName ? (
              <span className="text-muted-foreground">
                Claimed by {item.claimedByName}
              </span>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {canClaim ? (
            <Button disabled={busy} onClick={() => void handleClaim()}>
              <Unlock className="mr-2 size-4" />
              I will open
            </Button>
          ) : null}
          {isClaimant ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void handleRelease()}
            >
              Release claim
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RoomAccessTodayPanelProps = {
  items: VenueUnlockBoardItemDTO[];
  onSelect: (item: VenueUnlockBoardItemDTO) => void;
};

export function RoomAccessTodayPanel({
  items,
  onSelect,
}: RoomAccessTodayPanelProps) {
  const todayItems = items
    .filter((item) => isToday(parseISO(item.startsAt)))
    .sort(
      (a, b) =>
        parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime(),
    );

  if (!todayItems.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No computer-room sessions scheduled for today.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {todayItems.map((item) => (
        <li key={item.scheduledSessionId}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {format(parseISO(item.startsAt), "HH:mm")} · {item.venueName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.moduleCode} · {item.tutorName}
              </p>
            </div>
            <Badge className={boardItemUnlockBadgeClass(item.status)}>
              {item.claimedByName ?? venueUnlockStatusLabel(item.status)}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}
