import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  isMissingVenueAccessControlColumnError,
  type VenueAccessControl,
} from "#/lib/venue-access";
import type { AdminVenueDTO } from "./types";

export const getAdminVenuesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ venues: AdminVenueDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    type VenueRow = {
      id: string;
      name: string;
      code: string | null;
      capacity: number | null;
      campus_id: string | null;
      access_control?: VenueAccessControl;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      campuses?: unknown;
    };

    const venueSelect =
      "id, name, code, capacity, campus_id, access_control, is_active, created_at, updated_at, campuses(name)";
    const fallbackVenueSelect =
      "id, name, code, capacity, campus_id, is_active, created_at, updated_at, campuses(name)";

    let rows: VenueRow[] | null = null;
    let error: { message?: string | null } | null = null;

    ({ data: rows, error } = await supabase
      .from("venues")
      .select(venueSelect)
      .eq("institution_id", institutionId)
      .order("name", { ascending: true }));

    if (error && isMissingVenueAccessControlColumnError(error)) {
      ({ data: rows, error } = await supabase
        .from("venues")
        .select(fallbackVenueSelect)
        .eq("institution_id", institutionId)
        .order("name", { ascending: true }));
    }

    if (error) throw new Error(error.message ?? "Failed to load venues.");

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
        accessControl:
          ((row as { access_control?: unknown }).access_control as
            | VenueAccessControl
            | undefined) ?? "OPEN",
        isActive: row.is_active as boolean,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        activeScheduleCount: scheduleCounts.get(row.id as string) ?? 0,
      };
    });

    return { venues };
  },
);
