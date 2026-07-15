import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { parseRateInputToCents } from "#/lib/money";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertTargetUserInInstitution } from "#/server-actions/admin-users/assert-target-user";
import type { InstitutionModuleDTO } from "./types";

const moduleFields = {
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((v) => v.trim().toUpperCase()),
  name: z
    .string()
    .min(1)
    .max(255)
    .transform((v) => v.trim()),
  lecturer_id: z.string().uuid(),
  academic_term_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  tutor_hourly_rate: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
};

const createSchema = z.object(moduleFields);

const updateSchema = z.object({
  id: z.string().uuid(),
  ...moduleFields,
});

async function assertAcademicTermInInstitution(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  institutionId: string,
  academicTermId: string | null | undefined,
): Promise<void> {
  if (!academicTermId) return;

  const { data, error } = await supabase
    .from("academic_terms")
    .select("id")
    .eq("id", academicTermId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Academic term not found in your institution.");
}

async function assertLecturerInInstitution(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: Awaited<ReturnType<typeof requireAdminContext>>,
  lecturerId: string,
): Promise<void> {
  const lecturer = await assertTargetUserInInstitution(
    supabase,
    ctx,
    lecturerId,
  );
  if (lecturer.role !== "LECTURER") {
    throw new Error("Selected user must have the lecturer role.");
  }
}

function mapModule(row: Record<string, unknown>): InstitutionModuleDTO {
  return row as InstitutionModuleDTO;
}

const moduleSelect =
  "id, institution_id, code, name, lecturer_id, academic_term_id, semester, academic_year, is_active, tutor_hourly_rate_cents";

function parseModuleRateCents(
  input: string | null | undefined,
): number | null {
  if (!input) return null;
  const cents = parseRateInputToCents(input);
  if (cents == null) {
    throw new Error("Module hourly rate must be a positive number (e.g. 225).");
  }
  return cents;
}

export const createModuleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    await assertLecturerInInstitution(supabase, ctx, data.lecturer_id);
    await assertAcademicTermInInstitution(
      supabase,
      ctx.institutionId,
      data.academic_term_id,
    );

    const { data: row, error } = await supabase
      .from("modules")
      .insert({
        institution_id: ctx.institutionId,
        code: data.code,
        name: data.name,
        lecturer_id: data.lecturer_id,
        academic_term_id: data.academic_term_id ?? null,
        is_active: data.is_active ?? true,
      })
      .select(moduleSelect)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A module with this code already exists.");
      }
      throw new Error(error.message);
    }

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "module",
      entityId: row.id as string,
      event: "module.created",
      payload: { code: data.code, lecturer_id: data.lecturer_id },
    });

    return { module: mapModule(row as Record<string, unknown>) };
  });

export const updateModuleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    await assertLecturerInInstitution(supabase, ctx, data.lecturer_id);
    await assertAcademicTermInInstitution(
      supabase,
      ctx.institutionId,
      data.academic_term_id,
    );

    const tutorRateCents = parseModuleRateCents(data.tutor_hourly_rate);

    const { data: row, error } = await supabase
      .from("modules")
      .update({
        code: data.code,
        name: data.name,
        lecturer_id: data.lecturer_id,
        academic_term_id: data.academic_term_id ?? null,
        is_active: data.is_active ?? true,
        tutor_hourly_rate_cents: tutorRateCents,
      })
      .eq("id", data.id)
      .eq("institution_id", ctx.institutionId)
      .select(moduleSelect)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A module with this code already exists.");
      }
      throw new Error(error.message);
    }

    if (!row) throw new Error("Module not found.");

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityId: data.id,
      entityType: "module",
      event: "module.updated",
      payload: { code: data.code, lecturer_id: data.lecturer_id },
    });

    return { module: mapModule(row as Record<string, unknown>) };
  });
