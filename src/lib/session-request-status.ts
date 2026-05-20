export type SessionRequestStatus =
  | "PENDING"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "APPROVED";

export const SESSION_REQUEST_STATUS = {
  PENDING: "PENDING",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
} as const satisfies Record<string, SessionRequestStatus>;

export function isSessionRequestStatus(
  value: string | null | undefined,
): value is SessionRequestStatus {
  return (
    value === "PENDING" ||
    value === "CHANGES_REQUESTED" ||
    value === "REJECTED" ||
    value === "APPROVED"
  );
}

export function isPendingSessionRequest(row: {
  request_status?: string | null;
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
}): boolean {
  if (row.source_scheduled_session_id || row.source_schedule_import_id) {
    return false;
  }
  return (
    row.request_status === SESSION_REQUEST_STATUS.PENDING ||
    row.request_status === SESSION_REQUEST_STATUS.CHANGES_REQUESTED ||
    row.request_status == null
  );
}

export function sessionRequestStatusLabel(
  status: SessionRequestStatus | null | undefined,
): string {
  switch (status) {
    case "PENDING":
      return "Awaiting approval";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "REJECTED":
      return "Rejected";
    case "APPROVED":
      return "Approved";
    default:
      return "Awaiting approval";
  }
}
