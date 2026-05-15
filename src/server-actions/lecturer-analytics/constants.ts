export const ANALYTICS_LOOKBACK_DAYS = 90;
export const HEATMAP_WEEKS = 8;
export const LOW_ATTENDANCE_RATIO = 0.6;
export const HIGH_RISK_ATTENDANCE_THRESHOLD = 0.65;
export const HIGH_RISK_DISPUTE_RATE = 0.08;
export const HIGH_RISK_PENDING_COUNT = 3;

export const APPROVE_ACTION_TYPES = new Set(["APPROVED", "SIGNED_APPROVAL"]);
export const APPROVE_TO_STATUSES = new Set(["VERIFIED", "APPROVED"]);

export const CLAIM_ANALYTICS_SELECT = `
  id,
  tutor_id,
  module_id,
  session_date,
  status,
  submitted_at,
  updated_at,
  hours,
  attendance_present_count,
  attendance_expected_count,
  source_scheduled_session_id
`;

export const STATUS_FUNNEL_ORDER = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
  "VERIFIED",
  "APPROVED",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_VERIFICATION: "Pending verification",
  DISPUTED: "Disputed",
  REJECTED: "Rejected",
  VERIFIED: "Verified",
  APPROVED: "Approved",
};
