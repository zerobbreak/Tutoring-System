import { useNavigate } from "@tanstack/react-router";
import { endOfWeek, startOfDay, startOfWeek } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
  clearTutorScheduleImportsFn,
  deleteTutorScheduleImportFn,
  ensureSessionClaimForScheduleEventFn,
  listTutorScheduleImportsFn,
  saveTutorScheduleImportFn,
} from "#/server-actions/tutor-schedule";
import { isTutorialTimetableEvent } from "#/lib/schedule-spreadsheet";
import {
  mergeScheduleSources,
  type TutorScheduleImportSource,
} from "#/lib/tutor-schedule-imports";
import { fileToBase64 } from "#/lib/file-base64";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import { TutorScheduleAgendaView } from "#/components/tutor/schedules/tutor-schedule-agenda-view";
import { TutorScheduleDayPanel } from "#/components/tutor/schedules/tutor-schedule-day-panel";
import { TutorScheduleImportSheet } from "#/components/tutor/schedules/tutor-schedule-import-sheet";
import { TutorScheduleMonthView } from "#/components/tutor/schedules/tutor-schedule-month-view";
import { TutorScheduleOfficialStrip } from "#/components/tutor/schedules/tutor-schedule-official-strip";
import { TutorScheduleParseAlert } from "#/components/tutor/schedules/tutor-schedule-parse-alert";
import { TutorScheduleToolbar } from "#/components/tutor/schedules/tutor-schedule-toolbar";
import { TutorScheduleWeekView } from "#/components/tutor/schedules/tutor-schedule-week-view";
import { TutorScheduleUploadZone } from "#/components/tutor/schedules/tutor-schedule-upload-zone";
import {
  dayKeyFromUiDate,
  filterUiEvents,
  indexUiEventsByDay,
  mapImportEvents,
  mapOfficialToUiEvent,
  mergeUiEvents,
  officialCountInWeek,
  type TutorScheduleFilterMode,
  type TutorScheduleUiEvent,
  type TutorScheduleView,
} from "#/components/tutor/schedules/tutor-schedule-types";
import { useTutorAssignedSchedule } from "#/components/tutor/schedules/use-tutor-assigned-schedule";

const WEEK_STARTS_ON = 1 as const;

const SAMPLE_CSV = `Title,Start,End,Module code,Room,Type
Meridian hour,2026-02-16T12:00:00,2026-02-16T12:50:00,,LR 07,Other
INSY lecture,2026-02-16T08:00:00,2026-02-16T09:50:00,INSY6211,LR 10,Lecture
PROG6221 CR 1_Tutor session,2026-02-17T10:00:00,2026-02-17T11:00:00,PROG6221,CR 1,Tutorial
PROG6221 consult hour,2026-02-18T09:00:00,2026-02-18T10:00:00,PROG6221,CR 2,Tutorial
INSY6211 tutorial slot,2026-02-19T13:00:00,2026-02-19T14:30:00,INSY6211,LR 05,Tutorial
Programming lab,2026-02-17T14:00:00,2026-02-17T15:50:00,PROG6221,CR 1,Lab
`;

type ScheduleSource = TutorScheduleImportSource;

