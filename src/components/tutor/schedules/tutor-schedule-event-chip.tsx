import { formatTimeRange } from "#/lib/schedule-display";
import {
  isCancelledSessionStatus,
  scheduledSessionChipClass,
  scheduledSessionStatusLabel,
} from "#/lib/schedule-session-status";
import { cn } from "#/lib/utils";
import type { TutorScheduleFilterMode, TutorScheduleUiEvent } from "./tutor-schedule-types";

type TutorScheduleEventChipProps = {
  event: TutorScheduleUiEvent;
  selected?: boolean;
  filterMode: TutorScheduleFilterMode;
  onSelect?: (event: TutorScheduleUiEvent) => void;
};

export function TutorScheduleEventChip({
  event,
  selected,
  filterMode,
  onSelect,
}: TutorScheduleEventChipProps) {
  const isOfficial = event.source === "official";
  const officialStatus = isOfficial ? (event.status ?? "SCHEDULED") : null;
  const cancelled =
    isOfficial && officialStatus
      ? isCancelledSessionStatus(officialStatus)
      : false;
  const venue = event.location;
  const label = [event.moduleCode, event.title].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(event);
      }}
      title={[
        label,
        venue,
        isOfficial && officialStatus
          ? scheduledSessionStatusLabel(officialStatus)
          : event.sessionType,
      ]
        .filter(Boolean)
        .join(" · ")}
      className={cn(
        "group/chip flex w-full min-w-0 flex-col rounded-md border-l-[3px] px-2 py-1 text-left text-[11px] transition-colors",
        isOfficial && officialStatus
          ? scheduledSessionChipClass(officialStatus)
          : "border-l-border/80 bg-muted/30 hover:bg-muted/50",
        isOfficial && "border-l-(--lagoon-deep)",
        !isOfficial && event.isTutorial && "border-l-(--lagoon-deep)/70",
        selected && "ring-1 ring-(--lagoon-deep)/35",
        cancelled && "opacity-75",
      )}
    >
      <span className="tabular-nums text-[10px] text-muted-foreground">
        {formatTimeRange(event.start, event.end)}
      </span>
      <span
        className={cn(
          "line-clamp-2 font-medium leading-tight text-foreground",
          cancelled && "line-through",
        )}
      >
        {label || event.title}
      </span>
      {venue ? (
        <span className="truncate text-[10px] text-muted-foreground">{venue}</span>
      ) : null}
      <div className="mt-0.5 flex flex-wrap gap-1">
        {isOfficial ? (
          <span className="rounded bg-(--lagoon-deep)/12 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-(--lagoon-deep)">
            Official
          </span>
        ) : null}
        {!isOfficial && filterMode === "all" && event.isTutorial ? (
          <span className="rounded bg-(--lagoon-deep)/10 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-(--lagoon-deep)">
            Tutor
          </span>
        ) : null}
        {event.sessionType && !isOfficial ? (
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/80">
            {event.sessionType}
          </span>
        ) : null}
      </div>
    </button>
  );
}
