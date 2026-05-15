import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getUserInstitutionId, requireUserId } from "./helpers";

const searchUsersSchema = z.object({
  query: z.string(),
});

export const searchUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => searchUsersSchema.parse(d))
  .handler(async ({ data: { query } }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const institutionId = await getUserInstitutionId(supabase, userId);

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("institution_id", institutionId)
      .neq("id", userId)
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) throw new Error(error.message);
    return data ?? [];
  });
