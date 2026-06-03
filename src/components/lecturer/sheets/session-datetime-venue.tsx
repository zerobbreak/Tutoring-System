import { format, parseISO } from "date-fns";
import { Calendar, MapPin } from "lucide-react";
import { formatClock } from "#/lib/session-claim-display";

export function SessionDateTimeVenue({
  sessionDate,
  startTime,
  endTime,
  venue,
}: {
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
}) {
  return (
    <ul className="space-y-3 text-sm">
      <li className="flex gap-3">
        <Calendar
          className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Session</p>
          <p className="mt-0.5 font-medium leading-snug text-foreground">
            {format(parseISO(sessionDate), "EEE, d MMM yyyy")} ·{" "}
            {formatClock(startTime)}–{formatClock(endTime)}
          </p>
        </div>
      </li>
      {venue ? (
        <li className="flex gap-3">
          <MapPin
            className="mt-0.5 size-4 shrink-0 text-(--lagoon-deep)"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Venue</p>
            <p className="mt-0.5 font-medium text-foreground">{venue}</p>
          </div>
        </li>
      ) : null}
    </ul>
  );
}
