import { CalendarClock, Loader2 } from "lucide-react";
import { cn } from "#/lib/utils";

type TutorScheduleOfficialStripProps = {
  loading: boolean;
  weekOfficialCount: number;
  totalOfficialCount: number;
};

export function TutorScheduleOfficialStrip({
  loading,
  weekOfficialCount,
  totalOfficialCount,
}: TutorScheduleOfficialStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground md:px-6",
        "border-b border-border/30 bg-(--lagoon-deep)/5",
      )}
    >
      <CalendarClock
        className="size-3.5 shrink-0 text-(--lagoon-deep)"
        aria-hidden
      />
      {loading ? (
        <>
          <Loader2 className="size-3 animate-spin" aria-hidden />
          <span>Loading lecturer schedule…</span>
        </>
      ) : totalOfficialCount === 0 ? (
        <span>No lecturer-assigned sessions in the next 8 weeks.</span>
      ) : weekOfficialCount === 0 ? (
        <span>
          {totalOfficialCount} official session
          {totalOfficialCount === 1 ? "" : "s"} in the next 8 weeks (none this
          week).
        </span>
      ) : (
        <span>
          <span className="font-medium text-foreground">
            {weekOfficialCount}
          </span>{" "}
          official session{weekOfficialCount === 1 ? "" : "s"} this week ·{" "}
          {totalOfficialCount} total in the next 8 weeks
        </span>
      )}
    </div>
  );
}
