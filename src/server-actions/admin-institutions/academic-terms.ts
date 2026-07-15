import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { AcademicTermDTO } from "./types";

const termFields = {
  label: z.string().min(1).max(100),
  academic_year: z.string().min(1).max(20),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_current: z.boolean().optional(),
};

const createSchema = z.object(termFields).refine(
  (d) => d.end_date >= d.start_date,
  { message: "End date must be on or after start date." },
);

const updateSchema = z
  .object({
    id: z.string().uuid(),
    ...termFields,
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "End date must be on or after start date.",
  });

const idSchema = z.object({ id: z.string().uuid() });

async function clearCurrentTerms(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  institutionId: string,
  exceptId?: string,
) {
  let query = supabase
    .from("academic_terms")
    .update({ is_current: false })
    .eq("institution_id", institutionId)
    .eq("is_current", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export const createAcademicTermFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    if (data.is_current) {
      await clearCurrentTerms(supabase, institutionId);
    }

    const { data: row, error } = await supabase
      .from("academic_terms")
      .insert({
        institution_id: institutionId,
        label: data.label,
        academic_year: data.academic_year,
        start_date: data.start_date,
        end_date: data.end_date,
        is_current: data.is_current ?? false,
      })
      .select(
        "id, institution_id, label, academic_year, start_date, end_date, is_current, created_at",
      )
      .single();

    if (error) throw new Error(error.message);

    return { term: row as AcademicTermDTO };
  });

export const updateAcademicTermFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    if (data.is_current) {
      await clearCurrentTerms(supabase, institutionId, data.id);
    }

    const { data: row, error } = await supabase
      .from("academic_terms")
      .update({
        label: data.label,
        academic_year: data.academic_year,
        start_date: data.start_date,
        end_date: data.end_date,
        is_current: data.is_current ?? false,
      })
      .eq("id", data.id)
      .eq("institution_id", institutionId)
      .select(
        "id, institution_id, label, academic_year, start_date, end_date, is_current, created_at",
      )
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Academic term not found.");

    return { term: row as AcademicTermDTO };
  });

export const deleteAcademicTermFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { error } = await supabase
      .from("academic_terms")
      .delete()
      .eq("id", data.id)
      .eq("institution_id", institutionId);

    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

export const setCurrentAcademicTermFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    await clearCurrentTerms(supabase, institutionId, data.id);

    const { data: row, error } = await supabase
      .from("academic_terms")
      .update({ is_current: true })
      .eq("id", data.id)
      .eq("institution_id", institutionId)
      .select(
        "id, institution_id, label, academic_year, start_date, end_date, is_current, created_at",
      )
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Academic term not found.");

    return { term: row as AcademicTermDTO };
  });
