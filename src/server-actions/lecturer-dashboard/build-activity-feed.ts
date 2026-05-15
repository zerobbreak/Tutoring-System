import { ACTIVITY_LIMIT } from "./constants";
import { unwrapOne } from "./unwrap";
import type {
  ActivityClaimRow,
  AuditRow,
  DisputeRow,
  LecturerActivityItemDTO,
  NotificationRow,
} from "./types";

export function buildActivityFeed(
  claims: ActivityClaimRow[],
  audits: AuditRow[],
  disputes: DisputeRow[],
  notifications: NotificationRow[],
): LecturerActivityItemDTO[] {
  const items: LecturerActivityItemDTO[] = [];

  for (const n of notifications) {
    const claim = unwrapOne(n.claim);
    const moduleCode = unwrapOne(claim?.module ?? null)?.code;
    items.push({
      id: `notif-${n.id}`,
      at: n.sent_at ?? new Date().toISOString(),
      kind: "NOTIFICATION",
      message: n.subject ?? n.body ?? "New notification",
      moduleCode,
    });
  }

  for (const c of claims) {
    const tutor = unwrapOne(c.tutor);
    const moduleCode = unwrapOne(c.module)?.code;
    const tutorName = tutor?.full_name;
    if (c.submitted_at && c.status === "PENDING_VERIFICATION") {
      items.push({
        id: `submit-${c.id}`,
        at: c.submitted_at,
        kind: "CLAIM_SUBMITTED",
        message: tutorName
          ? `${tutorName} submitted ${moduleCode ?? "a"} session for review.`
          : `Tutor submitted ${moduleCode ?? "a"} session for review.`,
        tutorName,
        moduleCode,
      });
    }
  }

  for (const a of audits) {
    if (a.event !== "STATUS_CHANGED") continue;
    const from = a.payload?.from;
    const to = a.payload?.to;
    items.push({
      id: `audit-${a.id}`,
      at: a.created_at,
      kind: "STATUS_CHANGED",
      message:
        from && to
          ? `Claim status changed from ${from} to ${to}.`
          : "Claim status updated.",
    });
  }

  for (const d of disputes) {
    const claim = unwrapOne(d.claim);
    const moduleCode = unwrapOne(claim?.module ?? null)?.code;
    const tutorName = unwrapOne(claim?.tutor ?? null)?.full_name;
    items.push({
      id: `dispute-${d.id}`,
      at: d.raised_at,
      kind: "DISPUTE_OPENED",
      message: tutorName
        ? `${tutorName} raised an attendance issue on ${moduleCode ?? "a session"}.`
        : `Attendance issue reported on ${moduleCode ?? "a session"}.`,
      tutorName,
      moduleCode,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, ACTIVITY_LIMIT);
}
