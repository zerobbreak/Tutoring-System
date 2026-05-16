import { format, parseISO, subDays } from "date-fns";
import type { AttendanceTrendPointDTO } from "./types";

type ClaimRow = {
  session_date: string;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
};

export function buildTrendSeries(
  claims: ClaimRow[],
  lookbackDays: number,
  now: Date,
): AttendanceTrendPointDTO[] {
  const byDate = new Map<
    string,
    { present: number; expected: number; sessions: number }
  >();

  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = subDays(now, i);
    const key = format(d, "yyyy-MM-dd");
    byDate.set(key, { present: 0, expected: 0, sessions: 0 });
  }

  for (const row of claims) {
    const present = row.attendance_present_count;
    const expected = row.attendance_expected_count;
    if (present == null || expected == null || expected <= 0) continue;

    const key = row.session_date;
    if (!byDate.has(key)) continue;

    const agg = byDate.get(key)!;
    agg.present += present;
    agg.expected += expected;
    agg.sessions += 1;
  }

  return [...byDate.entries()].map(([date, agg]) => ({
    date,
    dateLabel: format(parseISO(date), "MMM d"),
    present: agg.present,
    expected: agg.expected,
    rate: agg.expected > 0 ? Math.round((agg.present / agg.expected) * 100) : null,
    sessionCount: agg.sessions,
  }));
}
