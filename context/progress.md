# Progress Tracker

This file is the living status board for the codebase. Whenever any meaningful change is made, log it here under the relevant header.

## To do

- Refactor the largest shared route-shell (`app-shell.tsx`) and any remaining monolithic server-action modules (optional backlog).

## Current Phase

- Foundation roadmap (Phases 1–5) complete; optional structural refactors and E2E smoke next.

## In Progress

- (none)

## Completed

- Replaced the venue text input in the tutor session request dialog (`src/components/tutor/sessions/tutor-request-session-dialog.tsx`) with a select dropdown listing active venues fetched via a new server action `listActiveVenuesFn` in `src/server-actions/tutor-sessions/list-active-venues.ts`. The dropdown preserves existing/custom venue values when resubmitting a session request.
- Implemented a session delete cycle (`deleteCompletedSessions`) in `src/server-actions/session-automation/run-jobs.ts` that soft-deletes `scheduled_sessions` once their linked `session_claims` are fully completed (i.e. status is `APPROVED` and they exist in `payroll_export_claims` junction table). Associated venue unlock requests are cancelled on best-effort basis, and unit tests are colocated in `run-jobs.test.ts`.
- Pushed database migrations to remote Supabase database (`20260606120000_venue_unlock_system.sql` and `20260714120000_fix_missing_venues_access_control.sql`) using `pnpm dlx supabase db push --include-all`.
- Corrected a typo/error in the `20260606120000_venue_unlock_system.sql` migration, changing the non-existent function `public.set_updated_at` to the correct baseline trigger function `public.update_updated_at_column`.
- Migrated all `createServerFn().inputValidator()` calls to `.validator()` across 116 files in the codebase to resolve TanStack Start deprecation warnings.


- Repaired the missing `venues.access_control` schema path with a new migration and compatibility fallbacks in admin venue/schedule loaders plus the venue-unlock helper, so the admin section can render on older databases while the column is being restored.

- Tutor session request dialog now blocks same-day bookings whose selected start time has already passed, auto-shifts the default start time to the next valid slot, and shows inline rejection feedback before submit.

