import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { loadTutorBudgetContext } from "./load-budget-context";

const schema = z.object({ tutorId: z.string().uuid() });

export const adminGetTutorHourBudgetFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<TutorHourBudgetSummary> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: tutor, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", data.tutorId)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (userError) throw new Error(userError.message);
    if (!tutor) throw new Error("Tutor not found or access denied.");

    const { summary } = await loadTutorBudgetContext(
      supabase,
      data.tutorId,
      institutionId,
    );

    return summary;
  });
