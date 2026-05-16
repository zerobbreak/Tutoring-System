import type { AdminApprovalTimelineStageDTO } from "./types";

type TimelineAction = {
  id: string;
  action_type: string;
  to_status: string | null;
  acted_at: string;
  comment: string | null;
  actor: { full_name: string } | null;
};

export function buildWorkflowStages(
  submittedAt: string | null,
  status: string,
  timeline: TimelineAction[],
  payrollExportedAt: string | null,
  payrollPeriodLabel: string | null,
): AdminApprovalTimelineStageDTO[] {
  const stages: AdminApprovalTimelineStageDTO[] = [];

  if (submittedAt) {
    stages.push({
      id: "stage-submitted",
      stage: "TUTOR_SUBMITTED",
      label: "Tutor submitted",
      at: submittedAt,
    });
  }

  const lecturerStep = timeline.find(
    (t) => t.action_type === "APPROVED" && t.to_status === "VERIFIED",
  );
  if (
    lecturerStep ||
    status === "VERIFIED" ||
    status === "APPROVED" ||
    status === "DISPUTED"
  ) {
    stages.push({
      id: "stage-lecturer-verified",
      stage: "LECTURER_VERIFIED",
      label: "Lecturer verified",
      at: lecturerStep?.acted_at ?? submittedAt ?? new Date().toISOString(),
      detail: lecturerStep?.actor?.full_name
        ? `By ${lecturerStep.actor.full_name}`
        : undefined,
    });
  }

  const adminStep = timeline.find((t) => t.action_type === "ADMIN_APPROVED");
  if (status === "APPROVED" || adminStep) {
    stages.push({
      id: "stage-admin-approved",
      stage: "ADMIN_APPROVED",
      label: "Admin approved",
      at: adminStep?.acted_at ?? new Date().toISOString(),
      detail: adminStep?.actor?.full_name
        ? `By ${adminStep.actor.full_name}`
        : undefined,
    });
  }

  if (payrollExportedAt) {
    stages.push({
      id: "stage-payroll",
      stage: "PAYROLL_EXPORTED",
      label: "Payroll exported",
      at: payrollExportedAt,
      detail: payrollPeriodLabel ?? undefined,
    });
  }

  return stages.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export function enrichDetailWithStages<
  T extends {
    submitted_at: string | null;
    status: string;
    timeline: Array<{
      id: string;
      action_type: string;
      to_status: string | null;
      acted_at: string;
      comment: string | null;
      actor: { full_name: string; email: string } | null;
    }>;
  },
>(
  detail: T,
  payrollExportedAt: string | null,
  payrollPeriodLabel: string | null,
) {
  const workflow_stages = buildWorkflowStages(
    detail.submitted_at,
    detail.status,
    detail.timeline.map((t) => ({
      id: t.id,
      action_type: t.action_type,
      to_status: t.to_status,
      acted_at: t.acted_at,
      comment: t.comment,
      actor: t.actor,
    })),
    payrollExportedAt,
    payrollPeriodLabel,
  );

  return {
    ...detail,
    payroll_exported_at: payrollExportedAt,
    payroll_period_label: payrollPeriodLabel,
    workflow_stages,
  };
}
