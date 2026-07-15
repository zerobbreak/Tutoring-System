import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { CampusDTO } from "./types";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  code: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  address: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  is_active: z.boolean().optional(),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

function mapCampus(row: Record<string, unknown>): CampusDTO {
  return row as CampusDTO;
}

export const createCampusFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: row, error } = await supabase
      .from("campuses")
      .insert({
        institution_id: institutionId,
        name: data.name,
        code: data.code,
        address: data.address,
        is_active: data.is_active ?? true,
      })
      .select(
        "id, institution_id, name, code, address, is_active, created_at, updated_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A campus with this code already exists.");
      }
      throw new Error(error.message);
    }

    return { campus: mapCampus(row as Record<string, unknown>) };
  });

export const updateCampusFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: row, error } = await supabase
      .from("campuses")
      .update({
        name: data.name,
        code: data.code,
        address: data.address,
        is_active: data.is_active ?? true,
      })
      .eq("id", data.id)
      .eq("institution_id", institutionId)
      .select(
        "id, institution_id, name, code, address, is_active, created_at, updated_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A campus with this code already exists.");
      }
      throw new Error(error.message);
    }

    if (!row) throw new Error("Campus not found.");

    return { campus: mapCampus(row as Record<string, unknown>) };
  });
