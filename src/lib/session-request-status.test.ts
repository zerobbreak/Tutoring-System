import { describe, expect, it } from "vitest";
import {
  isSessionRequestAwaitingReview,
  isTutorManualRequestInPendingColumn,
  SESSION_REQUEST_STATUS,
} from "#/lib/session-request-status";

describe("isTutorManualRequestInPendingColumn", () => {
  it("routes null request_status manual claims to Pending column", () => {
    expect(isTutorManualRequestInPendingColumn({ request_status: null })).toBe(
      true,
    );
  });

  it("includes rejected manual requests in Pending column", () => {
    expect(
      isTutorManualRequestInPendingColumn({
        request_status: SESSION_REQUEST_STATUS.REJECTED,
      }),
    ).toBe(true);
  });

  it("excludes schedule-linked claims from Pending column", () => {
    expect(
      isTutorManualRequestInPendingColumn({
        request_status: SESSION_REQUEST_STATUS.PENDING,
        source_scheduled_session_id: "sess-1",
      }),
    ).toBe(false);
  });

  it("excludes approved manual claims from Pending column", () => {
    expect(
      isTutorManualRequestInPendingColumn({
        request_status: SESSION_REQUEST_STATUS.APPROVED,
      }),
    ).toBe(false);
  });
});

describe("isSessionRequestAwaitingReview", () => {
  it("keeps a pending request that has not happened yet", () => {
    expect(
      isSessionRequestAwaitingReview({ request_status: "PENDING" }, false),
    ).toBe(true);
  });

  it("drops rejected requests out of the approval lane", () => {
    expect(
      isSessionRequestAwaitingReview({ request_status: "REJECTED" }, false),
    ).toBe(false);
  });

  it("drops requests whose session already ended", () => {
    expect(
      isSessionRequestAwaitingReview({ request_status: "PENDING" }, true),
    ).toBe(false);
  });

  it("ignores schedule-linked claims", () => {
    expect(
      isSessionRequestAwaitingReview(
        { request_status: null, source_scheduled_session_id: "s1" },
        false,
      ),
    ).toBe(false);
  });
});
