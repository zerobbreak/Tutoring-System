import { useNavigate } from "@tanstack/react-router";
import { Ban, ClipboardList, Loader2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { dayHeadingLong, formatTimeRange } from "#/lib/schedule-display";
import {
  isCancelledSessionStatus,
  scheduledSessionCardClass,
  scheduledSessionStatusLabel,
} from "#/lib/schedule-session-status";
import { cn } from "#/lib/utils";
import { useTutorScheduleOfficialActions } from "./tutor-schedule-official-dialogs";
import type {
  TutorScheduleFilterMode,
  TutorScheduleUiEvent,
} from "./tutor-schedule-types";

type TutorScheduleDayPanelProps = {
  selectedDay: Date | undefined;
  events: TutorScheduleUiEvent[];
  filterMode: TutorScheduleFilterMode;
  selectedEventId: string | null;
  sourcesCount: number;
  linkingEventId: string | null;
  onSelectEvent: (event: TutorScheduleUiEvent) => void;
  onManageImport: (event: TutorScheduleUiEvent) => void;
  onReloadOfficial: () => void | Promise<void>;
};

export function TutorScheduleDayPanel({
  selectedDay,
  events,
  filterMode,
  selectedEventId,
  sourcesCount,
  linkingEventId,
  onSelectEvent,
  onManageImport,
  onReloadOfficial,
}: TutorScheduleDayPanelProps) {
  const navigate = useNavigate();
  const { openChange, openSessionManage, dialogs } =
    useTutorScheduleOfficialActions(onReloadOfficial);

  return (
    <>
      <aside className="flex min-h-0 w-full shrink-0 flex-col bg-background lg:w-[min(100%,28rem)]">
        <header className="shrink-0 border-b border-border/40 px-4 py-4 md:px-6">
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground md:text-xl">
            {selectedDay ? dayHeadingLong(selectedDay) : "Pick a day"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {filterMode === "all"
              ? "All timetable events"
              : "Tutor sessions only"}
          </p>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 pb-8 md:px-6">
            {!selectedDay ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Select a day in the timetable
              </p>
            ) : events.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {filterMode === "all"
                  ? "No activity on this day."
                  : "No tutor sessions on this day. Switch to All to see the full timetable."}
              </p>
            ) : (
              <ul className="list-none space-y-4 pt-2">
                {events.map((ev) => {
                  const isOfficial = ev.source === "official";
                  const official = ev.officialPayload;
                  const cancelled =
                    isOfficial && official
                      ? isCancelledSessionStatus(official.status)
                      : false;
                  const canManage =
                    !isOfficial &&
                    !!ev.importSourceId?.trim() &&
                    !!ev.moduleCode?.trim();
                  const selected = selectedEventId === ev.id;

                  return (
                    <li key={ev.id}>
                      <div
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          isOfficial
                            ? scheduledSessionCardClass(
                                ev.status ?? "SCHEDULED",
                              )
                            : "border-border/60 bg-card",
                          selected && "ring-2 ring-(--lagoon-deep)/30",
                        )}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => onSelectEvent(ev)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "min-w-0 flex-1 text-base font-semibold leading-snug text-(--sea-ink)",
                                cancelled && "line-through text-muted-foreground",
                              )}
                            >
                              {ev.title}
                            </p>
                            <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatTimeRange(ev.start, ev.end)}
                            </time>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {isOfficial && official ? (
                              <Badge
                                variant={
                                  cancelled ? "destructive" : "secondary"
                                }
                                className="gap-1 text-[10px]"
                              >
                                {cancelled ? (
                                  <Ban className="size-3" aria-hidden />
                                ) : null}
                                {scheduledSessionStatusLabel(official.status)}
                              </Badge>
                            ) : null}
                            {ev.sessionType && !isOfficial ? (
                              <span className="uppercase tracking-wide">
                                {ev.sessionType}
                              </span>
                            ) : null}
                            {ev.moduleCode ? <span>{ev.moduleCode}</span> : null}
                            {ev.location ? <span>{ev.location}</span> : null}
                          </div>
                          {sourcesCount > 1 && ev.importSourceFile ? (
                            <p className="mt-1.5 text-[11px] text-muted-foreground/90">
                              From{" "}
                              <span className="font-medium">
                                {ev.importSourceFile}
                              </span>
                            </p>
                          ) : null}
                          {cancelled && official?.cancellationReason ? (
                            <p className="mt-1 text-xs text-destructive">
                              {official.cancellationReason}
                            </p>
                          ) : null}
                        </button>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {isOfficial && official ? (
                            <>
                              {official.claimId ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate({
                                      to: "/tutor/sessions",
                                      search: { claim: official.claimId! },
                                    })
                                  }
                                >
                                  Open session
                                </Button>
                              ) : null}
                              {!cancelled ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-destructive hover:text-destructive"
                                    onClick={() =>
                                      openSessionManage(official, "cancel")
                                    }
                                  >
                                    <Ban className="size-3.5" />
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openChange(official)}
                                  >
                                    Request change
                                  </Button>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={!canManage || linkingEventId === ev.id}
                              onClick={() => onManageImport(ev)}
                            >
                              {linkingEventId === ev.id ? (
                                <Loader2
                                  className="size-3.5 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <ClipboardList className="size-3.5" aria-hidden />
                              )}
                              Manage
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ScrollArea>
      </aside>
      {dialogs}
    </>
  );
}
