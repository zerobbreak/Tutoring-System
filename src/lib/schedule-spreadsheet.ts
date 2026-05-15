/**
 * Deterministic schedule import from row-oriented spreadsheets (CSV / Excel).
 * Detects a header row and maps flexible column names to start, end, title, etc.
 */

export type CellValue = string | number | Date | boolean | null | undefined;

export type ScheduleParsedEvent = {
  start: string;
  end: string;
  title: string;
  moduleCode?: string;
  location?: string;
  /** Optional spreadsheet column (Type, Kind, Category, …). */
  sessionType?: string;
  sourceSheet?: string;
  /** When multiple files are merged in the tutor schedules UI, which file this row came from. */
  importSourceFile?: string;
  /** DB id of `tutor_schedule_imports` row when merged in the schedules UI (not stored in JSON). */
  importSourceId?: string;
  /**
   * Per-row flag from the file that produced this event (used when merging imports so tutor
   * filtering respects whether that sheet had a Type column).
   */
  sessionTypeFromSource?: boolean;
};

export type ScheduleParseRowIssue = {
  rowNumber: number;
  sheet?: string;
  message: string;
};

export type ScheduleParseResult = {
  events: ScheduleParsedEvent[];
  rowIssues: ScheduleParseRowIssue[];
  headerRow: number;
  matchedHeaders: Record<string, string>;
  sheetsParsed: string[];
  /** When true, a Type/Kind/Category column was detected — use {@link isTutorialTimetableEvent} with this flag. */
  sessionTypeColumnPresent: boolean;
};

type ColumnKey =
  | "start"
  | "end"
  | "date"
  | "moduleCode"
  | "title"
  | "location"
  | "sessionType";

const FIELD_ALIASES: Record<ColumnKey, string[]> = {
  start: [
    "start",
    "start time",
    "start datetime",
    "starts",
    "from",
    "begin",
    "begins",
    "datetime start",
  ],
  end: ["end", "end time", "end datetime", "until", "finish", "to", "datetime end"],
  date: ["date", "day"],
  moduleCode: [
    "module code",
    "module",
    "course code",
    "course",
    "code",
    "modulecode",
  ],
  title: ["title", "name", "subject", "description", "activity", "event"],
  location: ["location", "room", "venue", "campus", "place", "site"],
  sessionType: [
    "session type",
    "slot type",
    "entry type",
    "type",
    "kind",
    "category",
    "activity type",
  ],
};

const MODULE_CODE_RE = /\b([A-Z]{2,6}\d{4})\b/;

/**
 * Closed vocabulary for spreadsheet **Type** (case-insensitive, spaces/underscores normalized).
 * Recommended values: `Tutorial`, `Lecture`, `Lab`, `Other` (plus synonyms below).
 */
export function normalizeScheduleTypeInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

export function classifySessionTypeValue(
  raw: string,
): "tutorial" | "nontutorial" | "unknown" {
  const s = normalizeScheduleTypeInput(raw);
  if (!s) return "unknown";

  if (
    s.includes("tutor session") ||
    s.includes("tutorial") ||
    s.includes("tutoring") ||
    /\btutor\b/.test(s) ||
    s.includes("consult") ||
    s.includes("drop-in") ||
    s.includes("dropin") ||
    /^office hours?$/.test(s)
  ) {
    return "tutorial";
  }

  if (
    /^(lecture|lab|class|seminar|workshop|exam|test|other|practical|break)\b/.test(
      s,
    ) ||
    s.startsWith("meridian") ||
    s.startsWith("student experience")
  ) {
    return "nontutorial";
  }

  return "unknown";
}

function titleHintsTutor(ev: ScheduleParsedEvent): boolean {
  const title = ev.title.trim();
  const titleLower = title.toLowerCase();
  const combined = `${titleLower}\t${(ev.location ?? "").toLowerCase()}`;

  if (/^meridian\b/i.test(title)) return false;
  if (/^student experience\b/i.test(title)) return false;

  if (combined.includes("tutor session")) return true;
  if (combined.includes("_tutor")) return true;
  if (/\btutorial\b/.test(combined)) return true;
  if (/\btutoring\b/.test(combined)) return true;
  if (
    /\btutor\b/.test(titleLower) &&
    /session|slot|consult|hour|lab support|drop-?in/i.test(titleLower)
  ) {
    return true;
  }

  return false;
}

/**
 * True when this row counts as a tutor/tutorial slot for filtering.
 *
 * **Policy (recommended):**
 * - If `sessionTypeColumnPresent` is true (sheet has a Type/Kind/Category column), a **non-empty**
 *   {@link ScheduleParsedEvent.sessionType} cell is **authoritative** after
 *   {@link classifySessionTypeValue} (title is not used to override Lecture vs Tutorial).
 * - If that cell is **empty**, fall back to {@link titleHintsTutor} for that row.
 * - If there is **no** Type column on the sheet, only {@link titleHintsTutor} is used.
 */
