import { createServerFn } from "@tanstack/react-start";
import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "./require-user";
import { accountProfileSchema, institutionSchema } from "./types";

export const updateAccountProfileFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => accountProfileSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    await requireUserId(supabase);
    const { fullName, phone, department, officeLocation } = data;

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        phone: phone ?? "",
        department: department ?? "",
        office_location: officeLocation ?? "",
      },
    });
    if (authError) throw new Error(authError.message);

    await ensurePublicUserProfile(supabase, { full_name: fullName });

    return { success: true };
  });

export const updateInstitutionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => institutionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    await requireUserId(supabase);

    const profile = await ensurePublicUserProfile(supabase);
    if (profile.institution_id) {
      throw new Error(
        "Institution is already assigned. Contact an administrator to change it.",
      );
    }

    await ensurePublicUserProfile(supabase, {
      institution_id: data.institutionId,
    });

    return { success: true };
  });
