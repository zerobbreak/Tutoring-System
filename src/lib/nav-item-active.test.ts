import { describe, expect, it } from "vitest";
import { APP_PATHS } from "#/lib/app-paths";
import { navItemActive } from "#/lib/nav-item-active";

const adminNavPaths = Object.values(APP_PATHS.admin);
const lecturerNavPaths = Object.values(APP_PATHS.lecturer);
const tutorNavPaths = [
  APP_PATHS.tutor.home,
  APP_PATHS.tutor.sessions,
  APP_PATHS.tutor.claims,
  APP_PATHS.tutor.earnings,
  APP_PATHS.tutor.messaging,
  APP_PATHS.tutor.schedules,
  APP_PATHS.tutor.notes,
  APP_PATHS.tutor.registerGeneration,
] as const;

function activeFor(
  pathname: string,
  homePath: string,
  navPaths: readonly string[],
) {
  return Object.fromEntries(
    navPaths.map((to) => [to, navItemActive(pathname, to, homePath, navPaths)]),
  );
}

describe("navItemActive", () => {
  describe("admin shell", () => {
    const home = APP_PATHS.admin.home;

    it("highlights only dashboard on /admin", () => {
      const active = activeFor("/admin", home, adminNavPaths);
      expect(active[home]).toBe(true);
      expect(active[APP_PATHS.admin.approvals]).toBe(false);
      expect(active[APP_PATHS.admin.users]).toBe(false);
    });

    it("highlights only approvals on /admin/approvals", () => {
      const active = activeFor("/admin/approvals", home, adminNavPaths);
      expect(active[home]).toBe(false);
      expect(active[APP_PATHS.admin.approvals]).toBe(true);
    });

    it("highlights only users on /admin/users", () => {
      const active = activeFor("/admin/users", home, adminNavPaths);
      expect(active[home]).toBe(false);
      expect(active[APP_PATHS.admin.users]).toBe(true);
    });
  });

  describe("lecturer shell", () => {
    const home = APP_PATHS.lecturer.home;

    it("highlights only dashboard on /lecturer", () => {
      const active = activeFor("/lecturer", home, lecturerNavPaths);
      expect(active[home]).toBe(true);
      expect(active[APP_PATHS.lecturer.verificationQueue]).toBe(false);
    });

    it("highlights only verification queue on /lecturer/verification-queue", () => {
      const active = activeFor(
        "/lecturer/verification-queue",
        home,
        lecturerNavPaths,
      );
      expect(active[home]).toBe(false);
      expect(active[APP_PATHS.lecturer.verificationQueue]).toBe(true);
    });
  });

  describe("tutor shell", () => {
    const home = APP_PATHS.tutor.home;

    it("highlights only dashboard on /tutor", () => {
      const active = activeFor("/tutor", home, tutorNavPaths);
      expect(active[home]).toBe(true);
      expect(active[APP_PATHS.tutor.sessions]).toBe(false);
      expect(active[APP_PATHS.tutor.claims]).toBe(false);
    });

    it("highlights only claims on claim detail routes", () => {
      const active = activeFor(
        "/tutor/claims/claim-uuid-123",
        home,
        tutorNavPaths,
      );
      expect(active[home]).toBe(false);
      expect(active[APP_PATHS.tutor.claims]).toBe(true);
      expect(active[APP_PATHS.tutor.sessions]).toBe(false);
    });

    it("highlights only sessions on /tutor/sessions", () => {
      const active = activeFor("/tutor/sessions", home, tutorNavPaths);
      expect(active[home]).toBe(false);
      expect(active[APP_PATHS.tutor.sessions]).toBe(true);
    });
  });
});
