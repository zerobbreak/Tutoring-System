import type { OnboardingDocumentKind } from "#/lib/onboarding-documents";
import type { UserRole } from "#/lib/user-role";

export const ADMIN_USER_CATEGORIES = [
  "all",
  "tutors",
  "lecturers",
  "admins",
  "pending",
  "disabled",
] as const;

export type AdminUserCategory = (typeof ADMIN_USER_CATEGORIES)[number];

export type AdminUserRowDTO = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  institution_id: string | null;
  institution_name: string | null;
  last_login_at: string | null;
  user_status: string;
  onboarding_step: string | null;
  /** @deprecated Synced from user_status via DB trigger */
  approval_status: string;
  mfa_enabled: boolean;
  /** @deprecated Use user_status; kept for list filters during transition */
  is_active: boolean;
  created_at: string;
};

export type AdminUserDocumentDTO = {
  id: string;
  document_kind: OnboardingDocumentKind;
  file_name: string;
  mime_type: string;
  storage_path: string;
  submitted_at: string;
  download_url: string | null;
};

export type AdminUserModuleDTO = {
  id: string;
  code: string;
  name: string;
};

export type AdminUserDetailDTO = {
  user: AdminUserRowDTO;
  documents: AdminUserDocumentDTO[];
  modules_as_lecturer: AdminUserModuleDTO[];
  active_tutor_assignments: number;
};

export type InstitutionModuleOptionDTO = {
  id: string;
  code: string;
  name: string;
  lecturer_id: string;
  lecturer_name: string | null;
};
