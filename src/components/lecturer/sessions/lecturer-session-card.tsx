import { Link } from "@tanstack/react-router";
import { APP_PATHS } from "#/lib/app-paths";
import { format, parseISO } from "date-fns";
import { Clock, MapPin, User } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { claimBadgeLabel, claimBadgeVariant, formatClock } from "#/lib/session-claim-display";
import { cn } from "#/lib/utils";
import type { LecturerSessionCardDTO } from "#/server-actions/lecturer-sessions";

type LecturerSessionCardProps = {
  session: LecturerSessionCardDTO;
  selected?: boolean;
  onSelect: (session: LecturerSessionCardDTO) => void;
};

export function LecturerSessionCard({
  session,
  selected,
  onSelect,
}: LecturerSessionCardProps) {
  const dateLabel = format(parseISO(session.session_date), "EEE d MMM");

  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      className={cn(
        "w-full rounded-lg border border-border/80 bg-card p-3 text-left shadow-sm transition-colors hover:border-(--lagoon-deep)/40 hover:bg-muted/30",
        selected && "border-(--lagoon-deep) ring-1 ring-(--lagoon-deep)/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {session.module?.code} · {session.module?.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatClock(session.start_time)}–{formatClock(session.end_time)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            {session.tutor?.id ? (
              <Link
                to={APP_PATHS.lecturer.tutors}
                search={{ tutor: session.tutor.id }}
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:underline"
              >
                {session.tutor.full_name}
              </Link>
            ) : (
              <span className="truncate">{session.tutor?.full_name ?? "Tutor"}</span>
            )}
          </p>
          {session.venue ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{session.venue}</span>
            </p>
          ) : null}
        </div>
        <Badge variant={claimBadgeVariant(session.status)} className="shrink-0 text-[10px]">
          {claimBadgeLabel(session.status)}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {session.missing_evidence ? (
          <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
            Missing evidence
          </Badge>
        ) : null}
        {session.low_attendance ? (
          <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
            Low attendance
          </Badge>
        ) : null}
        {session.completion_verified ? (
          <Badge variant="outline" className="text-[10px] text-emerald-700">
            Verified
          </Badge>
        ) : null}
        {session.linked_from_schedule ? (
          <Badge variant="secondary" className="text-[10px]">
            Scheduled
          </Badge>
        ) : null}
      </div>
    </button>
  );
}
