import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { loadTutorBudgetContext } from "./load-budget-context";

async function requireTutorId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<{ tutorId: string; institutionId: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: row, error: userErr } = await supabase
    .from("users")
    .select("id, role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (userErr) throw new Error(userErr.message);
  if (!row?.institution_id) throw new Error("Institution not found.");
  if (row.role !== "TUTOR") throw new Error("Tutor access required.");

  return {
    tutorId: row.id as string,
    institutionId: row.institution_id as string,
  };
}

export const getTutorHourBudgetFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TutorHourBudgetSummary> => {
    const supabase = createSupabaseServerClient();
    const { tutorId, institutionId } = await requireTutorId(supabase);
    const { summary } = await loadTutorBudgetContext(
      supabase,
      tutorId,
      institutionId,
    );
    return summary;
  },
);
