# Progress Tracker

This file is the living status board for the codebase. Whenever any meaningful change is made, log it here under the relevant header.

## To do

- Fix the highest-priority TypeScript errors.
- Align route destinations to one canonical path style.
- Refactor the largest shared route-shell and server-action modules.
- Remove one-off hex colors where the central theme already covers the need.

## Current Phase

- Audit and standards consolidation.
- Type safety cleanup.
- Theme and palette normalization.
- Route/path consistency cleanup.

## In Progress

- Consolidating route and redirect path conventions.
- Cleaning up type mismatches and weakly typed auth/session usage.
- Normalizing palette usage across the app.
- Reducing duplicated auth-shell and loading logic.
- Converting remaining `useEffect` fetch pages (e.g. admin approvals) to query/loader patterns.

## Completed

- Created `context/audit.md`.
- Created `context/code-standards.md`.
- Created `context/theme.md`.
- Created `context/progress.md`.
- Added code standards guidance to `AGENTS.md`.
- Added theme guidance to `AGENTS.md`.
- Added progress tracking guidance to `AGENTS.md`.
- Verified `pnpm test` passes.
- Verified `pnpm exec tsc --noEmit` currently fails and captured the failures in the audit.
- Centralized admin, lecturer, and tutor dashboard auth gating through `useDashboardLayoutAccess`.
- Normalized the platform-gate settings redirect to `/settings`.
- Added shared app path constants and routed dashboard/settings navigation through them.
- Replaced the custom user dropdown anchors with router links and typed user props.
- Normalized several lingering route-path variants to the router's typed canonical destinations.
- Refactored `src/routes/__root.tsx` per audit §2.3: typed root session (`root-session.ts`), shell layout helper (`root-shell-layout.ts`), client auth sync hook (`use-root-auth-sync.ts`), and public nav component (`root-public-nav.tsx`).
- Split `src/server-actions/tutor-sessions/index.ts` per audit §2.4 into foundation modules (`constants`, `helpers`, `types`, `mappers`) and one server-fn file per behavior; thin barrel preserves the public API.
- Split `src/server-actions/admin-reports/generate-report.ts` per audit §2.4 into domain builders (`load-report-claims`, `report-build-context`, `build-payroll-reports`, `build-claims-reports`, `build-people-reports`, `build-compliance-reports`, `build-operations-reports`, `build-report`); slim orchestrator (~76 lines); `index.ts` API unchanged.
- Split `src/server-actions/admin-analytics/get-admin-analytics.ts` per audit §2.4 into load/context/build modules (`empty-admin-analytics`, `build-comparison-slice`, `admin-analytics-context`, `load-admin-analytics-data`, `build-admin-kpis-and-trends`, `build-admin-workflow`, `build-admin-tutor-analytics`, `build-admin-module-analytics`, `build-admin-lecturer-analytics`, `build-admin-comparisons`, `build-admin-institution-snapshot`); slim orchestrator (~57 lines); `index.ts` API unchanged.
- Split UI components per audit §2.4: `tutor-sessions-workspace.tsx` (~528-line orchestrator + `use-tutor-sessions-workspace-data.ts`) → helpers, kanban board meta (drop/collision), kanban/table views, and seven dialog modules. Lecturer detail sheets → shared `src/components/lecturer/sheets/` primitives plus verification/session section extracts; fixed `EmptyHint` className on session sheet.
- Implemented audit §3 TanStack Query compliance: added `@tanstack/react-query`, `query-client.ts`, centralized `query-keys.ts`, router SSR query integration (`setupRouterSsrQueryIntegration`), typed root route context (`createRootRouteWithContext`). Replaced manual `useEffect` fetches with query hooks + route loaders on admin/lecturer/tutor dashboards, admin users/sessions/schedules, lecturer verification queue and schedule. Updated messaging, tutor assigned schedule, and tutor sessions workspace hooks to use query cache + invalidation. Auth sign-in/out clears query cache alongside router invalidation.

## Next up

- Keep the audit findings prioritized by impact and effort.
- Continue route-path cleanup until canonical destinations are consistent everywhere.
- Consolidate palette usage so new UI work stays aligned with the defined theme tokens.
- Watch for new typecheck errors while the core cleanup is in flight.

## Session Notes

- The repository has a solid feature set, but the current focus is stabilizing the foundation.
- TypeScript is exposing real correctness issues in routes, shells, and server actions.
- The app is being standardized around shared documentation for code standards, theme tokens, and progress tracking.
- Color usage is being centralized so future UI work stays consistent with the existing palette.
- Any future repo-wide change should be reflected here immediately under the most relevant header.