export function TutorSchedulesPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [sources, setSources] = useState<ScheduleSource[]>([]);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null);

  const [view, setView] = useState<TutorScheduleView>("week");
  const [filterMode, setFilterMode] = useState<TutorScheduleFilterMode>("all");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() =>
    startOfDay(new Date()),
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const {
    events: officialEvents,
    loading: officialLoading,
    reload: reloadOfficial,
  } = useTutorAssignedSchedule();

  const result = useMemo(() => mergeScheduleSources(sources), [sources]);

  const importUiEvents = useMemo(
    () => mapImportEvents(result.events, result),
    [result],
  );

  const officialUiEvents = useMemo(
    () => officialEvents.map(mapOfficialToUiEvent),
    [officialEvents],
  );

  const allUiEvents = useMemo(
    () => mergeUiEvents(importUiEvents, officialUiEvents),
    [importUiEvents, officialUiEvents],
  );

  const displayEvents = useMemo(
    () => filterUiEvents(allUiEvents, filterMode),
    [allUiEvents, filterMode],
  );

  const byDay = useMemo(
    () => indexUiEventsByDay(displayEvents),
    [displayEvents],
  );

  const weekStart = startOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(focusDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekOfficialCount = officialCountInWeek(
    officialEvents,
    weekStart,
    weekEnd,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSaved(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setTutorId(null);
        setSources([]);
        setLoadingSaved(false);
        return;
      }
      setTutorId(user.id);
      let next: ScheduleSource[] = [];
      try {
        next = await listTutorScheduleImportsFn();
      } catch (e) {
        if (!cancelled) {
          toast.error(
            `Could not load saved schedules: ${e instanceof Error ? e.message : "Unknown error"}`,
          );
        }
        next = [];
      }
      if (cancelled) return;
      setSources(next);
      setLoadingSaved(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const didAutoFocus = useRef(false);
  useEffect(() => {
    if (displayEvents.length === 0) {
      didAutoFocus.current = false;
      return;
    }
    if (didAutoFocus.current) return;
    didAutoFocus.current = true;
    const sorted = [...displayEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    const first = startOfDay(new Date(sorted[0]!.start));
    setFocusDate(first);
    setSelectedDay(first);
  }, [displayEvents]);

  const selectedDayKey = dayKeyFromUiDate(selectedDay);
  const selectedDayEvents = byDay.get(selectedDayKey) ?? [];

  const hasAnySchedule =
    sources.length > 0 || officialEvents.length > 0;
  const showEmptyLanding =
    !loadingSaved && !officialLoading && !hasAnySchedule;

  const goToday = () => {
    const t = startOfDay(new Date());
    setFocusDate(t);
    setSelectedDay(t);
  };

  const handleSelectDate = (date: Date) => {
    const d = startOfDay(date);
    setSelectedDay(d);
    setFocusDate(d);
    setSelectedEventId(null);
  };

  const handleSelectEvent = (ev: TutorScheduleUiEvent) => {
    setSelectedEventId(ev.id);
    setSelectedDay(startOfDay(new Date(ev.start)));
  };

  const openSessionWorkspace = useCallback(
    async (ev: TutorScheduleUiEvent) => {
      const payload = ev.importPayload;
      if (!payload?.importSourceId) {
        toast.error("This row is not linked to a saved import.");
        return;
      }
      if (!payload.moduleCode?.trim()) {
        toast.error("Add a module code to manage this session.");
        return;
      }
      setLinkingEventId(ev.id);
      try {
        const { claimId } = await ensureSessionClaimForScheduleEventFn({
          data: {
            importId: payload.importSourceId,
            start: payload.start,
            end: payload.end,
            title: payload.title,
            moduleCode: payload.moduleCode,
            location: payload.location,
            sessionType: payload.sessionType,
          },
        });
        navigate({
          to: "/tutor/sessions",
          search: { claim: claimId },
        });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not open session",
        );
      } finally {
        setLinkingEventId(null);
      }
    },
    [navigate],
  );

  const runParse = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        let uid = tutorId;
        if (!uid) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          uid = user?.id ?? null;
          if (uid) setTutorId(uid);
        }
        if (!uid) {
          toast.error("Sign in to save schedule imports.");
          return;
        }

        const fileBase64 = await fileToBase64(file);
        const data = await saveTutorScheduleImportFn({
          data: { fileBase64, fileName: file.name },
        });

        setSources((prev) => [
          ...prev,
          { id: data.id, fileName: data.fileName, result: data.result },
        ]);
        setImportSheetOpen(false);

        if (data.result.events.length === 0) {
          toast.message("No events parsed", {
            description:
              "Check the header row and column names, or try the sample CSV.",
          });
        } else {
          const tutorRows = data.result.events.filter((ev) =>
            isTutorialTimetableEvent(ev, data.result.sessionTypeColumnPresent),
          ).length;
          toast.success(
            `Added ${tutorRows} tutor session${tutorRows === 1 ? "" : "s"} from “${file.name}” (saved).`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [tutorId],
  );

  const removeSource = useCallback(
    async (sourceId: string) => {
      if (!tutorId) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        return;
      }
      setBusy(true);
      try {
        await deleteTutorScheduleImportFn({ data: { id: sourceId } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
        setBusy(false);
        return;
      }
      setBusy(false);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    },
    [tutorId],
  );

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetUpload = useCallback(async () => {
    if (!tutorId) {
      setSources([]);
      return;
    }
    setBusy(true);
    try {
      await clearTutorScheduleImportsFn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
      setBusy(false);
      return;
    }
    setBusy(false);
    setSources([]);
  }, [tutorId]);

  if (showEmptyLanding) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-8 p-6 md:p-10">
          <div className="mx-auto w-full max-w-2xl space-y-3 text-center">
            <h1 className="display-title text-3xl font-bold tracking-tight text-(--sea-ink) md:text-4xl">
              Timetable & sessions
            </h1>
            <p className="mx-auto max-w-lg text-base text-(--sea-ink-soft)">
              Import your tutorial timetable or view lecturer-assigned sessions.
              Manage attendance and claims from{" "}
              <span className="font-medium text-(--sea-ink)">Sessions</span>.
            </p>
          </div>
          <TutorScheduleOfficialStrip
            loading={officialLoading}
            weekOfficialCount={0}
            totalOfficialCount={officialEvents.length}
          />
          <div className="mx-auto flex w-full max-w-2xl justify-center">
            <TutorScheduleUploadZone
              busy={busy}
              loadingSaved={loadingSaved}
              onFile={(f) => void runParse(f)}
              onSampleDownload={downloadSample}
            />
          </div>
        </div>
        <TutorScheduleImportSheet
          open={importSheetOpen}
          onOpenChange={setImportSheetOpen}
          busy={busy}
          loadingSaved={loadingSaved}
          onFile={(f) => void runParse(f)}
          onSampleDownload={downloadSample}
        />
      </ScrollArea>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TutorScheduleToolbar
        focusDate={focusDate}
        view={view}
        filterMode={filterMode}
        sources={sources}
        busy={busy}
        loadingSaved={loadingSaved}
        onFocusDateChange={setFocusDate}
        onViewChange={setView}
        onFilterModeChange={setFilterMode}
        onToday={goToday}
        onOpenImport={() => setImportSheetOpen(true)}
        onClearImports={() => void resetUpload()}
        onRemoveSource={(id) => void removeSource(id)}
      />

      <TutorScheduleOfficialStrip
        loading={officialLoading}
        weekOfficialCount={weekOfficialCount}
        totalOfficialCount={officialEvents.length}
      />

      <TutorScheduleParseAlert issues={result.rowIssues} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 pt-3 md:p-6 md:pt-4">
          {view === "week" ? (
            <TutorScheduleWeekView
              focusDate={focusDate}
              events={displayEvents}
              selectedDate={selectedDay}
              selectedEventId={selectedEventId}
              filterMode={filterMode}
              onSelectDate={handleSelectDate}
              onSelectEvent={handleSelectEvent}
            />
          ) : view === "month" ? (
            <TutorScheduleMonthView
              focusDate={focusDate}
              events={displayEvents}
              selectedDate={selectedDay}
              onSelectDate={handleSelectDate}
            />
          ) : (
            <TutorScheduleAgendaView
              focusDate={focusDate}
              events={displayEvents}
              selectedDate={selectedDay}
              selectedEventId={selectedEventId}
              filterMode={filterMode}
              onSelectDate={handleSelectDate}
              onSelectEvent={handleSelectEvent}
            />
          )}
        </div>

        <TutorScheduleDayPanel
          selectedDay={selectedDay}
          events={selectedDayEvents}
          filterMode={filterMode}
          selectedEventId={selectedEventId}
          sourcesCount={sources.length}
          linkingEventId={linkingEventId}
          onSelectEvent={handleSelectEvent}
          onManageImport={(ev) => void openSessionWorkspace(ev)}
          onReloadOfficial={reloadOfficial}
        />
      </div>

      <TutorScheduleImportSheet
        open={importSheetOpen}
        onOpenChange={setImportSheetOpen}
        busy={busy}
        loadingSaved={loadingSaved}
        onFile={(f) => void runParse(f)}
        onSampleDownload={downloadSample}
      />
    </div>
  );
}
