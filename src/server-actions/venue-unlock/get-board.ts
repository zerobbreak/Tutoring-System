import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { VenueUnlockStatus } from "#/lib/venue-access";
import { requireUnlockResponderContext } from "#/lib/venue-unlock-server";
import type { VenueUnlockBoardItemDTO } from "./types";

const boardSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const getVenueUnlockBoardFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => boardSchema.parse(input))
  .handler(async ({ data }): Promise<{ items: VenueUnlockBoardItemDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireUnlockResponderContext(supabase);

    const { data: sessions, error } = await supabase
      .from("scheduled_sessions")
      .select(
        `
        id,
        starts_at,
        ends_at,
        status,
        tutor_id,
        venue_id,
        venue_text,
        module:modules!scheduled_sessions_module_id_fkey (
          code,
          name,
          institution_id
        ),
        tutor:users!scheduled_sessions_tutor_id_fkey ( full_name ),
        series:schedule_series!scheduled_sessions_series_id_fkey ( title ),
        venue:venues (
          id,
          name,
          access_control
        ),
        unlock:venue_unlock_requests (
          id,
          status,
          claimed_by,
          claimed_at,
          urgent_at,
          claimed_by_user:users!venue_unlock_requests_claimed_by_fkey ( full_name )
        )
      `,
      )
      .gte("starts_at", data.from)
      .lte("starts_at", data.to)
      .is("deleted_at", null)
      .neq("status", "CANCELLED");

    if (error) throw new Error(error.message);

    const sessionIds = (sessions ?? []).map((s) => s.id as string);
    const claimIdBySession = new Map<string, string>();
    if (sessionIds.length) {
      const { data: claims } = await supabase
        .from("session_claims")
        .select("id, source_scheduled_session_id")
        .in("source_scheduled_session_id", sessionIds)
        .is("deleted_at", null);
      for (const c of claims ?? []) {
        claimIdBySession.set(
          c.source_scheduled_session_id as string,
          c.id as string,
        );
      }
    }

    const items: VenueUnlockBoardItemDTO[] = (sessions ?? [])
      .filter((row) => {
        const mod = row.module as unknown as { institution_id: string } | null;
        if (mod?.institution_id !== institutionId) return false;
        const venue = row.venue as unknown as { access_control: string } | null;
        return venue?.access_control === "FACIAL_RECOGNITION";
      })
      .map((row) => {
        const unlockRaw = row.unlock as
          | {
              id: string;
              status: string;
              claimed_by: string | null;
              claimed_at: string | null;
              urgent_at: string | null;
              claimed_by_user: { full_name: string } | { full_name: string }[] | null;
            }
          | {
              id: string;
              status: string;
              claimed_by: string | null;
              claimed_at: string | null;
              urgent_at: string | null;
              claimed_by_user: { full_name: string } | { full_name: string }[] | null;
            }[]
          | null;
        const unlock = Array.isArray(unlockRaw) ? unlockRaw[0] : unlockRaw;
        const mod = row.module as unknown as { code: string; name: string };
        const tutor = row.tutor as unknown as { full_name: string } | null;
        const series = row.series as unknown as { title: string } | null;
        const venue = row.venue as unknown as { id: string; name: string } | null;
        const claimant = unlock?.claimed_by_user;
        const claimantName = Array.isArray(claimant)
          ? claimant[0]?.full_name ?? null
          : claimant?.full_name ?? null;

        return {
          unlockRequestId: unlock?.id ?? "",
          scheduledSessionId: row.id as string,
          status: (unlock?.status ?? "PENDING") as VenueUnlockStatus,
          claimedById: unlock?.claimed_by ?? null,
          claimedByName: claimantName,
          claimedAt: unlock?.claimed_at ?? null,
          urgentAt: unlock?.urgent_at ?? null,
          moduleCode: mod.code,
          moduleName: mod.name,
          title: series?.title ?? "Session",
          tutorId: row.tutor_id as string,
          tutorName: tutor?.full_name ?? "",
          venueId: venue?.id ?? (row.venue_id as string | null),
          venueName: venue?.name ?? (row.venue_text as string | null),
          startsAt: row.starts_at as string,
          endsAt: row.ends_at as string,
          sessionStatus: row.status as string,
          claimId: claimIdBySession.get(row.id as string) ?? null,
        };
      });

    return { items };
  });
