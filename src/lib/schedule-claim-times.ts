/** Map ISO datetimes to session_claims date/time columns (local wall clock). */
export function scheduleClaimTimesFromIso(
  startIso: string,
  endIso: string,
): {
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
} {
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new Error("Invalid start or end time.");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const session_date = `${a.getFullYear()}-${pad(a.getMonth() + 1)}-${pad(a.getDate())}`;
  const start_time = `${pad(a.getHours())}:${pad(a.getMinutes())}:00`;
  const end_time = `${pad(b.getHours())}:${pad(b.getMinutes())}:00`;
  const ms = b.getTime() - a.getTime();
  if (ms <= 0) throw new Error("End time must be after start time.");
  const hours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
  return { session_date, start_time, end_time, hours };
}

export function scheduleClaimTimesFromTimestamps(
  startsAt: Date,
  endsAt: Date,
): {
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
} {
  return scheduleClaimTimesFromIso(startsAt.toISOString(), endsAt.toISOString());
}

/** Prefer linked schedule timestamps when present (kanban, live/urgent). */
export function claimEffectiveTimes(claim: {
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  scheduled_starts_at?: string | null;
  scheduled_ends_at?: string | null;
}): { session_date: string; start: string; end: string } {
  if (claim.scheduled_starts_at && claim.scheduled_ends_at) {
    try {
      const t = scheduleClaimTimesFromIso(
        claim.scheduled_starts_at,
        claim.scheduled_ends_at,
      );
      return {
        session_date: t.session_date,
        start: t.start_time,
        end: t.end_time,
      };
    } catch {
      /* use claim columns */
    }
  }
  return {
    session_date: claim.session_date,
    start: claim.start_time ?? "09:00",
    end: claim.end_time ?? "10:00",
  };
}
