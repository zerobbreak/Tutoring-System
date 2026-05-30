import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { TutorHourProgressCard } from "#/components/tutor/dashboard/tutor-hour-progress-card";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  claimBadgeLabel,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { cn } from "#/lib/utils";
import {
  COLUMN_META,
  SESSION_METRICS,
  type SessionMetricsKey,
} from "#/components/tutor/sessions/tutor-sessions-board-meta";
import type { SessionKanbanColumnId } from "#/lib/session-kanban-column";

const ALL_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
  "VERIFIED",
  "APPROVED",
];

const METRIC_TONE: Record<string, string> = {
  amber: "text-amber-700 dark:text-amber-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  lagoon: "text-lagoon-deep",
};

export function TutorSessionsPageHeader({
  onCreateSession,
}: {
  onCreateSession: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_-20%,var(--lagoon)_0%,transparent_55%)] opacity-[0.14]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5 md:p-6">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold tracking-widest text-lagoon-deep uppercase">
            Teaching operations
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Sessions
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Run today&apos;s classes, capture attendance, and submit claims. New
            sessions need admin approval before they appear on your timetable.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="hidden shrink-0 gap-2 self-start bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90 sm:inline-flex"
          onClick={onCreateSession}
        >
          <Plus className="size-4" />
          Request session
        </Button>
      </div>

      <div className="relative border-t border-border/60 bg-muted/20 px-4 py-3 sm:px-5 md:px-6">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Board columns
        </p>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(COLUMN_META) as SessionKanbanColumnId[]).map((id) => {
            const meta = COLUMN_META[id];
            const Icon = meta.headerIcon;
            return (
              <li
                key={id}
                className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/80 px-2.5 py-2"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60",
                    meta.iconClass,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {meta.shortTitle}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function TutorSessionsHourBudget({
  loading,
  hourBudget,
}: {
  loading: boolean;
  hourBudget: TutorHourBudgetSummary | null;
}) {
  if (!loading && !hourBudget?.totals.allocatedHours) return null;
  return (
    <div className="max-w-md">
      <TutorHourProgressCard booting={loading} hourBudget={hourBudget} />
    </div>
  );
}

export function TutorSessionsMetricsStrip({
  loading,
  stats,
}: {
  loading: boolean;
  stats: Record<SessionMetricsKey, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 shadow-sm lg:grid-cols-4">
      {SESSION_METRICS.map((metric) => {
        const Icon = metric.icon;
        const raw = stats[metric.key];
        const display =
          loading ? "—" : "suffix" in metric ? `${raw}${metric.suffix}` : String(raw);
        const tone =
          "tone" in metric && metric.tone
            ? METRIC_TONE[metric.tone]
            : "text-foreground";

        return (
          <div
            key={metric.key}
            className="flex items-center gap-3 bg-card px-3 py-3 sm:px-4"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">
                {metric.label}
              </p>
              {loading ? (
                <Skeleton className="mt-1 h-7 w-12" />
              ) : (
                <p
                  className={cn(
                    "text-xl font-semibold tabular-nums tracking-tight",
                    tone,
                  )}
                >
                  {display}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type TutorSessionsToolbarProps = {
  searchText: string;
  onSearchChange: (value: string) => void;
  moduleFilter: string | "all";
  onModuleFilter: (id: string | "all") => void;
  moduleOptions: [string, string][];
  dateFilter: Date | undefined;
  onDateFilter: (date: Date | undefined) => void;
  datePickOpen: boolean;
  onDatePickOpen: (open: boolean) => void;
  datePickTemp: Date | undefined;
  onDatePickTemp: (date: Date | undefined) => void;
  statusFilters: Set<ClaimStatus>;
  onToggleStatus: (status: ClaimStatus) => void;
  workspaceTab: "kanban" | "table";
  onWorkspaceTabChange: (tab: "kanban" | "table") => void;
  draftSelectSlot?: ReactNode;
  onClearFilters: () => void;
};

export function TutorSessionsToolbar({
  searchText,
  onSearchChange,
  moduleFilter,
  onModuleFilter,
  moduleOptions,
  dateFilter,
  onDateFilter,
  datePickOpen,
  onDatePickOpen,
  datePickTemp,
  onDatePickTemp,
  statusFilters,
  onToggleStatus,
  workspaceTab,
  onWorkspaceTabChange,
  draftSelectSlot,
  onClearFilters,
}: TutorSessionsToolbarProps) {
  const activeFilterCount =
    (moduleFilter !== "all" ? 1 : 0) +
    (dateFilter ? 1 : 0) +
    (statusFilters.size < ALL_STATUSES.length ? 1 : 0);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search module, venue, or session type…"
            className="h-10 w-full border-border/80 bg-background pl-9"
          />
        </div>

        <Tabs
          value={workspaceTab}
          onValueChange={(v) =>
            onWorkspaceTabChange(v === "table" ? "table" : "kanban")
          }
          className="shrink-0"
        >
          <TabsList className="h-10 w-full sm:w-auto">
            <TabsTrigger value="kanban" className="flex-1 gap-1.5 px-3 sm:flex-none sm:px-4">
              <LayoutGrid className="size-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="table" className="flex-1 gap-1.5 px-3 sm:flex-none sm:px-4">
              <Table2 className="size-4" />
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Filter className="size-3.5" />
          Filters
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={moduleFilter !== "all" ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1"
            >
              Module
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={() => onModuleFilter("all")}>
              All modules
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {moduleOptions.map(([id, label]) => (
              <DropdownMenuItem key={id} onSelect={() => onModuleFilter(id)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={dateFilter ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1"
            >
              <CalendarDays className="size-3.5" />
              {dateFilter ? format(dateFilter, "d MMM") : "Date"}
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onSelect={() => onDateFilter(undefined)}>
              Any date
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDateFilter(new Date(new Date().setHours(0, 0, 0, 0)))}
            >
              Today only
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDatePickOpen(true)}>
              Pick date…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={
                statusFilters.size < ALL_STATUSES.length ? "secondary" : "outline"
              }
              size="sm"
              className="h-8 gap-1"
            >
              Claim status
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Visible claim statuses</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilters.has(s)}
                onCheckedChange={() => onToggleStatus(s)}
              >
                {claimBadgeLabel(s)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {draftSelectSlot}

        {activeFilterCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-muted-foreground"
            onClick={onClearFilters}
          >
            <X className="size-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <Dialog open={datePickOpen} onOpenChange={onDatePickOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter by date</DialogTitle>
            <DialogDescription>
              Only sessions on this day appear on the board and in the list.
            </DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={datePickTemp}
            onSelect={onDatePickTemp}
            className="mx-auto rounded-md border p-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onDatePickOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (datePickTemp) onDateFilter(datePickTemp);
                onDatePickOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
