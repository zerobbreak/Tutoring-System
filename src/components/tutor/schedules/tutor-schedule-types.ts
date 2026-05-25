import { format, startOfDay } from "date-fns";
import {
  isTutorialTimetableEvent,
  type ScheduleParseResult,
  type ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet";
import { typeColumnFlagForEvent } from "#/lib/schedule-display";
import type { TutorAssignedScheduleEventDTO } from "#/server-actions/tutor-assigned-schedule";

export type TutorScheduleView = "week" | "month" | "agenda";

export type TutorScheduleFilterMode = "all" | "tutor";

export type TutorScheduleUiEvent = {
  id: string;
  source: "import" | "official";
  start: string;
  end: string;
  title: string;
  moduleCode?: string;
  location?: string;
  sessionType?: string;
  isTutorial: boolean;
  status?: string;
  importSourceId?: string;
  importSourceFile?: string;
  officialPayload?: TutorAssignedScheduleEventDTO;
  importPayload?: ScheduleParsedEvent;
};

export function dayKeyFromUiDate(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

export function mapImportToUiEvent(
  ev: ScheduleParsedEvent,
  result: ScheduleParseResult,
  idx: number,
): TutorScheduleUiEvent {
  const typeFlag = typeColumnFlagForEvent(ev, result);
  return {
    id: `import-${ev.importSourceId ?? "local"}-${ev.start}-${ev.title}-${idx}`,
    source: "import",
    start: ev.start,
    end: ev.end,
    title: ev.title,
    moduleCode: ev.moduleCode,
    location: ev.location,
    sessionType: ev.sessionType,
    isTutorial: isTutorialTimetableEvent(ev, typeFlag),
    importSourceId: ev.importSourceId,
    importSourceFile: ev.importSourceFile,
    importPayload: ev,
  };
}

export function mapOfficialToUiEvent(
  ev: TutorAssignedScheduleEventDTO,
): TutorScheduleUiEvent {
  return {
    id: `official-${ev.id}`,
    source: "official",
    start: ev.startsAt,
    end: ev.endsAt,
    title: ev.title,
    moduleCode: ev.moduleCode,
    location: ev.venueLabel ?? undefined,
    sessionType: "Official",
    isTutorial: true,
    status: ev.status,
    officialPayload: ev,
  };
}

export function mapImportEvents(
  events: ScheduleParsedEvent[],
  result: ScheduleParseResult,
): TutorScheduleUiEvent[] {
  return events.map((ev, idx) => mapImportToUiEvent(ev, result, idx));
}

export function mergeUiEvents(
  importEvents: TutorScheduleUiEvent[],
  officialEvents: TutorScheduleUiEvent[],
): TutorScheduleUiEvent[] {
  return [...importEvents, ...officialEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export function filterUiEvents(
  events: TutorScheduleUiEvent[],
  mode: TutorScheduleFilterMode,
): TutorScheduleUiEvent[] {
  if (mode === "all") return events;
  return events.filter((ev) => ev.isTutorial);
}

export function indexUiEventsByDay(
  events: TutorScheduleUiEvent[],
): Map<string, TutorScheduleUiEvent[]> {
  const map = new Map<string, TutorScheduleUiEvent[]>();
  for (const ev of events) {
    const key = ev.start.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(ev);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }
  return map;
}

export function officialCountInWeek(
  events: TutorAssignedScheduleEventDTO[],
  weekStart: Date,
  weekEnd: Date,
): number {
  const from = weekStart.getTime();
  const to = weekEnd.getTime();
  return events.filter((ev) => {
    const t = new Date(ev.startsAt).getTime();
    return t >= from && t <= to;
  }).length;
}
