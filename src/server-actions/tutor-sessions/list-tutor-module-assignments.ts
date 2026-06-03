import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import type { TutorModuleOption } from "#/server-actions/tutor-sessions/types";

/** Modules the tutor is actively assigned to (for create-session picker). */
export const listTutorModuleAssignmentsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<TutorModuleOption[]> => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

  const { data, error } = await supabase
    .from("tutor_assignments")
    .select("module:modules ( id, code, name )")
    .eq("tutor_id", tutorId)
    .eq("is_active", true)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  const out: TutorModuleOption[] = [];
  for (const row of data ?? []) {
    const m = row.module as
      | { id: string; code: string; name: string }
      | { id: string; code: string; name: string }[]
      | null;
    const mod = m == null ? null : Array.isArray(m) ? m[0] : m;
    if (mod)
      out.push({ moduleId: mod.id, code: mod.code, name: mod.name });
  }
  return out;
});
