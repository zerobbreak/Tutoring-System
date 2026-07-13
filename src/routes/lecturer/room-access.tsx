import { createFileRoute, redirect } from "@tanstack/react-router";
import { endOfDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { LecturerRoomAccessView } from "#/components/lecturer/room-access/lecturer-room-access-view";
import { useLecturerRoomAccessData } from "#/components/lecturer/room-access/use-lecturer-room-access-data";
import { rangeForView } from "#/components/lecturer/schedule/schedule-range";
import type { ScheduleCalendarView } from "#/components/lecturer/schedule/types";
import { APP_PATHS } from "#/lib/app-paths";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { useSessionUser } from "#/lib/use-session-user";

export const Route = createFileRoute("/lecturer/room-access")({
  component: LecturerRoomAccessPage,
});

function LecturerRoomAccessPage() {
  const { user, pending } = useSessionUser();
  const [view, setView] = useState<ScheduleCalendarView>("week");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));

  const range = useMemo(() => rangeForView(view, focusDate), [view, focusDate]);
  const from = range.from.toISOString();
  const to = endOfDay(range.to).toISOString();

  const {
    access,
    items,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useLecturerRoomAccessData({
    enabled: !!user,
    from,
    to,
  });

  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  if (isSuccess && access && !access.canAccess) {
    throw redirect({ to: APP_PATHS.lecturer.home });
  }

  return (
    <QueryPageGate
      sessionPending={pending || !user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading room access…"
    >
      <LecturerRoomAccessView
        booting={isLoading}
        loadError={feedback.loadError}
        onRetryLoad={feedback.onRetryLoad}
        retryingLoad={feedback.retryingLoad}
        view={view}
        focusDate={focusDate}
        items={items}
        currentUserId={user?.id ?? null}
        onViewChange={setView}
        onFocusDateChange={setFocusDate}
        onReload={() => void invalidate()}
      />
    </QueryPageGate>
  );
}
