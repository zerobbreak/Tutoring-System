import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ModifiersClassNames } from "react-day-picker";
import {
  Calendar as CalendarIcon,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  NotebookPen,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { cn } from "#/lib/utils";
import { format, startOfDay, startOfMonth } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
  clearTutorScheduleImportsFn,
  deleteTutorScheduleImportFn,
  ensureSessionClaimForScheduleEventFn,
  listTutorScheduleImportsFn,
  saveTutorScheduleImportFn,
} from "#/server-actions/tutor-schedule";
import {
  isTutorialTimetableEvent,
  type ScheduleParseResult,
  type ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet";
import {
  mergeScheduleSources,
  type TutorScheduleImportSource,
} from "#/lib/tutor-schedule-imports";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";

export const Route = createFileRoute("/tutor/schedules")({
  component: TutorSchedulesPage,
});

const SAMPLE_CSV = `Title,Start,End,Module code,Room,Type
Meridian hour,2026-02-16T12:00:00,2026-02-16T12:50:00,,LR 07,Other
INSY lecture,2026-02-16T08:00:00,2026-02-16T09:50:00,INSY6211,LR 10,Lecture
PROG6221 CR 1_Tutor session,2026-02-17T10:00:00,2026-02-17T11:00:00,PROG6221,CR 1,Tutorial
PROG6221 consult hour,2026-02-18T09:00:00,2026-02-18T10:00:00,PROG6221,CR 2,Tutorial
INSY6211 tutorial slot,2026-02-19T13:00:00,2026-02-19T14:30:00,INSY6211,LR 05,Tutorial
Programming lab,2026-02-17T14:00:00,2026-02-17T15:50:00,PROG6221,CR 1,Lab
`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const i = res.indexOf(",");
      resolve(i >= 0 ? res.slice(i + 1) : res);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function formatTimeRange(isoStart: string, isoEnd: string): string {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()))
    return `${isoStart} – ${isoEnd}`;
  const tf = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${tf.format(a)}–${tf.format(b)}`;
}

function dayKey(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd");
}

function dayHeadingLong(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function groupEventsByDay(
  events: ScheduleParsedEvent[],
): Map<string, ScheduleParsedEvent[]> {
  const map = new Map<string, ScheduleParsedEvent[]>();
  const sorted = [...events].sort(
    (x, y) => new Date(x.start).getTime() - new Date(y.start).getTime(),
  );
  for (const e of sorted) {
    const key = e.start.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return map;
}

type ScheduleSource = TutorScheduleImportSource;

function typeColumnFlagForEvent(
  ev: ScheduleParsedEvent,
  merged: ScheduleParseResult,
): boolean {
  return ev.sessionTypeFromSource ?? merged.sessionTypeColumnPresent;
}

function TutorSchedulesPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [sources, setSources] = useState<ScheduleSource[]>([]);
  const [linkingRowKey, setLinkingRowKey] = useState<string | null>(null);
  const result = useMemo(() => mergeScheduleSources(sources), [sources]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [showFullTimetable, setShowFullTimetable] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const displayEvents = useMemo(() => {
    if (!result.events.length) return [];
    if (showFullTimetable) return result.events;
    return result.events.filter((ev) =>
      isTutorialTimetableEvent(ev, typeColumnFlagForEvent(ev, result)),
    );
  }, [result, showFullTimetable]);

  useEffect(() => {
    if (sources.length > 0) setShowFullTimetable(false);
  }, [sources]);

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

  const byDay = useMemo(
    () => (displayEvents.length ? groupEventsByDay(displayEvents) : new Map()),
    [displayEvents],
  );

  const defaultMonth = useMemo(() => {
    if (!displayEvents.length) return new Date();
    const sorted = [...displayEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    return startOfDay(new Date(sorted[0]!.start));
  }, [displayEvents]);

  useEffect(() => {
    setCalendarMonth(startOfMonth(defaultMonth));
  }, [defaultMonth]);

  useEffect(() => {
    if (!displayEvents.length) {
      setSelectedDay(undefined);
      return;
    }
    const sorted = [...displayEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    setSelectedDay(startOfDay(new Date(sorted[0]!.start)));
  }, [displayEvents]);

  const selectedDayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : "";
  const selectedDayEvents = selectedDayKey
    ? (byDay.get(selectedDayKey) ?? [])
    : [];

  const tutorOnlyEvents = useMemo(
    () =>
      result.events.filter((ev) =>
        isTutorialTimetableEvent(ev, typeColumnFlagForEvent(ev, result)),
      ),
    [result],
  );

  const tutorByDayMap = useMemo(
    () =>
      tutorOnlyEvents.length ? groupEventsByDay(tutorOnlyEvents) : new Map(),
    [tutorOnlyEvents],
  );

  const fullByDayMap = useMemo(
    () => (result.events.length ? groupEventsByDay(result.events) : new Map()),
    [result],
  );

  const scheduleModifiers = useMemo(() => {
    if (showFullTimetable) {
      return {
        hasActivity: (date: Date) => byDay.has(dayKey(date)),
      };
    }
    return {
      hasTutor: (date: Date) => tutorByDayMap.has(dayKey(date)),
      hasOtherOnly: (date: Date) =>
        fullByDayMap.has(dayKey(date)) && !tutorByDayMap.has(dayKey(date)),
    };
  }, [showFullTimetable, byDay, tutorByDayMap, fullByDayMap]);

  const scheduleModifiersClassNames = useMemo(
    () =>
      (showFullTimetable
        ? {
            hasActivity:
              "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--lagoon-deep)] after:content-['']",
          }
        : {
            hasTutor:
              "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--lagoon-deep)] after:content-['']",
            hasOtherOnly:
              "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--palm)] after:content-['']",
          }) as ModifiersClassNames,
    [showFullTimetable],
  );

  const goToday = () => {
    const t = startOfDay(new Date());
    setSelectedDay(t);
    setCalendarMonth(startOfMonth(t));
  };

  const scheduleEventRowKey = (ev: ScheduleParsedEvent, idx: number) =>
    `${ev.importSourceId ?? ""}-${ev.start}-${ev.title}-${idx}`;

  const openSessionNotes = useCallback(
    async (ev: ScheduleParsedEvent, idx: number) => {
      if (!ev.importSourceId) {
        toast.error("This row is not linked to a saved import.");
        return;
      }
      if (!ev.moduleCode?.trim()) {
        toast.error("Add a module code for this row to open session notes.");
        return;
      }
      const key = scheduleEventRowKey(ev, idx);
      setLinkingRowKey(key);
      try {
        const { claimId } = await ensureSessionClaimForScheduleEventFn({
          data: {
            importId: ev.importSourceId,
            start: ev.start,
            end: ev.end,
            title: ev.title,
            moduleCode: ev.moduleCode,
            location: ev.location,
            sessionType: ev.sessionType,
          },
        });
        navigate({
          to: "/tutor/notes",
          search: { claim: claimId, focus: Date.now() },
        });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not open session notes",
        );
      } finally {
        setLinkingRowKey(null);
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
            `Added ${tutorRows} tutor session${tutorRows === 1 ? "" : "s"} from “${file.name}” (saved). Use “Add spreadsheet” to merge another export.`,
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

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void runParse(f);
  };

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
      setSelectedDay(undefined);
      setCalendarMonth(startOfMonth(new Date()));
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
    setSelectedDay(undefined);
    setCalendarMonth(startOfMonth(new Date()));
  }, [tutorId]);

  const showResults = result.events.length > 0;

  if (!showResults) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 md:p-12">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          onChange={onPickFile}
        />
        <div className="w-full max-w-2xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-(--lagoon)/20 blur-2xl" />
              <div className="relative flex size-24 items-center justify-center rounded-3xl border-2 border-dashed border-(--lagoon) bg-white/50 shadow-inner backdrop-blur-sm">
                {loadingSaved || busy ? (
                  <Loader2 className="size-12 animate-spin text-(--lagoon-deep)" />
                ) : (
                  <FileSpreadsheet className="size-12 text-(--lagoon-deep)" />
                )}
              </div>
            </div>
          </div>
          <h1 className="display-title mb-3 text-4xl font-bold tracking-tight text-(--sea-ink)">
            Upload Your Schedule
          </h1>
          <p className="mx-auto mb-10 max-w-md text-lg text-(--sea-ink-soft)">
            Import your tutorial timetable from a spreadsheet. You can add more
            files later — each import merges into the same calendar so multiple
            modules or campuses stay in one view. Successful imports are{" "}
            <span className="font-medium text-(--sea-ink)">
              saved to your account
            </span>{" "}
            so they reappear when you return.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-14 min-w-50 gap-3 rounded-2xl text-lg shadow-lg"
              disabled={busy || loadingSaved}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-5" />
              {loadingSaved
                ? "Loading…"
                : busy
                  ? "Parsing…"
                  : "Select Spreadsheet"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 min-w-50 gap-3 rounded-2xl border-border/60 bg-white/50 backdrop-blur-sm"
              disabled={busy || loadingSaved}
              onClick={downloadSample}
            >
              <Download className="size-5" />
              Sample CSV
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
        onChange={onPickFile}
      />

      {/* Left: calendar */}
      <div className="flex min-h-0 w-full flex-col overflow-hidden border-r border-transparent lg:min-w-0 lg:flex-1 lg:border-border/40">
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex w-full shrink-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-0 text-sm font-medium text-foreground hover:bg-transparent hover:underline"
                onClick={goToday}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={busy || loadingSaved}
                onClick={() => inputRef.current?.click()}
              >
                <Plus className="size-3.5" />
                Add spreadsheet
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                disabled={busy || loadingSaved || sources.length === 0}
                onClick={() => void resetUpload()}
              >
                Clear all imports
              </button>
            </div>
            {sources.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Imported files"
                >
                  {sources.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                    >
                      <span
                        className="max-w-56 truncate font-medium"
                        title={s.fileName}
                      >
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
                        onClick={() => void removeSource(s.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                {!loadingSaved && tutorId ? (
                  <p className="text-[11px] text-muted-foreground">
                    These imports are stored for your account and load
                    automatically next time.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-1 flex-col max-h-[65vh] xl:max-h-[700px]">
            <div className="flex w-full flex-1 min-h-0">
              <Calendar
                key={`${sources.map((s) => s.id).join("|")}-${displayEvents[0]?.start ?? ""}-${showFullTimetable}`}
                mode="single"
                showOutsideDays={false}
                navLayout="around"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selected={selectedDay}
                onSelect={(d) => d && setSelectedDay(startOfDay(d))}
                modifiers={scheduleModifiers}
                modifiersClassNames={scheduleModifiersClassNames}
                className="h-full w-full bg-transparent p-0"
                classNames={{
                  root: "group/calendar flex h-full w-full flex-col gap-0 bg-transparent p-0 shadow-none [--cell-size:clamp(2.35rem,calc(0.45rem_+_5.5vmin),3.25rem)]",
                  months: "flex h-full w-full flex-col",
                  month:
                    "grid h-full w-full flex-1 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-1 gap-y-2 md:gap-x-2 md:gap-y-2 [&>*:last-child]:col-span-3",
                  month_caption:
                    "flex min-w-0 shrink-0 items-center justify-center px-1 py-0.5",
                  caption_label:
                    "truncate text-center text-sm font-semibold tabular-nums text-foreground md:text-base",
                  button_previous:
                    "size-8 shrink-0 self-center rounded-lg opacity-70 transition-opacity hover:bg-muted hover:opacity-100 [&_svg]:size-4",
                  button_next:
                    "size-8 shrink-0 self-center rounded-lg opacity-70 transition-opacity hover:bg-muted hover:opacity-100 [&_svg]:size-4",
                  month_grid:
                    "w-full h-full table-fixed border-collapse border-spacing-0",
                  weekdays: "table-row",
                  weekday:
                    "table-cell w-[14.28%] p-0 pb-1.5 text-center text-[0.7rem] font-medium normal-case tracking-normal text-muted-foreground sm:text-xs",
                  week: "table-row",
                  day: "relative table-cell w-[14.28%] p-0 py-0.5 text-center align-middle text-sm focus-within:relative focus-within:z-20",
                  day_button:
                    "mx-auto flex h-[var(--cell-size)] w-[var(--cell-size)] shrink-0 rounded-lg p-0 text-sm font-normal transition-colors hover:bg-muted/60 data-[selected-single=true]:shadow-none data-[selected-single=true]:!bg-[var(--lagoon-deep)] data-[selected-single=true]:!text-white data-[selected-single=true]:hover:!bg-[var(--lagoon-deep)] sm:text-base",
                  selected:
                    "[&_button]:!bg-[var(--lagoon-deep)] [&_button]:!text-white",
                  today:
                    "font-semibold text-[var(--lagoon-deep)] [&_button]:bg-muted/40 [&_button]:ring-0",
                  outside: "text-muted-foreground/60",
                  disabled: "text-muted-foreground opacity-40",
                  range_middle:
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  hidden: "invisible",
                }}
              />
            </div>

            {!showFullTimetable ? (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground md:text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-(--lagoon-deep)"
                    aria-hidden
                  />
                  Tutor day
                </span>
                <span className="mx-2 text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-(--palm)"
                    aria-hidden
                  />
                  Other classes only
                </span>
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground md:text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-(--lagoon-deep)"
                    aria-hidden
                  />
                  Day with events
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Day list — no chrome, spacing only */}
      <aside className="flex min-h-0 w-full shrink-0 flex-col bg-background lg:w-[min(100%,28rem)] lg:pl-2">
        <header className="shrink-0 px-4 pb-3 pt-4 md:px-6 md:pb-4 md:pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h3 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-foreground md:text-xl">
              {selectedDay ? dayHeadingLong(selectedDay) : "Pick a day"}
            </h3>
            <div
              className="flex shrink-0 items-center gap-0.5 text-sm"
              role="group"
              aria-label="Schedule view"
            >
              <button
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  !showFullTimetable
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setShowFullTimetable(false)}
              >
                Tutor
              </button>
              <span
                className="select-none text-muted-foreground/35"
                aria-hidden
              >
                /
              </span>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  showFullTimetable
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setShowFullTimetable(true)}
              >
                Full
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 md:px-6">
          {!selectedDay ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-muted-foreground">
              <CalendarIcon className="mb-3 size-10 opacity-25" aria-hidden />
              <p className="text-sm">Select a day to view sessions</p>
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                {showFullTimetable
                  ? "No activity on this day."
                  : "No tutor sessions on this day. Try Full view for the whole timetable."}
              </p>
            </div>
          ) : (
            <ul className="list-none space-y-8">
              {selectedDayEvents.map((ev: ScheduleParsedEvent, idx: number) => {
                const rowKey = scheduleEventRowKey(ev, idx);
                const canNotes =
                  !!ev.importSourceId?.trim() && !!ev.moduleCode?.trim();
                return (
                  <li key={rowKey}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-(--sea-ink) md:text-lg">
                        {ev.title}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                          disabled={!canNotes || linkingRowKey === rowKey}
                          title={
                            canNotes
                              ? "Open session notes for this slot"
                              : !ev.moduleCode?.trim()
                                ? "Module code required"
                                : "Save import required"
                          }
                          onClick={() => void openSessionNotes(ev, idx)}
                        >
                          {linkingRowKey === rowKey ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <NotebookPen className="size-3.5" aria-hidden />
                          )}
                          <span className="hidden sm:inline">Notes</span>
                        </Button>
                        <time className="shrink-0 text-xs tabular-nums text-muted-foreground md:text-sm">
                          {formatTimeRange(ev.start, ev.end)}
                        </time>
                      </div>
                    </div>
                    {(ev.sessionType || ev.moduleCode || ev.location) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {ev.sessionType ? (
                          <span className="uppercase tracking-wide text-muted-foreground/80">
                            {ev.sessionType}
                          </span>
                        ) : null}
                        {ev.moduleCode ? <span>{ev.moduleCode}</span> : null}
                        {ev.location ? <span>{ev.location}</span> : null}
                      </div>
                    )}
                    {sources.length > 1 && ev.importSourceFile ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground/90">
                        From{" "}
                        <span className="font-medium">
                          {ev.importSourceFile}
                        </span>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {result.rowIssues.length > 0 && (
            <div className="mt-10 rounded-lg bg-amber-50/80 p-4 dark:bg-amber-950/20">
              <div className="mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Info className="size-4 shrink-0" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Import notes
                </span>
              </div>
              <ul className="space-y-1.5">
                {result.rowIssues.slice(0, 5).map((issue, i) => (
                  <li
                    key={i}
                    className="text-[11px] leading-relaxed text-amber-900/85 dark:text-amber-100/85"
                  >
                    Row {issue.rowNumber}: {issue.message}
                  </li>
                ))}
                {result.rowIssues.length > 5 && (
                  <li className="text-[10px] text-amber-800/70 dark:text-amber-200/70">
                    + {result.rowIssues.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
