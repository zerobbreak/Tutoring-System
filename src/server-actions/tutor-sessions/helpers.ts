import { parse } from "date-fns";
import { createSupabaseServerClient } from "#/lib/supabase-server";

export async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export type ParsedSessionClock = {
  start_time: string;
  end_time: string;
  hours: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

function parseClock(t: string) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t.trim());
  if (!m) throw new Error("Invalid time format. Use HH:mm.");
  return {
    h: Number(m[1]),
    mi: Number(m[2]),
    s: m[3] ? Number(m[3]) : 0,
  };
}

/** Normalize HH:mm inputs and compute duration hours for a session date. */
export function parseSessionClockTimes(
  sessionDate: string,
  startTime: string,
  endTime: string,
): ParsedSessionClock {
  const a = parseClock(startTime);
  const b = parseClock(endTime);
  const start_time = `${pad(a.h)}:${pad(a.mi)}:${pad(a.s)}`;
  const end_time = `${pad(b.h)}:${pad(b.mi)}:${pad(b.s)}`;

  const base = parse(sessionDate, "yyyy-MM-dd", new Date());
  const s = new Date(base);
  s.setHours(a.h, a.mi, a.s, 0);
  const e = new Date(base);
  e.setHours(b.h, b.mi, b.s, 0);
  if (e.getTime() <= s.getTime()) {
    e.setDate(e.getDate() + 1);
  }
  const ms = e.getTime() - s.getTime();
  const hours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;

  return { start_time, end_time, hours };
}
