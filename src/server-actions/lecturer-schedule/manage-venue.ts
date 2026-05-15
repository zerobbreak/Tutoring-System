import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const createVenueSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(50).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

export const createVenueFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createVenueSchema.parse(input))
  .handler(async ({ data }): Promise<{ venueId: string }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("institution_id")
      .eq("id", lecturerId)
      .single();

    if (profErr) throw new Error(profErr.message);

    const { data: inserted, error: insErr } = await supabase
      .from("venues")
      .insert({
        institution_id: profile.institution_id,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        capacity: data.capacity ?? null,
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { venueId: inserted.id as string };
  });
