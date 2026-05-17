import { addDays, format, isSameDay, parse, subDays } from "date-fns";

export type ClaimStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "DISPUTED"
  | "REJECTED"
  | "VERIFIED"
  | "APPROVED";

export type SessionKanbanColumnId =
  | "claimsPending"
  | "today"
  | "upcoming"
  | "completed";

/** Workflow lane — drafts use the calendar columns until submitted. */
const CLAIMS_PENDING: readonly ClaimStatus[] = [
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
] as const;

/** Parse "HH:mm" or "HH:mm:ss" fragment into hours and minutes. */
function parseClockParts(clock: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})/.exec(clock.trim());
  if (!m) return { h: 0, m: 0 };
  return { h: Number(m[1]), m: Number(m[2]) };
}

/**
 * Build local start/end instants for a session row (session_date + wall-clock times).
 */
export function sessionBoundsLocal(
  sessionDate: string,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const base = parse(sessionDate, "yyyy-MM-dd", new Date());
  const sh = parseClockParts(startTime);
  const eh = parseClockParts(endTime);
  const start = new Date(base);
  start.setHours(sh.h, sh.m, 0, 0);
  const end = new Date(base);
  end.setHours(eh.h, eh.m, 0, 0);
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

export function isClaimsPendingStatus(status: ClaimStatus): boolean {
  return (CLAIMS_PENDING as readonly string[]).includes(status);
}

/**
 * Single canonical board column for a claim (workflow column wins over calendar).
 */
export function sessionKanbanColumn(
  now: Date,
  sessionDate: string,
  startTime: string,
  endTime: string,
  status: ClaimStatus,
): SessionKanbanColumnId {
  if (isClaimsPendingStatus(status)) {
    return "claimsPending";
  }

  const { start, end } = sessionBoundsLocal(sessionDate, startTime, endTime);

  if (end.getTime() < now.getTime()) {
    return "completed";
  }

  if (isSameDay(start, now)) {
    return "today";
  }

  if (start.getTime() > now.getTime()) {
    return "upcoming";
  }

  return "today";
}

export type TimeKanbanColumnId = Exclude<SessionKanbanColumnId, "claimsPending">;

export function schedulingDateForColumn(
  column: TimeKanbanColumnId,
  now: Date,
): string {
  const d =
    column === "today"
      ? now
      : column === "upcoming"
        ? addDays(now, 1)
        : subDays(now, 1);
  return format(d, "yyyy-MM-dd");
}
