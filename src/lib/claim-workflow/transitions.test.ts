import { describe, expect, it } from "vitest";
import {
  assertTransitionAllowed,
  isTransitionAllowed,
  TUTOR_EDITABLE_STATUSES,
} from "./transitions";
import { assertTutorCanEditClaim } from "./guards";

describe("claim workflow transitions", () => {
  it("allows tutor submit", () => {
    expect(
      isTransitionAllowed("DRAFT", "PENDING_VERIFICATION", "TUTOR"),
    ).toBe(true);
  });

  it("allows tutor reopen from rejected", () => {
    expect(isTransitionAllowed("REJECTED", "DRAFT", "TUTOR")).toBe(true);
  });

  it("blocks tutor direct approve", () => {
    expect(isTransitionAllowed("VERIFIED", "APPROVED", "TUTOR")).toBe(false);
  });

  it("allows lecturer verify from pending", () => {
    expect(
      isTransitionAllowed("PENDING_VERIFICATION", "VERIFIED", "LECTURER"),
    ).toBe(true);
  });

  it("blocks lecturer skip to approved", () => {
    expect(
      isTransitionAllowed("PENDING_VERIFICATION", "APPROVED", "LECTURER"),
    ).toBe(false);
  });

  it("allows admin approve from verified", () => {
    expect(isTransitionAllowed("VERIFIED", "APPROVED", "ADMIN")).toBe(true);
    expect(isTransitionAllowed("VERIFIED", "APPROVED", "SUPER_ADMIN")).toBe(
      true,
    );
  });

  it("throws on invalid transition", () => {
    expect(() =>
      assertTransitionAllowed("DRAFT", "APPROVED", "TUTOR"),
    ).toThrow(/Cannot change claim status/);
  });
});

describe("tutor edit guards", () => {
  it("allows draft and rejected", () => {
    for (const status of TUTOR_EDITABLE_STATUSES) {
      expect(() =>
        assertTutorCanEditClaim(status, null, "edit"),
      ).not.toThrow();
    }
  });

  it("blocks pending verification", () => {
    expect(() =>
      assertTutorCanEditClaim("PENDING_VERIFICATION", null, "edit"),
    ).toThrow(/cannot be edit/);
  });

  it("blocks when frozen", () => {
    expect(() =>
      assertTutorCanEditClaim("DRAFT", "2026-01-01T00:00:00Z", "edit"),
    ).toThrow(/frozen/);
  });
});
