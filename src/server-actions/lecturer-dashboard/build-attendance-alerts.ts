import {
  LOW_ATTENDANCE_MIN_SESSIONS,
  LOW_ATTENDANCE_RATIO,
} from "./constants";
import type {
  AlertClaimRow,
  LecturerAttendanceAlertDTO,
  LecturerModuleDTO,
} from "./types";

export function buildAttendanceAlerts(
  modules: LecturerModuleDTO[],
  alertClaims: AlertClaimRow[],
  evidenceClaimIds: Set<string>,
): LecturerAttendanceAlertDTO[] {
  const alerts: LecturerAttendanceAlertDTO[] = [];
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const ratioByModule = new Map<
    string,
    { sum: number; count: number; code: string }
  >();

  for (const row of alertClaims) {
    const mod = moduleById.get(row.module_id);
    if (!mod) continue;

    const present = row.attendance_present_count;
    const expected = row.attendance_expected_count;
    if (
      present != null &&
      expected != null &&
      expected > 0 &&
      row.status !== "DRAFT"
    ) {
      const prev = ratioByModule.get(row.module_id) ?? {
        sum: 0,
        count: 0,
        code: mod.code,
      };
      prev.sum += present / expected;
      prev.count += 1;
      ratioByModule.set(row.module_id, prev);
    }

    const needsRegister =
      ["PENDING_VERIFICATION", "VERIFIED", "APPROVED"].includes(row.status) &&
      !evidenceClaimIds.has(row.id);
    if (needsRegister) {
      alerts.push({
        id: `missing-${row.id}`,
        severity: "warning",
        kind: "MISSING_REGISTER",
        moduleCode: mod.code,
        message: `Session on ${row.session_date} has no attendance register upload.`,
        claimId: row.id,
      });
    }
  }

  for (const [moduleId, agg] of ratioByModule) {
    if (agg.count < LOW_ATTENDANCE_MIN_SESSIONS) continue;
    const avg = agg.sum / agg.count;
    if (avg < LOW_ATTENDANCE_RATIO) {
      alerts.push({
        id: `low-${moduleId}`,
        severity: "warning",
        kind: "LOW_ATTENDANCE",
        moduleCode: agg.code,
        message: `Low attendance in ${agg.code} (${Math.round(avg * 100)}% average over ${agg.count} sessions).`,
      });
    }
  }

  return alerts.slice(0, 10);
}
