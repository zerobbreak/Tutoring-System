import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import type { TutorActiveVenueOption } from "./types";

export const listActiveVenuesFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<TutorActiveVenueOption[]> => {
  const supabase = createSupabaseServerClient();
  await requireUserId(supabase);

  const { data: venues, error: vErr } = await supabase
    .from("venues")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (vErr) throw new Error(vErr.message);

  return (venues ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    code: v.code ?? null,
  }));
});
