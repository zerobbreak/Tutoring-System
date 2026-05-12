import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { parseScheduleUploadFn } from "#/lib/schedule-parse-server";
import {
  isTutorialTimetableEvent,
  type ScheduleParseResult,
  type ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet";
import { toast } from "#/lib/toast";

export const Route = createFileRoute("/tutor/schedules")({
  component: TutorSchedulesPage,
});

const SAMPLE_CSV = `Title,Start,End,Module code,Room,Type
Meridian hour,2026-02-16T12:00:00,2026-02-16T12:50:00,,LR 07,Other
INSY lecture,2026-02-16T08:00:00,2026-02-16T09:50:00,INSY6211,LR 10,Lecture
PROG6221 CR 1_Tutor session,2026-02-17T10:00:00,2026-02-17T11:00:00,PROG6221,CR 1,Tutorial
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

function dayHeading(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : "";
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
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

function TutorSchedulesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleParseResult | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  /** When false, calendar and table show only tutor/tutorial-style rows. */
  const [showFullTimetable, setShowFullTimetable] = useState(false);

  const displayEvents = useMemo(() => {
    if (!result?.events.length) return [];
    if (showFullTimetable) return result.events;
    return result.events.filter((ev) =>
      isTutorialTimetableEvent(ev, result.sessionTypeColumnPresent),
    );
  }, [result, showFullTimetable]);

  useEffect(() => {
    if (result) setShowFullTimetable(false);
  }, [result]);

  const byDay = useMemo(
    () =>
      displayEvents.length ? groupEventsByDay(displayEvents) : new Map(),
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
    if (!displayEvents.length) {
      setSelectedDay(undefined);
      return;
    }
    const sorted = [...displayEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    setSelectedDay(startOfDay(new Date(sorted[0]!.start)));
  }, [displayEvents]);

  const selectedDayKey = selectedDay
    ? format(selectedDay, "yyyy-MM-dd")
    : "";
  const selectedDayEvents = selectedDayKey
    ? (byDay.get(selectedDayKey) ?? [])
    : [];

  const runParse = useCallback(async (file: File) => {
    setBusy(true);
    setLastFileName(file.name);
    try {
      const fileBase64 = await fileToBase64(file);
      const data = await parseScheduleUploadFn({
        data: { fileBase64, fileName: file.name },
      });
      setResult(data);
      if (data.events.length === 0) {
        toast.message("No events parsed", {
          description:
            "Check the header row and column names, or try the sample CSV.",
        });
      } else {
        const tutorRows = data.events.filter((ev) =>
          isTutorialTimetableEvent(ev, data.sessionTypeColumnPresent),
        ).length;
        if (tutorRows === 0) {
          toast.message("Imported timetable", {
            description:
              "No tutor/tutorial rows detected by title or Type column. Use “Full timetable” to review every row.",
          });
        } else {
          toast.success(
            tutorRows === data.events.length
              ? `Imported ${tutorRows} tutor/tutorial block${tutorRows === 1 ? "" : "s"}`
              : `Imported ${tutorRows} tutor/tutorial block${tutorRows === 1 ? "" : "s"} (${data.events.length} rows total)`,
            {
              description:
                data.rowIssues.length > 0
                  ? `${data.rowIssues.length} row(s) skipped while parsing.`
                  : "Lectures and other slots stay hidden until you show the full timetable.",
            },
          );
        }
      }
    } catch (e) {
      setResult(null);
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, []);

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

  return (
    <div className="rise-in space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--sea-ink)] dark:text-[var(--sea-ink)]">
          Schedules
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Upload a row-based CSV or Excel file using the same layout as the sample. When your sheet
          includes a <strong>Type</strong> column, those values decide tutor vs class slots; if the
          Type cell is empty, the title is used as a fallback. Without a Type column, only title
          patterns apply. Use <strong>Full timetable</strong> to see every row.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Card className="border-[var(--line)] bg-[var(--surface)] shadow-none backdrop-blur-sm dark:bg-[var(--surface)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Upload className="size-4 text-[var(--lagoon-deep)]" />
              Upload
            </CardTitle>
            <CardDescription>
              Supported: <code className="text-xs">.csv</code>,{" "}
              <code className="text-xs">.xlsx</code>, <code className="text-xs">.xls</code>.
              Multi-sheet workbooks run each sheet; multiple blocks merge into one preview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="sr-only"
              onChange={onPickFile}
            />
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                File
              </Label>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-3 border-[var(--chip-line)] bg-[var(--chip-bg)] py-3 text-left shadow-none"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-[var(--lagoon-deep)]" />
                ) : (
                  <FileSpreadsheet className="size-4 shrink-0 text-[var(--lagoon-deep)]" />
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {busy ? "Parsing…" : "Choose spreadsheet"}
                  </span>
                  {lastFileName ? (
                    <span className="truncate text-xs text-muted-foreground">{lastFileName}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Max 12 MB</span>
                  )}
                </span>
              </Button>
            </div>

            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--foam)]/50 p-3 text-xs leading-relaxed text-muted-foreground dark:bg-[var(--foam)]/20">
              <p className="font-medium text-foreground">Expected columns</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  <strong>Start</strong> + <strong>End</strong> (full datetimes), optional{" "}
                  <strong>Title</strong>, <strong>Module code</strong>, <strong>Room</strong>
                </li>
                <li>
                  Or <strong>Date</strong> + <strong>Start</strong> + <strong>End</strong> when the
                  times are only times (e.g. <code>08H00</code> or <code>08:00</code>)
                </li>
                <li>
                  <strong>Type</strong> (or Kind / Category): recommended values{" "}
                  <code>Tutorial</code>, <code>Lecture</code>, <code>Lab</code>, <code>Other</code>.
                  If this column exists, it is <strong>authoritative</strong> for each non-empty
                  cell (unknown values get a warning). Leave Type blank to infer from the title.
                </li>
              </ul>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full gap-2"
              onClick={downloadSample}
            >
              <Download className="size-4" />
              Download sample CSV
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {result && result.matchedHeaders && Object.keys(result.matchedHeaders).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.matchedHeaders).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs text-foreground"
                >
                  <span className="font-medium text-[var(--sea-ink-soft)]">{k}</span>
                  <span className="text-muted-foreground">→ {v}</span>
                </span>
              ))}
            </div>
          ) : null}

          {result && result.rowIssues.length > 0 ? (
            <Card className="border-amber-200/80 bg-amber-50/90 text-amber-950 shadow-none dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Parse warnings</CardTitle>
                <CardDescription className="text-amber-900/80 dark:text-amber-100/80">
                  Rows that were skipped or sheets without a matching header.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {result.rowIssues.map((issue, i) => (
                    <li key={`${issue.rowNumber}-${i}`}>
                      {issue.sheet ? `${issue.sheet} · ` : ""}Row {issue.rowNumber}:{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {result && result.events.length > 0 ? (
            <>
              {!showFullTimetable &&
              result.events.length > 0 &&
              displayEvents.length === 0 ? (
                <Card className="border-sky-200/80 bg-sky-50/90 text-sky-950 shadow-none dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-50">
                  <CardContent className="flex flex-col gap-3 py-4 text-sm">
                    <p>
                      No rows matched the <strong>tutor/tutorial</strong> filter (title text or
                      Type column). Your file still has{" "}
                      <strong>{result.events.length}</strong> parsed row
                      {result.events.length === 1 ? "" : "s"}.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-fit"
                      onClick={() => setShowFullTimetable(true)}
                    >
                      Show full timetable
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-[var(--line)] bg-[var(--surface)] shadow-none backdrop-blur-sm">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <CalendarDays className="size-4 text-[var(--lagoon-deep)]" />
                        Calendar (preview)
                      </CardTitle>
                      <CardDescription>
                        {showFullTimetable
                          ? "Showing every parsed row. Dots mark days that have at least one block."
                          : result.sessionTypeColumnPresent
                            ? "Tutor view: non-empty Type cells are authoritative; blank Type falls back to the title. Dots mark days with at least one tutor/tutorial row."
                            : "Tutor view: no Type column — only title patterns select tutor/tutorial rows. Dots mark those days."}{" "}
                        Nothing is saved yet.
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={!showFullTimetable ? "default" : "outline"}
                        onClick={() => setShowFullTimetable(false)}
                      >
                        Tutor / tutorial
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={showFullTimetable ? "default" : "outline"}
                        onClick={() => setShowFullTimetable(true)}
                      >
                        Full timetable
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
                    <div className="flex justify-center lg:justify-start">
                      <Calendar
                        key={`${lastFileName ?? "none"}-${displayEvents[0]?.start ?? ""}-${showFullTimetable}`}
                        mode="single"
                        selected={selectedDay}
                        onSelect={(d) => {
                          if (d) setSelectedDay(startOfDay(d));
                        }}
                        defaultMonth={defaultMonth}
                        modifiers={{
                          hasSchedule: (date) =>
                            byDay.has(format(startOfDay(date), "yyyy-MM-dd")),
                        }}
                        modifiersClassNames={{
                          hasSchedule:
                            "relative after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--lagoon-deep)] after:content-['']",
                        }}
                        className="rounded-xl border border-[var(--line)] bg-card/60 [--cell-size:2.25rem] md:[--cell-size:2.5rem]"
                      />
                    </div>
                    <div className="min-h-[280px] rounded-xl border border-[var(--line)] bg-card/80 p-4">
                      {selectedDay ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--kicker)]">
                            {dayHeading(selectedDay)}
                          </p>
                          {selectedDayEvents.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">
                              {showFullTimetable
                                ? "No blocks on this day in the imported file."
                                : "No tutor/tutorial blocks on this day. Switch to “Full timetable” if you expected a lecture or other slot here."}
                            </p>
                          ) : (
                            <ul className="mt-4 flex flex-col gap-2">
                              {selectedDayEvents.map((ev: ScheduleParsedEvent, idx: number) => (
                                <li
                                  key={`${ev.start}-${idx}`}
                                  className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] p-3 text-sm shadow-sm"
                                >
                                  <p className="font-semibold text-foreground">{ev.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatTimeRange(ev.start, ev.end)}
                                  </p>
                                  {(ev.moduleCode ||
                                    ev.location ||
                                    ev.sessionType ||
                                    ev.sourceSheet) && (
                                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                                      {[ev.moduleCode, ev.location, ev.sessionType, ev.sourceSheet]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select a day on the calendar to see its blocks.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[var(--line)] bg-[var(--surface)] shadow-none backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Parsed rows</CardTitle>
                  <CardDescription>
                    {showFullTimetable
                      ? "All rows from the file."
                      : "Tutor/tutorial rows only — same filter as the calendar."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Start</th>
                        <th className="py-2 pr-3 font-medium">End</th>
                        <th className="py-2 pr-3 font-medium">Title</th>
                        <th className="py-2 pr-3 font-medium">Module</th>
                        <th className="py-2 pr-3 font-medium">Room</th>
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 font-medium">Sheet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayEvents.map((ev, i) => (
                        <tr key={`${ev.start}-${i}`} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-mono text-[11px]">{ev.start}</td>
                          <td className="py-2 pr-3 font-mono text-[11px]">{ev.end}</td>
                          <td className="py-2 pr-3">{ev.title}</td>
                          <td className="py-2 pr-3">{ev.moduleCode ?? "—"}</td>
                          <td className="py-2 pr-3">{ev.location ?? "—"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {ev.sessionType ?? "—"}
                          </td>
                          <td className="py-2 text-muted-foreground">{ev.sourceSheet ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed border-[var(--line)] bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <CalendarDays className="size-10 opacity-40" />
                <p>Upload a file to see a calendar-style preview and row table.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
