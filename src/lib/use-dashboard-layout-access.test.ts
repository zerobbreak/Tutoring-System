import { describe, expect, it } from "vitest";
import { buildDashboardLayoutCurrentPath } from "#/lib/use-dashboard-layout-access";

describe("buildDashboardLayoutCurrentPath", () => {
  it("returns the pathname when search is empty", () => {
    expect(buildDashboardLayoutCurrentPath("/tutor", null)).toBe("/tutor");
  });

  it("builds a query string from a URLSearchParams instance", () => {
    expect(buildDashboardLayoutCurrentPath("/tutor", new URLSearchParams({ returnTo: "/tutor" }))).toBe(
      "/tutor?returnTo=%2Ftutor",
    );
  });

  it("builds a query string from a plain object", () => {
    expect(buildDashboardLayoutCurrentPath("/tutor", { returnTo: "/tutor", tab: "overview" })).toBe(
      "/tutor?returnTo=%2Ftutor&tab=overview",
    );
  });

  it("preserves an existing query string when search is a string", () => {
    expect(buildDashboardLayoutCurrentPath("/tutor", "?tab=overview")).toBe("/tutor?tab=overview");
  });
});
