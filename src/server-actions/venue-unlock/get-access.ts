import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { VenueUnlockAccessDTO } from "./types";

export const getVenueUnlockAccessFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<VenueUnlockAccessDTO> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { canAccess: false, canUnlockVenues: false };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, can_unlock_venues")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return { canAccess: false, canUnlockVenues: false };
    }

    const role = profile.role as string;
    const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
    const canUnlockVenues = Boolean(profile.can_unlock_venues);

    return {
      canAccess: isAdmin || (role === "LECTURER" && canUnlockVenues),
      canUnlockVenues: isAdmin || canUnlockVenues,
    };
  },
);
