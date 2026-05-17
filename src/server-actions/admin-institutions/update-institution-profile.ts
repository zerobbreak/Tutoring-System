import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { PLAN_TIERS } from "./types";

const profileSchema = z.object({
  name: z.string().min(2).max(255),
  domain: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  country: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  plan_tier: z.enum(PLAN_TIERS).optional().nullable(),
  is_active: z.boolean(),
});

function domainErrorMessage(err: { message: string; code?: string }): string {
  if (err.code === "23505" || err.message.includes("institutions_domain_key")) {
    return "That domain is already registered to another institution.";
  }
  return err.message;
}

export const updateInstitutionProfileFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { error } = await supabase
      .from("institutions")
      .update({
        name: data.name,
        domain: data.domain,
        country: data.country,
        plan_tier: data.plan_tier,
        is_active: data.is_active,
      })
      .eq("id", institutionId);

    if (error) throw new Error(domainErrorMessage(error));

    return { ok: true as const };
  });
