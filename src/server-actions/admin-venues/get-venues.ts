import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { AdminVenueDTO } from "./types";

export const getAdminVenuesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ venues: AdminVenueDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: rows, error } = await supabase
      .from("venues")
      .select(
        "id, name, code, capacity, campus_id, is_active, created_at, updated_at, campuses(name)",
      )
      .eq("institution_id", institutionId)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    // Get active schedule counts per venue in a single query
    const venueIds = (rows ?? []).map((r) => r.id as string);

    let scheduleCounts = new Map<string, number>();
    if (venueIds.length > 0) {
      const { data: countRows, error: countError } = await supabase
        .from("schedule_series")
        .select("venue_id")
        .in("venue_id", venueIds)
        .in("status", ["DRAFT", "PUBLISHED"]);

      if (countError) throw new Error(countError.message);

      for (const row of countRows ?? []) {
        const vid = row.venue_id as string;
        scheduleCounts.set(vid, (scheduleCounts.get(vid) ?? 0) + 1);
      }
    }

    const venues: AdminVenueDTO[] = (rows ?? []).map((row) => {
      const campus = row.campuses as { name: string } | null;
      return {
        id: row.id as string,
        name: row.name as string,
        code: (row.code as string | null) ?? null,
        capacity: (row.capacity as number | null) ?? null,
        campusId: (row.campus_id as string | null) ?? null,
        campusName: campus?.name ?? null,
        isActive: row.is_active as boolean,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        activeScheduleCount: scheduleCounts.get(row.id as string) ?? 0,
      };
    });

    return { venues };
  },
);