export function isTutorialTimetableEvent(
  ev: ScheduleParsedEvent,
  sessionTypeColumnPresent: boolean,
): boolean {
  if (sessionTypeColumnPresent) {
    const raw = ev.sessionType?.trim();
    if (raw) {
      const bucket = classifySessionTypeValue(raw);
      if (bucket === "tutorial") return true;
      if (bucket === "nontutorial") return false;
      return false;
    }
    return titleHintsTutor(ev);
  }

  return titleHintsTutor(ev);
}

function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim().toLowerCase();
  return s.replace(/_/g, " ").replace(/\s+/g, " ");
}

function buildHeaderToField(): Map<string, ColumnKey> {
  const map = new Map<string, ColumnKey>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
    ColumnKey,
    string[],
  ][]) {
    for (const a of aliases) {
      map.set(normalizeHeader(a), field);
    }
  }
  return map;
}

const HEADER_TO_FIELD = buildHeaderToField();

function mapHeaderCell(cell: unknown): ColumnKey | null {
  const n = normalizeHeader(cell);
  if (!n) return null;
  const direct = HEADER_TO_FIELD.get(n);
  if (direct) return direct;
  for (const [h, field] of HEADER_TO_FIELD) {
    if (n.startsWith(`${h} `) || n.startsWith(`${h}(`)) return field;
  }
  return null;
}

export function detectHeaderRow(matrix: CellValue[][]): {
  rowIndex: number;
  columns: Partial<Record<ColumnKey, number>>;
  labels: Record<string, string>;
} | null {
  const maxScan = Math.min(40, matrix.length);
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] ?? [];
    const columns: Partial<Record<ColumnKey, number>> = {};
    const labels: Record<string, string> = {};
    for (let c = 0; c < row.length; c++) {
      const field = mapHeaderCell(row[c]);
      if (!field) continue;
      if (columns[field] !== undefined) continue;
      columns[field] = c;
      labels[field] = String(row[c] ?? "").trim();
    }
    const hasStart = columns.start !== undefined;
    const hasEnd = columns.end !== undefined;
    const hasDate = columns.date !== undefined;
    if (hasStart && hasEnd) {
      return { rowIndex: r, columns, labels };
    }
    if (hasDate && hasStart && hasEnd) {
      return { rowIndex: r, columns, labels };
    }
  }
  return null;
}

function isExcelTimeFraction(n: number): boolean {
  return n > 0 && n < 1 && Number.isFinite(n);
}

function excelSerialToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 86400000;
  return new Date(ms);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return `${y}-${m}-${day}T${h}:${min}:${s}`;
}

