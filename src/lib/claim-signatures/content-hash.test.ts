import { describe, expect, it } from "vitest";
import { claimContentHash, type SignedClaimContent } from "./content-hash";

const claim: SignedClaimContent = {
  id: "claim-1",
  tutor_id: "tutor-1",
  module_id: "module-1",
  session_date: "2026-10-12",
  start_time: "14:00:00",
  end_time: "16:00:00",
  hours: "2.00",
  venue: "CR4",
  attendance_present_count: 19,
  attendance_expected_count: 24,
  topics_covered: "Activities and intents",
  student_struggles: "Passing data with intents",
  revision_topics: null,
};

describe("claimContentHash", () => {
  it("is a stable 64-char hex digest regardless of evidence order", async () => {
    const a = await claimContentHash(claim, ["ev-2", "ev-1"]);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await claimContentHash({ ...claim }, ["ev-1", "ev-2"])).toBe(a);
  });

  it("treats numeric and string hours the same", async () => {
    expect(await claimContentHash({ ...claim, hours: 2 }, [])).toBe(
      await claimContentHash(claim, []),
    );
  });

  it("changes when claim content or evidence changes", async () => {
    const base = await claimContentHash(claim, ["ev-1"]);
    expect(await claimContentHash({ ...claim, hours: "2.5" }, ["ev-1"])).not.toBe(base);
    expect(
      await claimContentHash({ ...claim, topics_covered: "Edited" }, ["ev-1"]),
    ).not.toBe(base);
    expect(await claimContentHash(claim, ["ev-1", "ev-3"])).not.toBe(base);
  });
});
