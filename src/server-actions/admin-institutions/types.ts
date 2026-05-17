export const PLAN_TIERS = [
  "free",
  "standard",
  "enterprise",
  "custom",
] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

export type InstitutionProfileDTO = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  plan_tier: string | null;
  is_active: boolean;
  created_at: string;
  default_tutor_hourly_rate_cents: number;
  rate_currency: string;
};

export type CampusDTO = {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademicTermDTO = {
  id: string;
  institution_id: string;
  label: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};

export type InstitutionLecturerOptionDTO = {
  id: string;
  full_name: string;
  email: string;
};

export type InstitutionModuleDTO = {
  id: string;
  institution_id: string;
  code: string;
  name: string;
  lecturer_id: string;
  lecturer_name: string | null;
  academic_term_id: string | null;
  academic_term_label: string | null;
  semester: string | null;
  academic_year: string | null;
  is_active: boolean;
  tutor_hourly_rate_cents: number | null;
};

export type InstitutionVerificationMetricsDTO = {
  pendingVerificationCount: number;
  medianTurnaroundHours: number | null;
  openDisputes: number;
  claimsByStatus: { status: string; count: number }[];
};

export type InstitutionDashboardDTO = {
  activeUsers: number;
  activeTutors: number;
  totalLecturers: number;
  totalClaims: number;
  verification: InstitutionVerificationMetricsDTO;
};

export type InstitutionManagementDTO = {
  institution: InstitutionProfileDTO;
  campuses: CampusDTO[];
  academicTerms: AcademicTermDTO[];
  modules: InstitutionModuleDTO[];
  lecturers: InstitutionLecturerOptionDTO[];
  dashboard: InstitutionDashboardDTO;
};
