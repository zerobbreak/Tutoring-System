import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import type { SessionTimelineEntryDTO } from "#/server-actions/scheduled-sessions";

const CATEGORY_LABELS: Record<
  SessionTimelineEntryDTO["category"],
  string
> = {
  SCHEDULE: "Schedule",
  CLAIM: "Claim",
  ATTENDANCE: "Attendance",
  SYSTEM: "System",
};

type SessionActivityTimelineProps = {
  entries: SessionTimelineEntryDTO[];
  loading?: boolean;
};

export function SessionActivityTimeline({
  entries,
  loading = false,
}: SessionActivityTimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading activity…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity recorded for this session yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border/80 pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-(--lagoon-deep)"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2">
            <time
              className="text-xs tabular-nums text-muted-foreground"
              dateTime={entry.at}
            >
              {format(parseISO(entry.at), "HH:mm · dd MMM yyyy")}
            </time>
            <Badge variant="outline" className="text-[10px] font-normal">
              {CATEGORY_LABELS[entry.category]}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-snug text-foreground">{entry.label}</p>
          {entry.actorName ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.actorName}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
