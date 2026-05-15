import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import type { ScheduleCalendarView } from "./types";

const VIEWS: { id: ScheduleCalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

type ScheduleCalendarToolbarProps = {
  headerLabel: string;
  view: ScheduleCalendarView;
  onViewChange: (view: ScheduleCalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  className?: string;
};

export function ScheduleCalendarToolbar({
  headerLabel,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  className,
}: ScheduleCalendarToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
          {headerLabel}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => onViewChange(v as ScheduleCalendarView)}
          >
            <TabsList className="h-9">
              {VIEWS.map((v) => (
                <TabsTrigger key={v.id} value={v.id} className="px-3 text-xs sm:text-sm">
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onPrev}
              aria-label="Previous period"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => onToday()}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onNext}
              aria-label="Next period"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
