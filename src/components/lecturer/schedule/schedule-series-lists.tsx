import { Archive, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import type { ScheduleSeriesDTO } from "#/server-actions/lecturer-schedule";

type SeriesRowProps = {
  series: ScheduleSeriesDTO;
  actions: ReactNode;
};

function SeriesRow({ series, actions }: SeriesRowProps) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
      <span className="min-w-0 text-sm">
        <span className="font-medium">{series.moduleCode}</span>
        <span className="text-muted-foreground"> · {series.title} · </span>
        {series.tutorName}
      </span>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </article>
  );
}

export type ScheduleDraftSeriesListProps = {
  series: ScheduleSeriesDTO[];
  formBusy: boolean;
  publishLabel?: string;
  onPublish: (seriesId: string) => void;
  onDelete: (seriesId: string) => void;
};

export function ScheduleDraftSeriesList({
  series,
  formBusy,
  publishLabel = "Publish",
  onPublish,
  onDelete,
}: ScheduleDraftSeriesListProps) {
  if (series.length === 0) return null;

  return (
    <Card className="shrink-0 border-dashed border-(--lagoon-deep)/30 bg-(--lagoon-deep)/5">
      <CardContent className="flex flex-col gap-2 p-4">
        <p className="text-sm font-medium">Draft series</p>
        <p className="text-xs text-muted-foreground">
          Publish when ready, or delete drafts you no longer need.
        </p>
        {series.map((s) => (
          <SeriesRow
            key={s.id}
            series={s}
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={formBusy}
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete draft "${s.title}"? This cannot be undone.`,
                      )
                    ) {
                      return;
                    }
                    onDelete(s.id);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  disabled={formBusy}
                  onClick={() => onPublish(s.id)}
                >
                  {publishLabel}
                </Button>
              </>
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

export type SchedulePublishedSeriesListProps = {
  series: ScheduleSeriesDTO[];
  formBusy: boolean;
  onArchive: (seriesId: string) => void;
};

export function SchedulePublishedSeriesList({
  series,
  formBusy,
  onArchive,
}: SchedulePublishedSeriesListProps) {
  if (series.length === 0) return null;

  return (
    <Card className="shrink-0 border-border/80">
      <CardContent className="flex flex-col gap-2 p-4">
        <p className="text-sm font-medium">Published series</p>
        <p className="text-xs text-muted-foreground">
          Archive to stop future sessions. Past sessions stay on the record.
        </p>
        {series.map((s) => (
          <SeriesRow
            key={s.id}
            series={s}
            actions={
              <Button
                size="sm"
                variant="outline"
                disabled={formBusy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Archive "${s.title}"? Upcoming scheduled sessions will be cancelled.`,
                    )
                  ) {
                    return;
                  }
                  onArchive(s.id);
                }}
              >
                <Archive className="size-4" />
                Archive
              </Button>
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
