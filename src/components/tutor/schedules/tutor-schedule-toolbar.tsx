import {
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type {
  TutorScheduleFilterMode,
  TutorScheduleView,
} from "./tutor-schedule-types";
import type { TutorScheduleImportSource } from "#/lib/tutor-schedule-imports";

const WEEK_STARTS_ON = 1 as const;

const VIEWS: { id: TutorScheduleView; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];

type TutorScheduleToolbarProps = {
  focusDate: Date;
  view: TutorScheduleView;
  filterMode: TutorScheduleFilterMode;
  sources: TutorScheduleImportSource[];
  busy: boolean;
  loadingSaved: boolean;
  onFocusDateChange: (date: Date) => void;
  onViewChange: (view: TutorScheduleView) => void;
  onFilterModeChange: (mode: TutorScheduleFilterMode) => void;
  onToday: () => void;
  onOpenImport: () => void;
  onClearImports: () => void;
  onRemoveSource: (id: string) => void;
};

export function TutorScheduleToolbar({
  focusDate,
  view,
  filterMode,
  sources,
  busy,
  loadingSaved,
  onFocusDateChange,
  onViewChange,
  onFilterModeChange,
  onToday,
  onOpenImport,
  onClearImports,
  onRemoveSource,
}: TutorScheduleToolbarProps) {
  const weekStart = startOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekLabel =
    view === "week"
      ? `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`
      : format(focusDate, "MMMM yyyy");

  const shiftPeriod = (delta: number) => {
    if (view === "month") {
      onFocusDateChange(
        delta > 0 ? addMonths(focusDate, 1) : subMonths(focusDate, 1),
      );
    } else {
      onFocusDateChange(
        delta > 0 ? addWeeks(focusDate, 1) : subWeeks(focusDate, 1),
      );
    }
  };

  return (
    <div className="shrink-0 space-y-3 border-b border-border/40 px-3 py-2 sm:px-4 sm:py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={view === "month" ? "Previous month" : "Previous week"}
            onClick={() => shiftPeriod(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={view === "month" ? "Next month" : "Next week"}
            onClick={() => shiftPeriod(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="min-w-[10rem] px-2 text-sm font-semibold tabular-nums text-foreground">
            {weekLabel}
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={onToday}
        >
          Today
        </Button>

        <div
          className="flex items-center rounded-lg border border-border/60 p-0.5"
          role="group"
          aria-label="Calendar view"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === v.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onViewChange(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            className="flex items-center rounded-lg border border-border/60 p-0.5"
            role="group"
            aria-label="Event filter"
          >
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filterMode === "all"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onFilterModeChange("all")}
            >
              All
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filterMode === "tutor"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onFilterModeChange("tutor")}
            >
              Tutor
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={busy || loadingSaved}
            onClick={onOpenImport}
          >
            <Plus className="size-3.5" />
            Import
          </Button>
        </div>
      </div>

      {sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <FileSpreadsheet
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          {sources.map((s) => (
            <span
              key={s.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
            >
              <span className="max-w-48 truncate font-medium" title={s.fileName}>
                {s.fileName}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                ({s.result.events.length})
              </span>
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label={`Remove ${s.fileName}`}
                disabled={busy || loadingSaved}
                onClick={() => onRemoveSource(s.id)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
            disabled={busy || loadingSaved}
            onClick={onClearImports}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
