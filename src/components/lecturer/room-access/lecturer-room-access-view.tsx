import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isWithinInterval,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { ScheduleCalendarBody } from "#/components/lecturer/schedule/schedule-calendar-body";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type { VenueUnlockBoardItemDTO } from "#/server-actions/venue-unlock";
import {
  boardItemToScheduleEvent,
} from "./room-access-helpers";
import {
  RoomAccessSessionDialog,
  RoomAccessTodayPanel,
} from "./room-access-panels";

function navigateFocus(
  view: ScheduleCalendarView,
  focusDate: Date,
  direction: -1 | 1,
): Date {
  if (view === "month") {
    return direction === 1 ? addMonths(focusDate, 1) : subMonths(focusDate, 1);
  }
  if (view === "week") {
    return direction === 1 ? addWeeks(focusDate, 1) : subWeeks(focusDate, 1);
  }
  if (view === "agenda") {
    return direction === 1 ? addDays(focusDate, 14) : subDays(focusDate, 14);
  }
  return direction === 1 ? addDays(focusDate, 1) : subDays(focusDate, 1);
}

type LecturerRoomAccessViewProps = {
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  view: ScheduleCalendarView;
  focusDate: Date;
  items: VenueUnlockBoardItemDTO[];
  currentUserId: string | null;
  onViewChange: (view: ScheduleCalendarView) => void;
  onFocusDateChange: (date: Date) => void;
  onReload: () => void;
};

export function LecturerRoomAccessView({
  booting,
  loadError,
  onRetryLoad,
  retryingLoad,
  view,
  focusDate,
  items,
  currentUserId,
  onViewChange,
  onFocusDateChange,
  onReload,
}: LecturerRoomAccessViewProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const range = rangeForView(view, focusDate);
  const eventsInRange = useMemo(() => {
    return items
      .filter((item) => {
        const start = new Date(item.startsAt);
        return isWithinInterval(start, { start: range.from, end: range.to });
      })
      .map(boardItemToScheduleEvent);
  }, [items, range.from, range.to]);

  const selectedItem =
    items.find((i) => i.scheduledSessionId === selectedSessionId) ?? null;

  const headerLabel = useMemo(() => {
    if (view === "month") return format(focusDate, "MMMM yyyy");
    if (view === "week") {
      const { from, to } = rangeForView("week", focusDate);
      return `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
    }
    if (view === "agenda") return "Next 30 days";
    return format(focusDate, "EEEE, d MMMM yyyy");
  }, [view, focusDate]);

  const handleSelectEvent = (event: { id: string }) => {
    setSelectedSessionId(event.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <header>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <KeyRound className="size-7 text-(--lagoon-deep)" />
            Room access
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Master timetable for computer rooms requiring staff unlock. Claim
            sessions you will open so colleagues know the task is handled.
          </p>
        </header>

        {loadError ? (
          <QueryErrorBanner
            message={loadError}
            onRetry={onRetryLoad}
            retrying={retryingLoad}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today</CardTitle>
            <CardDescription>
              Sessions needing a door open today — tap to claim
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoomAccessTodayPanel
              items={items}
              onSelect={(item) => setSelectedSessionId(item.scheduledSessionId)}
            />
          </CardContent>
        </Card>

        <ScheduleCalendarBody
          booting={booting}
          view={view}
          focusDate={focusDate}
          headerLabel={headerLabel}
          eventsInRange={eventsInRange}
          selectedEventId={selectedSessionId}
          onViewChange={onViewChange}
          onFocusDateChange={onFocusDateChange}
          onPrev={() => onFocusDateChange(navigateFocus(view, focusDate, -1))}
          onNext={() => onFocusDateChange(navigateFocus(view, focusDate, 1))}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      <RoomAccessSessionDialog
        item={selectedItem}
        currentUserId={currentUserId}
        open={selectedItem != null}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionId(null);
        }}
        onUpdated={onReload}
      />
    </div>
  );
}
