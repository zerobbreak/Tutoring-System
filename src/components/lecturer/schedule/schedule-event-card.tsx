import { Link } from "@tanstack/react-router";
import { Ban, Clock, MapPin, RotateCcw, Trash2, User } from "lucide-react";
import { formatTimeRange } from "#/lib/schedule-display";
import {
  isCancelledSessionStatus,
  scheduledSessionCardClass,
  scheduledSessionStatusLabel,
} from "#/lib/schedule-session-status";
import type { ScheduleEventDTO } from "./types";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type { ScheduleSessionManageAction } from "./schedule-session-manage-dialog";

export type ScheduleEventCardProps = {
  event: ScheduleEventDTO;
  className?: string;
  onSelect?: (event: ScheduleEventDTO) => void;
  selected?: boolean;
  manageRole?: "admin" | "tutor" | null;
  onManageAction?: (
    event: ScheduleEventDTO,
    action: ScheduleSessionManageAction,
  ) => void;
  monitorHref?: { to: string; search?: Record<string, string> };
  showTutorLink?: boolean;
};

export function ScheduleEventCard({
  event,
  className,
  onSelect,
  selected,
  manageRole,
  onManageAction,
  monitorHref,
  showTutorLink,
}: ScheduleEventCardProps) {
  const venue = event.venueText || event.venueName;
  const label = `${event.moduleCode} ${event.title}`.trim();
  const cancelled = isCancelledSessionStatus(event.status);
  const canManage = Boolean(manageRole && onManageAction && !cancelled);
  const canRestore = manageRole === "admin" && onManageAction && cancelled;
  const canDelete = manageRole === "admin" && onManageAction;

  return (
    <div
      className={cn(
        "w-full rounded-lg border p-3 text-left shadow-sm transition-colors",
        scheduledSessionCardClass(event.status),
        selected && !cancelled && "border-(--lagoon-deep) ring-1 ring-(--lagoon-deep)/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect?.(event)}
          className={cn(
            "min-w-0 flex-1 text-left",
            cancelled && "line-through decoration-destructive/50",
          )}
        >
          <p className="truncate font-medium text-foreground">{label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            {showTutorLink ? (
              <Link
                to="/lecturer/tutors"
                search={{ tutor: event.tutorId }}
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:underline"
              >
                {event.tutorName}
              </Link>
            ) : (
              <span className="truncate">{event.tutorName}</span>
            )}
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
          {cancelled && event.cancellationReason ? (
            <p className="mt-2 text-xs text-destructive">{event.cancellationReason}</p>
          ) : null}
        </button>
        <Badge
          variant={cancelled ? "destructive" : "secondary"}
          className="shrink-0 gap-1 text-[10px]"
        >
          {cancelled ? <Ban className="size-3" aria-hidden /> : null}
          {scheduledSessionStatusLabel(event.status)}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {event.claimId && monitorHref ? (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link to={monitorHref.to} search={monitorHref.search}>
              Open session
            </Link>
          </Button>
        ) : event.claimId && manageRole !== "tutor" ? (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link
              to="/lecturer/sessions"
              search={{ claim: event.claimId }}
            >
              Monitor session
            </Link>
          </Button>
        ) : null}

        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={() => onManageAction?.(event, "cancel")}
          >
            <Ban className="size-3.5" />
            Cancel
          </Button>
        ) : null}

        {canRestore ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => onManageAction?.(event, "restore")}
          >
            <RotateCcw className="size-3.5" />
            Restore
          </Button>
        ) : null}

        {canDelete && !cancelled ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={() => onManageAction?.(event, "delete")}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
