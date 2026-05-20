import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireLecturerInstitutionId } from "#/server-actions/lecturer-tutors/require-lecturer-institution";
import { loadTutorBudgetContext } from "./load-budget-context";

const schema = z.object({
  tutorId: z.string().uuid(),
});

export const getLecturerTutorHourBudgetFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<TutorHourBudgetSummary> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const institutionId = await requireLecturerInstitutionId(
      supabase,
      lecturerId,
    );

    const { summary } = await loadTutorBudgetContext(
      supabase,
      data.tutorId,
      institutionId,
    );
    return summary;
  });
