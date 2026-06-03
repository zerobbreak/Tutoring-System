import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  code: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  capacity: z.number().int().positive().optional().nullable(),
  campusId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createVenueFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: row, error } = await supabase
      .from("venues")
      .insert({
        institution_id: institutionId,
        name: data.name,
        code: data.code,
        capacity: data.capacity ?? null,
        campus_id: data.campusId ?? null,
        is_active: data.isActive ?? true,
      })
      .select(
        "id, name, code, capacity, campus_id, is_active, created_at, updated_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A venue with this name or code already exists.");
      }
      throw new Error(error.message);
    }

    return { venue: row };
  });
