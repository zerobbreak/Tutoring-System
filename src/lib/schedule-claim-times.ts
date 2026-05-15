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
