import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { parseRateInputToCents } from "#/lib/money";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const schema = z.object({
  hourlyRate: z.string().min(1).max(20),
});

export const updateInstitutionPayrollRateFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const cents = parseRateInputToCents(data.hourlyRate);
    if (cents == null) {
      throw new Error("Enter a valid hourly rate (e.g. 225).");
    }

    const { error } = await supabase
      .from("institutions")
      .update({ default_tutor_hourly_rate_cents: cents })
      .eq("id", institutionId);

    if (error) throw new Error(error.message);

    return { ok: true as const, hourlyRateCents: cents };
  });
