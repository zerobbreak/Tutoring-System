import { describe, expect, it } from "vitest";
import {
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
