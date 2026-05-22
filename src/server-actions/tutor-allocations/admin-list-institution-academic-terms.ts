import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

export type AcademicTermOptionDTO = {
  id: string;
  label: string;
};

export const adminListInstitutionAcademicTermsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<AcademicTermOptionDTO[]> => {
  const supabase = createSupabaseServerClient();
  const { institutionId } = await requireAdminContext(supabase);

  const { data, error } = await supabase
    .from("academic_terms")
    .select("id, label")
    .eq("institution_id", institutionId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((term) => ({
    id: term.id as string,
    label: term.label as string,
  }));
});
