import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitClaimForVerification } from "./claim-submission";

type Fixtures = {
  claim: Record<string, unknown>;
  evidenceCount?: number;
  scheduled?: { status: string; deleted_at: string | null };
};

/** Minimal Supabase stand-in: answers per table and records writes. */
function fakeDb(fixtures: Fixtures) {
  const updates: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];

  const from = (table: string) => {
    let mode: "select" | "update" | "insert" = "select";
    const result = () => {
      if (table === "session_claims") {
        return mode === "update"
          ? { data: { id: fixtures.claim.id }, error: null }
          : { data: fixtures.claim, error: null };
      }
      if (table === "attendance_evidence") {
        return { count: fixtures.evidenceCount ?? 0, error: null };
      }
      if (table === "scheduled_sessions") {
        return {
          data: fixtures.scheduled ?? { status: "SCHEDULED", deleted_at: null },
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      update: (values: Record<string, unknown>) => {
        mode = "update";
        updates.push(values);
        return builder;
      },
      insert: (values: Record<string, unknown>) => {
        mode = "insert";
        events.push(values);
        return builder;
      },
      maybeSingle: async () => result(),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result()).then(onFulfilled, onRejected),
    };
    return builder;
  };

  return { db: { from } as unknown as SupabaseClient, updates, events };
}

const scheduledDraft = {
  id: "claim-1",
  status: "DRAFT",
  frozen_at: null,
  module_id: "module-1",
  hours: 2,
  session_date: "2026-10-19",
  attendance_present_count: 5,
  topics_covered: "Recursion: base cases and tracing factorial",
  source_scheduled_session_id: "session-1",
  source_schedule_import_id: null,
  admin_creation_approved_at: null,
  request_status: null,
  module: { institution_id: "inst-1" },
};

describe("submitClaimForVerification", () => {
  it("auto mode skips a tutor session request that admin has not approved", async () => {
    const { db, updates } = fakeDb({
      claim: {
        ...scheduledDraft,
        source_scheduled_session_id: null,
        request_status: "PENDING",
      },
    });

    await expect(
      submitClaimForVerification(db, {
        claimId: "claim-1",
        tutorId: "tutor-1",
        mode: { kind: "auto" },
      }),
    ).rejects.toThrow(/awaiting approval/);
    expect(updates).toHaveLength(0);
  });

  it("auto mode skips a claim whose linked session was cancelled", async () => {
    const { db, updates } = fakeDb({
      claim: scheduledDraft,
      scheduled: { status: "CANCELLED", deleted_at: null },
    });

    await expect(
      submitClaimForVerification(db, {
        claimId: "claim-1",
        tutorId: "tutor-1",
        mode: { kind: "auto" },
      }),
    ).rejects.toThrow(/cancelled/);
    expect(updates).toHaveLength(0);
  });

  it.each(["auto", "tutor"] as const)(
    "%s mode refuses a claim with no 'what we covered' notes",
    async (kind) => {
      const attest = vi.fn(async () => {});
      const { db, updates } = fakeDb({
        claim: { ...scheduledDraft, topics_covered: "   " },
      });

      await expect(
        submitClaimForVerification(db, {
          claimId: "claim-1",
          tutorId: "tutor-1",
          mode: kind === "auto" ? { kind } : { kind, attest },
        }),
      ).rejects.toThrow(/what you covered/);
      expect(updates).toHaveLength(0);
      expect(attest).not.toHaveBeenCalled();
    },
  );

  it("auto mode escalates a no-show instead of submitting it normally", async () => {
    const { db, updates, events } = fakeDb({
      claim: { ...scheduledDraft, attendance_present_count: 0 },
      evidenceCount: 1,
    });

    const result = await submitClaimForVerification(db, {
      claimId: "claim-1",
      tutorId: "tutor-1",
      mode: { kind: "auto" },
    });

    expect(result.escalated).toBe(true);
    expect(updates[0]).toMatchObject({ status: "PENDING_VERIFICATION" });
    expect(updates[0].frozen_at).toBeTruthy();
    expect(updates[0].auto_submitted_at).toBeTruthy();
    expect(events[0]).toMatchObject({
      action_type: "NO_SHOW_ESCALATED",
      mfa_confirmed: false,
    });
  });

  it("auto mode records an unattested AUTO_SUBMITTED event", async () => {
    const { db, events } = fakeDb({ claim: scheduledDraft });

    await submitClaimForVerification(db, {
      claimId: "claim-1",
      tutorId: "tutor-1",
      mode: { kind: "auto" },
    });

    expect(events[0]).toMatchObject({
      action_type: "AUTO_SUBMITTED",
      mfa_confirmed: false,
      mfa_method: null,
    });
  });

  it("tutor mode writes nothing when attestation fails", async () => {
    const { db, updates, events } = fakeDb({ claim: scheduledDraft });
    const attest = vi.fn().mockRejectedValue(new Error("Invalid code"));

    await expect(
      submitClaimForVerification(db, {
        claimId: "claim-1",
        tutorId: "tutor-1",
        mode: { kind: "tutor", attest },
      }),
    ).rejects.toThrow("Invalid code");
    expect(updates).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it("tutor mode does not ask for attestation when the claim is ineligible", async () => {
    const { db } = fakeDb({ claim: { ...scheduledDraft, status: "VERIFIED" } });
    const attest = vi.fn().mockResolvedValue(undefined);

    await expect(
      submitClaimForVerification(db, {
        claimId: "claim-1",
        tutorId: "tutor-1",
        mode: { kind: "tutor", attest },
      }),
    ).rejects.toThrow(/Only draft claims/);
    expect(attest).not.toHaveBeenCalled();
  });

  it("tutor mode submits with a TOTP-attested event", async () => {
    const { db, updates, events } = fakeDb({ claim: scheduledDraft });
    const attest = vi.fn().mockResolvedValue(undefined);

    const result = await submitClaimForVerification(db, {
      claimId: "claim-1",
      tutorId: "tutor-1",
      mode: { kind: "tutor", attest },
    });

    expect(result.escalated).toBe(false);
    expect(attest).toHaveBeenCalledOnce();
    expect(updates[0]).not.toHaveProperty("auto_submitted_at");
    expect(events[0]).toMatchObject({
      action_type: "TUTOR_SUBMITTED",
      mfa_confirmed: true,
      mfa_method: "TOTP_STEP_UP",
    });
  });
});