- **Venue unlock system:** migration (`venues.access_control`, `users.can_unlock_venues`, `venue_unlock_requests`, notification enum values); admin `/admin/venues` route + access control on venues; admin user `can_unlock_venues` toggle; schedule sync hooks (materialize + `syncVenueUnlockFromSchedule`); server actions (board, claim, release, tutor ping); lecturer `/lecturer/room-access` master timetable + `/lecturer/notifications`; admin schedules unlock filter; tutor opening badges + "I'm locked out" ping; session automation cron jobs (digest, JIT, urgent, auto-complete); unit tests in `venue-access.test.ts`.

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
- Phase 1 typecheck/workflow cleanup: removed unused `SIGN_AND_APPROVE` lecturer verification path; required `stepUpCode` + `requireStepUpMfa` on `performVerificationActionFn`; added `SessionUser` type and fixed `useSessionUser`; added `normalizeSupabaseNestedRow` helper and normalized Supabase nested joins in schedule/claim/attendance loaders; fixed admin user detail sheet duplicate hero, tutor sessions dialog props, and related import/type issues. `pnpm exec tsc --noEmit` and `pnpm test` (91 tests) pass.
- Phase 2 TanStack Query migration: added `queryKeys.admin.approvals`, `institutions`, `auditLogActors`, and `auditLogs`; migrated `admin/approvals`, `admin/institutions`, and `admin/audit-logs` routes to `use-admin-approvals-data`, `use-admin-institutions-data`, and `use-admin-audit-logs-data` (no route-level `booting`/`loadQueue` fetch lifecycle).
- Phase 3 route-path consistency: expanded [`src/lib/app-paths.ts`](src/lib/app-paths.ts) with nested auth/admin/lecturer/tutor paths; fixed post-auth dashboard targets to TanStack-typed index routes (`/admin`, `/lecturer`, `/tutor`); wired app shells, layout messaging paths, auth redirects, quick actions, and feature navigation through `APP_PATHS`. `pnpm exec tsc --noEmit` and `pnpm test` (91 tests) pass.
- Phase 4 query UX: added shared fetch feedback (`query-fetch-feedback.tsx`, `query-error.ts`, `query-page-gate.tsx`, `query-route-props.ts`); wired loading/blocking error/retry + inline error banners with Try again on admin/lecturer/tutor dashboards, users, sessions, schedules, approvals, institutions, audit logs, verification queue, and lecturer schedule; migrated settings profile load to TanStack Query with blocking error + retry. `pnpm exec tsc --noEmit` and `pnpm test` (91 tests) pass.
- Post–Phase 4 tracker pass: migrated remaining manual-fetch feature views to TanStack Query (`admin` analytics/payroll/reports; `lecturer` analytics/reports/tutors/sessions/attendance; `tutor` earnings) with shared loading/error/retry UX; normalized settings + public nav palette (`text-foreground`, `bg-background`, lagoon/primary tokens). `pnpm exec tsc --noEmit` and `pnpm test` (91 tests) pass.
- Foundation closure pass: auth marketing CSS tokens (`--auth-*`) + `AuthMarketingLayout` for all six `/auth/*` routes; tutor notes → `queryKeys.tutor.notesClaims` + `use-tutor-notes-data` with `PageLoadingSpinner`/`QueryErrorBanner`; messaging conversations load error + retry on admin/lecturer/tutor messaging; split `src/server-actions/settings/` into domain modules with thin barrel (`#/server-actions/settings` unchanged). `pnpm exec tsc --noEmit` and `pnpm test` (91 tests) pass.
- Phase 5 theme + hygiene: auth muted/hero/border tokens + `authFooterClass`/`authMutedClass` on all `/auth/*` routes; dark-mode-safe `user-nav`, `__root`, settings cards (`bg-card`); shared `LazyWhenOpened` + lazy tutor session dialogs (7) and detail sheets (verification, admin users, lecturer sessions/attendance). `pnpm exec tsc --noEmit` and `pnpm test` (91 tests) pass.
- Fixed duplicate sidebar active state: dashboard home (`/lecturer`, `/admin`, `/tutor`) no longer stays highlighted when a sibling nav route (e.g. verification queue) is active (`navItemActive` in `app-shell.tsx`).
- Lecturer messages layout: full-height flex chain (`min-h-0 flex-1`), chat composer pinned to bottom (`ChatWindow` / `ConversationSidebar`), hidden horizontal tab scrollbar (`.no-scrollbar` in `styles.css`).
- Admin analytics page: `ScrollArea` on route (matches lecturer analytics) so KPI cards, charts, and tab panels scroll within the app shell.

## Next up

- Optional: auth E2E smoke on responsive sidebar; lazy-load remaining admin dialogs (e.g. create-user).
- Optional: structural split of `app-shell.tsx` (~411 lines).
- Re-run `pnpm exec tsc --noEmit` after large feature work to catch regressions early.

## Session Notes

- The repository has a solid feature set, but the current focus is stabilizing the foundation.
- TypeScript is exposing real correctness issues in routes, shells, and server actions.
- The app is being standardized around shared documentation for code standards, theme tokens, and progress tracking.
- Centralized color usage to maintain consistency.
- Any future repo-wide change should be reflected here immediately under the most relevant header.
- Foundation consolidation track (Phases 1–5) is closed; no page-level `loadClaims`/`setBooting` list fetches remain on primary tutor/admin/lecturer surfaces.
- Resolved "Invalid server function ID" and "Query data cannot be undefined" errors by performing a clean restart of the dev server, clearing stale Vite compilation caches that arose during the bulk migration of server actions to the new `.validator()` syntax.
- Removed explicit `optimizeDeps.include: ['tslib']` from `vite.config.ts` to fix the dependency optimization warning since `tslib` is a transient dependency and not listed directly in `package.json`.
