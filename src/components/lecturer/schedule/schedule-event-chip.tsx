import { formatTimeRange } from "#/lib/schedule-display";
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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(event);
      }}
      title={[title, event.tutorName, venue].filter(Boolean).join(" · ")}
      className={cn(
        "group/chip flex w-full min-w-0 flex-col rounded-md border-l-[3px] border-l-(--lagoon-deep) bg-(--lagoon-deep)/8 px-2 py-1 text-left transition-colors hover:bg-(--lagoon-deep)/14",
        selected && "bg-(--lagoon-deep)/18 ring-1 ring-(--lagoon-deep)/35",
        compact && "py-0.5",
      )}
    >
      <span className="truncate text-[11px] font-medium leading-tight text-foreground">
        {compact ? event.moduleCode : title}
      </span>
      {!compact ? (
        <span className="truncate text-[10px] text-muted-foreground">
          {formatTimeRange(event.startsAt, event.endsAt)}
        </span>
      ) : null}
    </button>
  );
}