/** Parse "08H00", "8:00", "08:00:00", "8h30" into minutes from midnight */
function parseTimeStringToMinutes(str: string): number | null {
  const t = str.trim();
  const m1 = t.match(/^(\d{1,2})\s*[hH]\s*(\d{2})(?:\s*-\s*\d{1,2}\s*[hH]\s*\d{2})?$/);
  if (m1) {
    const hh = Number(m1[1]);
    const mm = Number(m1[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
    return null;
  }
  const m2 = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m2) {
    const hh = Number(m2[1]);
    const mm = Number(m2[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
    return null;
  }
  return null;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function combineDateAndMinutes(baseDay: Date, minutes: number): Date {
  const d = stripTime(baseDay);
  d.setHours(0, minutes, 0, 0);
  return d;
}

function parseCellAsFullDateTime(cell: CellValue): Date | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell;
  if (typeof cell === "number" && Number.isFinite(cell)) {
    if (isExcelTimeFraction(cell)) return null;
    const d = excelSerialToDate(cell);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  }
  if (typeof cell === "boolean") return null;
  const s = String(cell).trim();
  if (!s) return null;
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = s.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const hh = m[4] !== undefined ? Number(m[4]) : 0;
    const mm = m[5] !== undefined ? Number(m[5]) : 0;
    const ss = m[6] !== undefined ? Number(m[6]) : 0;
    if (year >= 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day, hh, mm, ss);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function parseDateOnly(cell: CellValue): Date | null {
  const full = parseCellAsFullDateTime(cell);
  if (!full) return null;
  return stripTime(full);
}

function parseAsTimeOnDate(cell: CellValue, baseDate: Date): Date | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "string") {
    const mins = parseTimeStringToMinutes(cell);
    if (mins !== null) return combineDateAndMinutes(baseDate, mins);
    return null;
  }
  if (typeof cell === "number" && Number.isFinite(cell)) {
    if (isExcelTimeFraction(cell)) {
      const minutes = Math.round(cell * 24 * 60);
      return combineDateAndMinutes(baseDate, minutes);
    }
    return null;
  }
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    if (cell.getFullYear() < 2000) {
      const mins =
        cell.getHours() * 60 + cell.getMinutes() + cell.getSeconds() / 60;
      return combineDateAndMinutes(baseDate, Math.round(mins));
    }
  }
  return null;
}

function extractModuleCode(text: string): string | undefined {
  const m = text.match(MODULE_CODE_RE);
  return m ? m[1] : undefined;
}

function rowIsEmpty(row: CellValue[]): boolean {
  return row.every(
    (c) => c === null || c === undefined || String(c).trim() === "",
  );
}

export function parseScheduleFromMatrix(
  matrix: CellValue[][],
  options?: { sheetName?: string },
): ScheduleParseResult {
  const sheet = options?.sheetName;
  const detected = detectHeaderRow(matrix);
  if (!detected) {
    return {
      events: [],
      rowIssues: [
        {
          rowNumber: 1,
          sheet,
          message:
            "No header row found. Add columns such as Start, End, and Title (or Date + Start + End).",
        },
      ],
      headerRow: 0,
      matchedHeaders: {},
      sheetsParsed: sheet ? [sheet] : [],
      sessionTypeColumnPresent: false,
    };
  }

  const { rowIndex, columns, labels } = detected;
  const hasDateCol = columns.date !== undefined;
  const sessionTypeColumnPresent = columns.sessionType !== undefined;
  const events: ScheduleParsedEvent[] = [];
  const rowIssues: ScheduleParseRowIssue[] = [];

  for (let r = rowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (rowIsEmpty(row)) continue;

    const startCol = columns.start!;
    const endCol = columns.end!;
    const startCell = row[startCol];
    const endCell = row[endCol];

    let start: Date | null = null;
    let end: Date | null = null;

    if (hasDateCol) {
      const dateCell = row[columns.date!];
      const baseDate = parseDateOnly(dateCell);
      if (!baseDate) {
        rowIssues.push({
          rowNumber: r + 1,
          sheet,
          message: "Could not parse Date column for this row.",
        });
        continue;
      }
      start = parseAsTimeOnDate(startCell, baseDate);
      end = parseAsTimeOnDate(endCell, baseDate);
      if (!start) start = parseCellAsFullDateTime(startCell);
      if (!end) end = parseCellAsFullDateTime(endCell);
    } else {
      start = parseCellAsFullDateTime(startCell);
      end = parseCellAsFullDateTime(endCell);
    }

    if (!start || !end) {
      rowIssues.push({
        rowNumber: r + 1,
        sheet,
        message: "Could not parse Start/End into valid datetimes.",
      });
      continue;
    }
    if (!(end.getTime() > start.getTime())) {
      rowIssues.push({
        rowNumber: r + 1,
        sheet,
        message: "End must be after Start.",
      });
      continue;
    }

    const titleCol = columns.title;
    const moduleCol = columns.moduleCode;
    const locCol = columns.location;
    const sessionTypeCol = columns.sessionType;

    let title =
      titleCol !== undefined
        ? String(row[titleCol] ?? "").trim()
        : "";
    const moduleFromCol =
      moduleCol !== undefined
        ? String(row[moduleCol] ?? "").trim()
        : "";
    const location =
      locCol !== undefined ? String(row[locCol] ?? "").trim() : "";
    const sessionTypeRaw =
      sessionTypeCol !== undefined
        ? String(row[sessionTypeCol] ?? "").trim()
        : "";

    let moduleCode = moduleFromCol ? extractModuleCode(moduleFromCol) : undefined;
    if (moduleFromCol && !moduleCode && MODULE_CODE_RE.test(moduleFromCol)) {
      moduleCode = extractModuleCode(moduleFromCol);
    }
    if (!moduleCode && title) moduleCode = extractModuleCode(title);

    if (!title) {
      if (moduleFromCol) title = moduleFromCol;
      else if (moduleCode) title = moduleCode;
      else title = "Untitled block";
    }

    if (sessionTypeColumnPresent && sessionTypeRaw) {
      if (classifySessionTypeValue(sessionTypeRaw) === "unknown") {
        rowIssues.push({
          rowNumber: r + 1,
          sheet,
          message: `Unrecognized Type "${sessionTypeRaw}". Use Tutorial, Lecture, Lab, or Other (same spelling as the template).`,
        });
      }
    }

    events.push({
      start: formatLocalIso(start),
      end: formatLocalIso(end),
      title,
      moduleCode: moduleCode || undefined,
      location: location || undefined,
      sessionType: sessionTypeRaw || undefined,
      sourceSheet: sheet,
    });
  }

  return {
    events,
    rowIssues,
    headerRow: rowIndex,
    matchedHeaders: labels,
    sheetsParsed: sheet ? [sheet] : [],
    sessionTypeColumnPresent,
  };
}

export function mergeScheduleParseResults(
  parts: ScheduleParseResult[],
): ScheduleParseResult {
  const events: ScheduleParsedEvent[] = [];
  const rowIssues: ScheduleParseRowIssue[] = [];
  const sheetsParsed: string[] = [];
  const matched: Record<string, string> = {};

  for (const p of parts) {
    events.push(...p.events);
    rowIssues.push(...p.rowIssues);
    sheetsParsed.push(...p.sheetsParsed);
    Object.assign(matched, p.matchedHeaders);
  }

  const headerRow = parts[0]?.headerRow ?? 0;
  const sessionTypeColumnPresent = parts.some((p) => p.sessionTypeColumnPresent);
  return {
    events,
    rowIssues,
    headerRow,
    matchedHeaders: matched,
    sheetsParsed,
    sessionTypeColumnPresent,
  };
}
