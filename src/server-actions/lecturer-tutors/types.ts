export type TutorModuleAssignmentDTO = {
  assignmentId: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export type LecturerTutorCardDTO = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  isInactive: boolean;
  assignedModules: TutorModuleAssignmentDTO[];
  sessionsCompleted: number;
  attendanceAverage: number | null;
  approvalRate: number | null;
  pendingClaims: number;
  totalHours: number;
  disputeCount: number;
  upcomingSessions: number;
};

export type LecturerTutorsPageDataDTO = {
  tutors: LecturerTutorCardDTO[];
  modules: { id: string; code: string; name: string }[];
};

export type AssignableTutorDTO = {
  id: string;
  fullName: string;
  email: string;
};

export type TutorWorkloadPointDTO = {
  label: string;
  sessionCount: number;
  hours: number;
};

export type TutorAttendancePointDTO = {
  label: string;
  average: number;
};

export type LecturerTutorDetailDTO = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  isInactive: boolean;
  assignedModules: TutorModuleAssignmentDTO[];
  sessionsCompleted: number;
  attendanceAverage: number | null;
  approvalRate: number | null;
  pendingClaims: number;
  rejectedClaims: number;
  disputedClaims: number;
  totalHours: number;
  disputeCount: number;
  openDisputes: number;
  upcomingSessions: number;
  cancelledSessions: number;
  scheduleLinkedRate: number | null;
  workloadByMonth: TutorWorkloadPointDTO[];
  attendanceByMonth: TutorAttendancePointDTO[];
  recentClaimIds: string[];
};
