import { createServerFn } from "@tanstack/react-start";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireLecturerInstitutionId } from "#/server-actions/lecturer-tutors/require-lecturer-institution";

export type AcademicTermOptionDTO = {
  id: string;
  label: string;
};

export const listInstitutionAcademicTermsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<AcademicTermOptionDTO[]> => {
  const supabase = createSupabaseServerClient();
  const lecturerId = await requireLecturerId(supabase);
  const institutionId = await requireLecturerInstitutionId(
    supabase,
    lecturerId,
  );

  const { data, error } = await supabase
    .from("academic_terms")
    .select("id, label")
    .eq("institution_id", institutionId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    label: t.label as string,
  }));
});
