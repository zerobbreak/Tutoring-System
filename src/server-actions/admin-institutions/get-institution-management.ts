import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadInstitutionDashboard } from "./institution-metrics";
import type {
  AcademicTermDTO,
  CampusDTO,
  InstitutionLecturerOptionDTO,
  InstitutionManagementDTO,
  InstitutionModuleDTO,
  InstitutionProfileDTO,
} from "./types";

export const getInstitutionManagementFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<InstitutionManagementDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const [instRes, campusesRes, termsRes, modulesRes, lecturersRes] =
      await Promise.all([
      supabase
        .from("institutions")
        .select(
          "id, name, domain, country, plan_tier, is_active, created_at, default_tutor_hourly_rate_cents, rate_currency",
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
      supabase
        .from("modules")
        .select(
          "id, institution_id, code, name, lecturer_id, academic_term_id, semester, academic_year, is_active, tutor_hourly_rate_cents",
        )
        .eq("institution_id", institutionId)
        .order("code", { ascending: true }),
      supabase
        .from("users")
        .select("id, full_name, email")
        .eq("institution_id", institutionId)
        .eq("role", "LECTURER")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);

    const errors = [
      instRes.error,
      campusesRes.error,
      termsRes.error,
      modulesRes.error,
      lecturersRes.error,
    ].filter(Boolean);
    if (errors.length) {
      throw new Error(errors.map((e) => e!.message).join(" · "));
    }

    const institution = instRes.data as InstitutionProfileDTO;
    const campuses = (campusesRes.data ?? []) as CampusDTO[];
    const academicTerms = (termsRes.data ?? []) as AcademicTermDTO[];
    const lecturers = (lecturersRes.data ?? []).map(
      (u) =>
        ({
          id: u.id as string,
          full_name: u.full_name as string,
          email: u.email as string,
        }) satisfies InstitutionLecturerOptionDTO,
    );

    const lecturerNameById = new Map(
      lecturers.map((l) => [l.id, l.full_name]),
    );
    const termLabelById = new Map(
      academicTerms.map((t) => [t.id, `${t.label} (${t.academic_year})`]),
    );

    const modules: InstitutionModuleDTO[] = (modulesRes.data ?? []).map(
      (row) => ({
        id: row.id as string,
        institution_id: row.institution_id as string,
        code: row.code as string,
        name: row.name as string,
        lecturer_id: row.lecturer_id as string,
        lecturer_name: lecturerNameById.get(row.lecturer_id as string) ?? null,
        academic_term_id: (row.academic_term_id as string | null) ?? null,
        academic_term_label: row.academic_term_id
          ? (termLabelById.get(row.academic_term_id as string) ?? null)
          : null,
        semester: (row.semester as string | null) ?? null,
        academic_year: (row.academic_year as string | null) ?? null,
        is_active: row.is_active as boolean,
        tutor_hourly_rate_cents:
          (row.tutor_hourly_rate_cents as number | null) ?? null,
      }),
    );

    const compensation_rates_available =
      (modulesRes.data ?? []).every((row) =>
        Object.prototype.hasOwnProperty.call(row, "tutor_hourly_rate_cents"),
      );

    const moduleIds = modules.map((m) => m.id);

    const dashboard = await loadInstitutionDashboard(
      supabase,
      institutionId,
      moduleIds,
    );

    return {
      institution,
      compensation_rates_available,
      campuses,
      academicTerms,
      modules,
      lecturers,
      dashboard,
    };
  },
);
