import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadInstitutionDashboard } from "./institution-metrics";
import type {
  AcademicTermDTO,
  CampusDTO,
  InstitutionManagementDTO,
  InstitutionProfileDTO,
} from "./types";

export const getInstitutionManagementFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<InstitutionManagementDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const [instRes, campusesRes, termsRes, modulesRes] = await Promise.all([
      supabase
        .from("institutions")
        .select(
          "id, name, domain, country, plan_tier, is_active, created_at",
        )
        .eq("id", institutionId)
        .single(),
      supabase
        .from("campuses")
        .select(
          "id, institution_id, name, code, address, is_active, created_at, updated_at",
        )
        .eq("institution_id", institutionId)
        .order("name", { ascending: true }),
      supabase
        .from("academic_terms")
        .select(
          "id, institution_id, label, academic_year, start_date, end_date, is_current, created_at",
        )
        .eq("institution_id", institutionId)
        .order("start_date", { ascending: false }),
      supabase.from("modules").select("id").eq("institution_id", institutionId),
    ]);

    const errors = [
      instRes.error,
      campusesRes.error,
      termsRes.error,
      modulesRes.error,
    ].filter(Boolean);
    if (errors.length) {
      throw new Error(errors.map((e) => e!.message).join(" · "));
    }

    const institution = instRes.data as InstitutionProfileDTO;
    const campuses = (campusesRes.data ?? []) as CampusDTO[];
    const academicTerms = (termsRes.data ?? []) as AcademicTermDTO[];
    const moduleIds = (modulesRes.data ?? []).map((m) => m.id as string);

    const dashboard = await loadInstitutionDashboard(
      supabase,
      institutionId,
      moduleIds,
    );

    return {
      institution,
      campuses,
      academicTerms,
      dashboard,
    };
  },
);
