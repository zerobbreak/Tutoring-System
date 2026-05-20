import { describe, expect, it } from "vitest";
import { assertReservedCapacity } from "#/lib/tutor-hour-budget";

describe("approve tutor session request capacity", () => {
  it("blocks when requested hours exceed remaining allocation", () => {
    expect(() =>
      assertReservedCapacity({
        allocatedHours: 10,
        currentReservedHours: 8,
        additionalHours: 4,
        moduleCode: "CS101",
        strict: true,
      }),
    ).toThrow(/Hour allocation exceeded/);
  });

  it("allows when capacity is sufficient", () => {
    expect(() =>
      assertReservedCapacity({
        allocatedHours: 10,
        currentReservedHours: 6,
        additionalHours: 2,
        strict: true,
      }),
    ).not.toThrow();
  });
});
