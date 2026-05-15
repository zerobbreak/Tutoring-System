import { Link } from "@tanstack/react-router";
import { Clock, MapPin, User } from "lucide-react";
import { formatTimeRange } from "#/lib/schedule-display";
import type { ScheduleEventDTO } from "./types";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";

type ScheduleEventCardProps = {
  event: ScheduleEventDTO;
  className?: string;
  onSelect?: (event: ScheduleEventDTO) => void;
  selected?: boolean;
};

export function ScheduleEventCard({
  event,
  className,
  onSelect,
  selected,
}: ScheduleEventCardProps) {
  const venue = event.venueText || event.venueName;
  const label = `${event.moduleCode} ${event.title}`.trim();

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      className={cn(
        "w-full rounded-lg border border-border/80 bg-card p-3 text-left shadow-sm transition-colors hover:border-(--lagoon-deep)/40 hover:bg-muted/30",
        selected && "border-(--lagoon-deep) ring-1 ring-(--lagoon-deep)/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{event.tutorName}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatTimeRange(event.startsAt, event.endsAt)}
          </p>
          {venue ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{venue}</span>
            </p>
          ) : null}
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {event.status}
        </Badge>
      </div>
      {event.claimId ? (
        <Link
          to="/lecturer/sessions"
          search={{ claim: event.claimId }}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-block text-xs font-medium text-(--lagoon-deep) hover:underline"
        >
          Monitor session
        </Link>
      ) : null}
    </button>
  );
}
