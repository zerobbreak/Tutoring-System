import { createServerFn } from "@tanstack/react-start";
import { addMinutes, isAfter, parseISO } from "date-fns";
import { z } from "zod";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  getUnlockUrgentMinutesBefore,
  parseUnlockSchedulingSettings,
  type VenueUnlockStatus,
} from "#/lib/venue-access";
import type { TutorVenueUnlockStatusDTO } from "./types";

const schema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const getVenueUnlockStatusForTutorFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ items: TutorVenueUnlockStatusDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: profile } = await supabase
      .from("users")
      .select("institution_id")
      .eq("id", tutorId)
      .single();

    const institutionId = profile?.institution_id as string | undefined;
    if (!institutionId) return { items: [] };

    const { data: institution } = await supabase
      .from("institutions")
      .select("scheduling_settings")
      .eq("id", institutionId)
      .single();

    const urgentMinutes = getUnlockUrgentMinutesBefore(
      parseUnlockSchedulingSettings(institution?.scheduling_settings),
    );

    const { data: sessions, error } = await supabase
      .from("scheduled_sessions")
      .select(
        `
        id,
        starts_at,
        tutor_id,
        venue_text,
        venue:venues ( name, access_control ),
        unlock:venue_unlock_requests (
          status,
          claimed_by_user:users!venue_unlock_requests_claimed_by_fkey ( full_name )
        )
      `,
      )
      .eq("tutor_id", tutorId)
      .gte("starts_at", data.from)
      .lte("starts_at", data.to)
      .is("deleted_at", null)
      .neq("status", "CANCELLED");

    if (error) throw new Error(error.message);

    const now = new Date();

    const items: TutorVenueUnlockStatusDTO[] = (sessions ?? [])
      .filter((row) => {
        const venue = row.venue as { access_control: string } | null;
        return venue?.access_control === "FACIAL_RECOGNITION";
      })
      .map((row) => {
        const unlockRaw = row.unlock as
          | {
              status: string;
              claimed_by_user: { full_name: string } | { full_name: string }[] | null;
            }
          | {
              status: string;
              claimed_by_user: { full_name: string } | { full_name: string }[] | null;
            }[]
          | null;
        const unlock = Array.isArray(unlockRaw) ? unlockRaw[0] : unlockRaw;
        const venue = row.venue as { name: string } | null;
        const claimant = unlock?.claimed_by_user;
        const claimedByName = Array.isArray(claimant)
          ? claimant[0]?.full_name ?? null
          : claimant?.full_name ?? null;

        const startsAt = row.starts_at as string;
        const status = (unlock?.status ?? null) as VenueUnlockStatus | null;
        const pingOpensAt = addMinutes(parseISO(startsAt), -urgentMinutes);
        const canPing =
          !isAfter(pingOpensAt, now) &&
          (status === "PENDING" || status === "URGENT" || status === "CLAIMED");

        return {
          scheduledSessionId: row.id as string,
          status,
          claimedByName,
          venueName: venue?.name ?? (row.venue_text as string | null),
          startsAt,
          canPing,
        };
      });

    return { items };
  });
