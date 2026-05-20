import { Ban } from "lucide-react";
import { formatTimeRange } from "#/lib/schedule-display";
import {
  isCancelledSessionStatus,
  scheduledSessionChipClass,
  scheduledSessionStatusLabel,
} from "#/lib/schedule-session-status";
import type { ScheduleEventDTO } from "./types";
import { cn } from "#/lib/utils";

type ScheduleEventChipProps = {
  event: ScheduleEventDTO;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (event: ScheduleEventDTO) => void;
};

export function ScheduleEventChip({
  event,
  compact,
  selected,
  onSelect,
}: ScheduleEventChipProps) {
  const venue = event.venueText || event.venueName;
  const title = `${event.moduleCode} ${event.title}`.trim();
  const cancelled = isCancelledSessionStatus(event.status);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(event);
      }}
      title={[
        title,
        event.tutorName,
        venue,
        scheduledSessionStatusLabel(event.status),
      ]
        .filter(Boolean)
        .join(" · ")}
      className={cn(
        "group/chip flex w-full min-w-0 flex-col rounded-md border-l-[3px] px-2 py-1 text-left transition-colors",
        scheduledSessionChipClass(event.status),
        selected &&
          !cancelled &&
          "ring-1 ring-(--lagoon-deep)/35",
        compact && "py-0.5",
      )}
    >
      <span className="flex items-center gap-1 truncate text-[11px] font-medium leading-tight">
        {cancelled ? (
          <Ban className="size-3 shrink-0 text-destructive" aria-hidden />
        ) : null}
        <span className={cn("truncate", cancelled && "line-through")}>
          {compact ? event.moduleCode : title}
        </span>
      </span>
      {!compact ? (
        <span className="truncate text-[10px] text-muted-foreground">
          {formatTimeRange(event.startsAt, event.endsAt)}
        </span>
      ) : cancelled ? (
        <span className="truncate text-[9px] font-medium text-destructive">
          Cancelled
        </span>
      ) : null}
    </button>
  );
}
