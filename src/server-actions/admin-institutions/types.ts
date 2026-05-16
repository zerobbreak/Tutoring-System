import type { AttendanceTrendPointDTO } from "#/server-actions/lecturer-attendance/types";

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
  attendanceTrend: AttendanceTrendPointDTO[];
  verification: InstitutionVerificationMetricsDTO;
};

export type InstitutionManagementDTO = {
  institution: InstitutionProfileDTO;
  campuses: CampusDTO[];
  academicTerms: AcademicTermDTO[];
  dashboard: InstitutionDashboardDTO;
};
