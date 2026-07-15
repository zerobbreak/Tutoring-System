import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteCompletedSessions } from "./run-jobs";
import { cancelVenueUnlockForSoftDeletedSession } from "#/lib/schedule-sync/effects/venue-unlock";

vi.mock("#/lib/schedule-sync/effects/venue-unlock", () => ({
  cancelVenueUnlockForSoftDeletedSession: vi.fn(),
}));

function createMockSupabaseChain(data: any, error: any = null) {
  const queryChain: any = {
    select: vi.fn().mockImplementation(() => queryChain),
    update: vi.fn().mockImplementation(() => queryChain),
    eq: vi.fn().mockImplementation(() => queryChain),
    is: vi.fn().mockImplementation(() => queryChain),
    not: vi.fn().mockImplementation(() => queryChain),
    in: vi.fn().mockImplementation(() => queryChain),
    then: vi.fn().mockImplementation((callback) => {
      return Promise.resolve(callback({ data, error }));
    }),
  };

  const db = {
    from: vi.fn().mockImplementation(() => queryChain),
  };

  return { db, queryChain };
}

describe("deleteCompletedSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 if no completed sessions are found", async () => {
    const { db } = createMockSupabaseChain([]);
    const count = await deleteCompletedSessions(db as unknown as SupabaseClient);
    expect(count).toBe(0);
    expect(db.from).toHaveBeenCalledWith("session_claims");
  });

  it("should soft-delete sessions and cancel unlock requests for completed claims", async () => {
    const mockClaims = [
      { source_scheduled_session_id: "session-1" },
      { source_scheduled_session_id: "session-2" },
      { source_scheduled_session_id: "session-1" }, // Duplicate check
    ];

    const mockUpdatedSessions = [
      { id: "session-1" },
      { id: "session-2" },
    ];

    // We need different mock data for different calls to `from`.
    // The first call is "session_claims", returning mockClaims.
    // The second call is "scheduled_sessions", returning mockUpdatedSessions.
    const queryChainClaims: any = {
      select: vi.fn().mockImplementation(() => queryChainClaims),
      eq: vi.fn().mockImplementation(() => queryChainClaims),
      is: vi.fn().mockImplementation(() => queryChainClaims),
      not: vi.fn().mockImplementation(() => queryChainClaims),
      then: vi.fn().mockImplementation((callback) => {
        return Promise.resolve(callback({ data: mockClaims, error: null }));
      }),
    };

    const queryChainSessions: any = {
      update: vi.fn().mockImplementation(() => queryChainSessions),
      in: vi.fn().mockImplementation(() => queryChainSessions),
      is: vi.fn().mockImplementation(() => queryChainSessions),
      select: vi.fn().mockImplementation(() => queryChainSessions),
      then: vi.fn().mockImplementation((callback) => {
        return Promise.resolve(callback({ data: mockUpdatedSessions, error: null }));
      }),
    };

    const db = {
      from: vi.fn().mockImplementation((table) => {
        if (table === "session_claims") return queryChainClaims;
        if (table === "scheduled_sessions") return queryChainSessions;
        return queryChainClaims;
      }),
    };

    const count = await deleteCompletedSessions(db as unknown as SupabaseClient);
    expect(count).toBe(2);
    expect(db.from).toHaveBeenCalledWith("session_claims");
    expect(db.from).toHaveBeenCalledWith("scheduled_sessions");
    expect(queryChainSessions.update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      deleted_by: null,
      deletion_reason: "Completed claim processed in payroll",
    });
    expect(queryChainSessions.in).toHaveBeenCalledWith("id", ["session-1", "session-2"]);
    expect(cancelVenueUnlockForSoftDeletedSession).toHaveBeenCalledTimes(2);
    expect(cancelVenueUnlockForSoftDeletedSession).toHaveBeenCalledWith(expect.any(Object), "session-1");
    expect(cancelVenueUnlockForSoftDeletedSession).toHaveBeenCalledWith(expect.any(Object), "session-2");
  });
});
