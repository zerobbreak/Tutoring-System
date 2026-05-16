export { getInstitutionManagementFn } from "./get-institution-management";
export { updateInstitutionProfileFn } from "./update-institution-profile";
export {
  createCampusFn,
  updateCampusFn,
} from "./campuses";
export {
  createAcademicTermFn,
  updateAcademicTermFn,
  deleteAcademicTermFn,
  setCurrentAcademicTermFn,
} from "./academic-terms";
export { createModuleFn, updateModuleFn } from "./modules";

export type {
  AcademicTermDTO,
  CampusDTO,
  InstitutionDashboardDTO,
  InstitutionLecturerOptionDTO,
  InstitutionManagementDTO,
  InstitutionModuleDTO,
  InstitutionProfileDTO,
  InstitutionVerificationMetricsDTO,
  PlanTier,
} from "./types";
export { PLAN_TIERS } from "./types";
