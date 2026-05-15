import type {
  ScheduleParseRowIssue,
  ScheduleParseResult,
  ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet";

/** One persisted import row plus parsed payload (UI state). */
export type TutorScheduleImportSource = {
  id: string;
  fileName: string;
  result: ScheduleParseResult;
};

export function mergeScheduleSources(
  sources: TutorScheduleImportSource[],
): ScheduleParseResult {
  if (sources.length === 0) {
    return {
      events: [],
      rowIssues: [],
      headerRow: 0,
      matchedHeaders: {},
      sheetsParsed: [],
      sessionTypeColumnPresent: false,
    };
  }

  const events: ScheduleParsedEvent[] = [];
  const rowIssues: ScheduleParseRowIssue[] = [];
  let sessionTypeColumnPresent = false;
  const matchedHeaders: Record<string, string> = {};
  const sheetsParsed: string[] = [];
  const multi = sources.length > 1;

  for (const src of sources) {
    const r = src.result;
    sessionTypeColumnPresent ||= r.sessionTypeColumnPresent;
    Object.assign(matchedHeaders, r.matchedHeaders);
    sheetsParsed.push(...r.sheetsParsed);
    for (const ev of r.events) {
      events.push({
        ...ev,
        importSourceFile: src.fileName,
        importSourceId: src.id,
        sessionTypeFromSource: r.sessionTypeColumnPresent,
      });
    }
    const prefix = multi ? `[${src.fileName}] ` : "";
    for (const issue of r.rowIssues) {
      rowIssues.push({ ...issue, message: prefix + issue.message });
    }
  }

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events,
    rowIssues,
    headerRow: sources[0]!.result.headerRow,
    matchedHeaders,
    sheetsParsed: [...new Set(sheetsParsed)],
    sessionTypeColumnPresent,
  };
}

/** Strip merge-only fields before persisting (re-applied when loading). */
export function parseResultForStorage(r: ScheduleParseResult): ScheduleParseResult {
  return {
    ...r,
    events: r.events.map((ev) => {
      const { importSourceFile, importSourceId, sessionTypeFromSource, ...rest } =
        ev;
      return rest;
    }),
  };
}

export function parseScheduleParseResultFromJson(
  json: unknown,
): ScheduleParseResult | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (!Array.isArray(o.events)) return null;
  return {
    events: o.events as ScheduleParsedEvent[],
    rowIssues: (Array.isArray(o.rowIssues)
      ? o.rowIssues
      : []) as ScheduleParseRowIssue[],
    headerRow: typeof o.headerRow === "number" ? o.headerRow : 0,
    matchedHeaders:
      o.matchedHeaders && typeof o.matchedHeaders === "object"
        ? (o.matchedHeaders as Record<string, string>)
        : {},
    sheetsParsed: (Array.isArray(o.sheetsParsed)
      ? o.sheetsParsed
      : []) as string[],
    sessionTypeColumnPresent: Boolean(o.sessionTypeColumnPresent),
  };
}
