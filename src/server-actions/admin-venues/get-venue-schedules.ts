import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { normalizeSupabaseNestedRow } from "#/lib/supabase-nested-row";
import type { VenueScheduleDTO } from "./types";

const inputSchema = z.object({
  venueId: z.string().uuid(),
});

const WEEKDAY_LABELS: Record<string, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

function extractDayOfWeek(recurrenceJson: unknown): string {
  if (
    recurrenceJson &&
    typeof recurrenceJson === "object" &&
    !Array.isArray(recurrenceJson)
  ) {
    const rec = recurrenceJson as Record<string, unknown>;
    const byWeekday = rec.byWeekday;
    if (Array.isArray(byWeekday) && byWeekday.length > 0) {
      return WEEKDAY_LABELS[String(byWeekday[0])] ?? String(byWeekday[0]);
    }
    if (typeof byWeekday === "string") {
      return WEEKDAY_LABELS[byWeekday] ?? byWeekday;
    }
  }
  return "Unknown";
}

function extractStartTime(dtstart: unknown): string {
  if (typeof dtstart === "string") {
    const date = new Date(dtstart);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-ZA", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  }
  return "00:00";
}

export const getVenueSchedulesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ schedules: VenueScheduleDTO[] }> => {
      const supabase = createSupabaseServerClient();
      const { institutionId } = await requireAdminContext(supabase);

      const { data: rows, error } = await supabase
        .from("schedule_series")
        .select(
          "id, title, status, dtstart, duration_minutes, recurrence_json, modules(code), users!schedule_series_tutor_id_fkey(user_metadata)",
        )
        .eq("venue_id", data.venueId)
        .eq("institution_id", institutionId);

      if (error) throw new Error(error.message);

      const schedules: VenueScheduleDTO[] = (rows ?? []).map((row) => {
        const mod = normalizeSupabaseNestedRow(row.modules) as { code: string } | null;
        const user = normalizeSupabaseNestedRow(row.users) as { user_metadata: Record<string, unknown> } | null;
        const fullName =
          user?.user_metadata?.full_name ??
          user?.user_metadata?.name ??
          "Unknown";

        return {
          seriesId: row.id as string,
          title: row.title as string,
          moduleCode: mod?.code ?? "N/A",
          tutorName: String(fullName),
          dayOfWeek: extractDayOfWeek(row.recurrence_json),
          startTime: extractStartTime(row.dtstart),
          durationMinutes: row.duration_minutes as number,
          status: row.status as string,
        };
      });

      return { schedules };
    },
  );
