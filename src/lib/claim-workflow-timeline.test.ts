import { describe, expect, it } from "vitest";
import {
  buildClaimWorkflowTimeline,
  CLAIM_WORKFLOW_ACTION,
  type WorkflowTimelineEntry,
} from "./claim-workflow-timeline";

const baseStored: WorkflowTimelineEntry[] = [
  {
    id: "va-1",
    claim_id: "claim-1",
    actor_id: "lecturer-1",
    actor: { id: "lecturer-1", full_name: "Lee", email: "lee@example.com" },
    action_type: "APPROVED",
    from_status: "PENDING_VERIFICATION",
    to_status: "VERIFIED",
    comment: null,
    acted_at: "2026-05-20T12:00:00.000Z",
  },
];

describe("buildClaimWorkflowTimeline", () => {
  it("adds synthetic submit when submitted_at exists but no TUTOR_SUBMITTED row", () => {
    const timeline = buildClaimWorkflowTimeline({
      claimId: "claim-1",
      tutorId: "tutor-1",
      tutorActor: { id: "tutor-1", full_name: "Tay", email: "tay@example.com" },
      submittedAt: "2026-05-19T10:00:00.000Z",
      adminCreationApprovedAt: null,
      adminCreationApprover: null,
      isManualSession: false,
      stored: baseStored,
    });

    expect(timeline.some((e) => e.action_type === CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED)).toBe(
      true,
    );
    expect(timeline).toHaveLength(2);
  });

  it("adds synthetic session approval for manual sessions without stored row", () => {
    const timeline = buildClaimWorkflowTimeline({
      claimId: "claim-1",
      tutorId: "tutor-1",
      tutorActor: { id: "tutor-1", full_name: "Tay", email: "tay@example.com" },
      submittedAt: null,
      adminCreationApprovedAt: "2026-05-18T09:00:00.000Z",
      adminCreationApprover: {
        id: "admin-1",
        full_name: "Admin",
        email: "admin@example.com",
      },
      isManualSession: true,
      stored: [],
    });

    expect(
      timeline.some(
        (e) => e.action_type === CLAIM_WORKFLOW_ACTION.SESSION_CREATION_APPROVED,
      ),
    ).toBe(true);
  });

  it("does not duplicate when stored rows already include workflow actions", () => {
    const stored: WorkflowTimelineEntry[] = [
      ...baseStored,
      {
        id: "va-submit",
        claim_id: "claim-1",
        actor_id: "tutor-1",
        actor: { id: "tutor-1", full_name: "Tay", email: "tay@example.com" },
        action_type: CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED,
        from_status: "DRAFT",
        to_status: "PENDING_VERIFICATION",
        comment: null,
        acted_at: "2026-05-19T10:00:00.000Z",
      },
    ];

    const timeline = buildClaimWorkflowTimeline({
      claimId: "claim-1",
      tutorId: "tutor-1",
      tutorActor: { id: "tutor-1", full_name: "Tay", email: "tay@example.com" },
      submittedAt: "2026-05-19T10:00:00.000Z",
      adminCreationApprovedAt: null,
      adminCreationApprover: null,
      isManualSession: false,
      stored,
    });

    const submitCount = timeline.filter(
      (e) => e.action_type === CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED,
    ).length;
    expect(submitCount).toBe(1);
  });
});
