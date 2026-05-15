import { CalendarPlus } from "lucide-react";
import { Button } from "#/components/ui/button";

type ScheduleEmptyStateProps = {
  title?: string;
  description?: string;
  onCreateSeries?: () => void;
};

export function ScheduleEmptyState({
  title = "No sessions scheduled",
  description = "Create and publish a tutorial series to see sessions on the calendar.",
  onCreateSeries,
}: ScheduleEmptyStateProps) {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-(--lagoon-deep)/10">
        <CalendarPlus className="size-6 text-(--lagoon-deep)" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onCreateSeries ? (
        <Button type="button" className="mt-4" size="sm" onClick={onCreateSeries}>
          New tutorial series
        </Button>
      ) : null}
    </section>
  );
}
