import { format, parseISO } from "date-fns";
import { CalendarX2, MapPin, User } from "lucide-react";
import { Button } from "#/components/ui/button";
import { formatTimeRange } from "#/lib/schedule-display";
import type { CancelledScheduleRowDTO } from "#/server-actions/lecturer-sessions";

type CancelledScheduleRowProps = {
  row: CancelledScheduleRowDTO;
  onOpenClaim?: (claimId: string) => void;
};

export function CancelledScheduleRow({ row, onOpenClaim }: CancelledScheduleRowProps) {
  const day = format(parseISO(row.starts_at), "EEE d MMM yyyy");

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <CalendarX2 className="size-4 text-muted-foreground" />
          {row.module_code} · {row.title}
        </p>
        <p className="mt-1 text-muted-foreground">{day}</p>
        <p className="text-muted-foreground">
          {formatTimeRange(row.starts_at, row.ends_at)}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
          <User className="size-3.5" />
          {row.tutor_name}
        </p>
        {row.venue_text ? (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-3.5" />
            {row.venue_text}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Schedule cancelled (not a rejected claim)
        </p>
      </div>
      {row.linked_claim_id && onOpenClaim ? (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => onOpenClaim(row.linked_claim_id!)}
        >
          View linked session
        </Button>
      ) : null}
    </article>
  );
}
