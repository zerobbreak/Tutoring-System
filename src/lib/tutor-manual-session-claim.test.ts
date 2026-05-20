import { describe, expect, it } from "vitest";
import {
  isTutorOwnSessionRequestVisible,
  isTutorSessionClaimListed,
  isTutorSessionClaimVisible,
} from "#/lib/tutor-manual-session-claim";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";

describe("tutor manual session visibility", () => {
  it("hides unapproved manual claims from workspace", () => {
    expect(
      isTutorSessionClaimVisible({
        request_status: SESSION_REQUEST_STATUS.PENDING,
      }),
    ).toBe(false);
  });

  it("shows approved manual claims", () => {
    expect(
      isTutorSessionClaimVisible({
        request_status: SESSION_REQUEST_STATUS.APPROVED,
      }),
    ).toBe(true);
  });

  it("lists pending requests for tutor inbox", () => {
    expect(
      isTutorSessionClaimListed({
        request_status: SESSION_REQUEST_STATUS.PENDING,
      }),
    ).toBe(true);
    expect(isTutorOwnSessionRequestVisible({ request_status: "PENDING" })).toBe(
      true,
    );
  });
});
