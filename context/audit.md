# Codebase Audit

Date: 2026-06-01

## 1. Executive Summary

This audit found a generally well-organized TanStack Start app with strong domain separation in `src/server-actions/`, good use of Zod validation in many mutations, and a healthy test suite (`pnpm test` passed: 16 files, 91 tests).

The biggest risks are not around missing features. They are around correctness, consistency, and maintainability:

- Route and redirect paths drift between trailing-slash variants, which is already producing TypeScript errors and makes navigation logic brittle.
- The app relies heavily on manual `useEffect`-driven loading and local state instead of route loaders or a client caching layer, so stale data, repeated fetches, and duplicated loading logic are common.
- Several oversized components and server-action modules are now large enough that weak typing, dead code, and stale casts have started to accumulate.
- The current build is not type-clean. `pnpm exec tsc --noEmit` fails with a broad set of issues across routes, shells, server actions, and workflow helpers.

Summary judgment:

- Maintainability: medium risk
- Correctness: high risk
- Performance: medium risk
- Security and reliability: medium risk
- TanStack alignment: mixed, with good server-action discipline but weak router/cache discipline

## 2. Architecture Findings

### 2.1 Route shells duplicate auth and gate logic

Current dashboard layouts in `src/routes/admin/route.tsx`, `src/routes/lecturer/route.tsx`, and `src/routes/tutor/route.tsx` each repeat the same pattern:

- check authentication
- check MFA state
- check role
- run platform access gate
- render a shell after a local loading state clears

Why this is problematic:

- The same logic must be kept in sync across three files.
- Redirect targets already drift between `/admin`, `/admin/`, `/settings`, and `/settings/`.
- The auth gate is client-side after route entry, so the user sees loading spinners for state that could often be resolved earlier in a loader.

Suggested fix:

- Centralize the shared auth-and-gate sequence in a route-loader or a small layout helper.
- Normalize destinations to one canonical path style throughout the app.
- Move purely presentational shell concerns into `src/components/*-app-shell.tsx` and keep gating in routes.

Affected files:

- `src/routes/admin/route.tsx`
- `src/routes/lecturer/route.tsx`
- `src/routes/tutor/route.tsx`
- `src/lib/apply-platform-gate.ts`
- `src/lib/user-role.ts`

### 2.2 Route-path canonicalization is inconsistent

The codebase mixes trailing-slash and no-trailing-slash route targets:

- `getPostAuthDashboardPath()` returns `/admin/`, `/lecturer/`, `/tutor/`, `/settings/`
- `applyPlatformGate()` redirects to `/settings`
- several routes navigate to `/settings`
- route registration uses both `/admin` and `/admin/` style strings

Why this is problematic:

- TanStack route types reject some of these strings today.
- Small path differences break active-state logic, breadcrumbs, and redirect behavior.
- This already shows up as multiple `tsc` failures in `src/routes/*` and `src/lib/*`.

Suggested fix:

- Choose one canonical route style and apply it everywhere.
- Update route helpers and shell defaults to use that single style.
- Add a small route-path constant module if necessary, but only for canonical destinations, not for generic abstractions.

Affected files:

- `src/lib/user-role.ts`
- `src/lib/apply-platform-gate.ts`
- `src/components/app-shell.tsx`
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/routes/auth/login.tsx`
- `src/routes/auth/mfa.tsx`
- `src/routes/settings/index.tsx`

### 2.3 Root document loader mixes concerns

`src/routes/__root.tsx` loads session data, manages client auth synchronization, decides shell visibility, computes brand routing, and renders the entire document shell.

Why this is problematic:

- The root file is doing document setup, navigation decisions, auth sync, and page chrome selection all at once.
- The loader/session logic is difficult to reason about and uses `any` for session state.
- The file is a likely long-term hotspot for bugs because it sits on the boundary between SSR, client auth, and router invalidation.

Suggested fix:

- Keep the root route focused on document structure and session bootstrap only.
- Move shell-selection logic into a smaller helper.
- Replace `any` session state with a typed session object or `null`.

Affected file:

- `src/routes/__root.tsx`

### 2.4 Large feature modules have become mini-apps

Several modules are now large enough to justify deeper internal structure:

- `src/components/tutor/sessions/tutor-sessions-workspace.tsx`
- `src/server-actions/tutor-sessions/index.ts`
- `src/server-actions/admin-analytics/get-admin-analytics.ts`
- `src/server-actions/admin-reports/generate-report.ts`
- `src/components/lecturer/verification/verification-claim-detail-sheet.tsx`
- `src/components/lecturer/sessions/lecturer-session-detail-sheet.tsx`

Why this is problematic:

- Large mixed-concern files are harder to test and review.
- They encourage stale casts, unreachable branches, and duplicated helper logic.
- They make later extraction more expensive because the boundary is no longer obvious.

Suggested fix:

- Split by behavior, not by arbitrary helper count.
- Keep route-local helpers near the route until reuse exists in 2+ real call sites.
- Split server-action modules by domain subfeature when a file becomes a grab bag of unrelated reads and mutations.

Affected files:

- `src/components/tutor/sessions/tutor-sessions-workspace.tsx`
- `src/server-actions/tutor-sessions/index.ts`
- `src/server-actions/admin-analytics/get-admin-analytics.ts`
- `src/server-actions/admin-reports/generate-report.ts`
- `src/components/lecturer/verification/verification-claim-detail-sheet.tsx`
- `src/components/lecturer/sessions/lecturer-session-detail-sheet.tsx`

## 3. TanStack Compliance Findings

### 3.1 TanStack Query is not actually in use

`package.json` does not include `@tanstack/react-query`, and the app does not use query hooks or a query cache layer. Data loading is mostly done with:

- route loaders for a few pages
- `createServerFn()` calls inside `useEffect`
- local `useState` plus manual refresh functions

Why this matters:

- There is no shared cache, deduplication, stale-time strategy, or invalidation model for client-fetched data.
- Repeated navigation between pages often retriggers the same fetch logic.
- UI state and server data are mixed together in route components, which makes consistency and refresh behavior harder to predict.

Recommended TanStack approach:

- Use route loaders for page-level SSR-safe data where the route owns the page state.
- Use TanStack Query for reusable client data, background refresh, and mutation invalidation.
- Keep server actions as the source of truth, but let the cache manage re-fetching and invalidation.

Suggested fix:

- Introduce query hooks only where repeated fetch/invalidation is already happening.
- Use route loader data for initial page payloads where the route already owns the screen.
- Invalidate the relevant query keys after mutations instead of manually reloading whole pages.

Affected files:

- `package.json`
- `src/routes/admin/index.tsx`
- `src/routes/lecturer/index.tsx`
- `src/routes/tutor/index.tsx`
- `src/routes/admin/users.tsx`
- `src/routes/admin/sessions.tsx`
- `src/routes/admin/schedules.tsx`
- `src/routes/lecturer/verification-queue.tsx`
- `src/routes/lecturer/schedule.tsx`
- `src/routes/tutor/sessions.tsx`
- `src/components/messaging/use-messaging-page.ts`
- `src/components/tutor/schedules/use-tutor-assigned-schedule.ts`

### 3.2 Data fetching is often happening in `useEffect` instead of route loaders

Many pages fetch data after mount and then manage `booting`, `loading`, `loadError`, and cancellation flags manually.

Why this is problematic:

- It duplicates the same loading lifecycle across many routes.
- It delays content rendering until after client mount, even when the route could know the data earlier.
- It increases the chance of race conditions when filters, searches, or route params change.

Recommended TanStack approach:

- Prefer route loaders for data that belongs to the route.
- Use route search params as loader inputs for filterable views.
- Reserve `useEffect` for truly client-only effects, not for the main data lifecycle of a page.

Suggested fix:

- Convert the highest-traffic dashboard and list pages to loader-driven data where practical.
- For client-driven pages, move fetch logic into dedicated hooks that are easy to test.

Affected files:

- `src/routes/admin/index.tsx`
- `src/routes/lecturer/index.tsx`
- `src/routes/tutor/index.tsx`
- `src/routes/admin/users.tsx`
- `src/routes/admin/sessions.tsx`
- `src/routes/admin/schedules.tsx`
- `src/routes/admin/approvals.tsx`
- `src/routes/lecturer/verification-queue.tsx`
- `src/routes/lecturer/schedule.tsx`
- `src/routes/tutor/sessions.tsx`

### 3.3 Query invalidation is effectively manual today

There is no shared client invalidation strategy. After mutations, pages often call a local reload function or rely on a router invalidation, and some screens do not clearly refresh related data at all.

Why this is problematic:

- Related views can drift out of sync after a mutation.
- Reload behavior is inconsistent between dashboards.
- The app has no standard answer for "what should refresh after this write?"

Suggested fix:

- Define clear invalidation boundaries per domain.
- Centralize refresh after write operations around route-level data or query keys, not ad hoc callbacks.
- Use router invalidation sparingly and only for true route-loader dependencies.

Affected files:

- `src/routes/auth/login.tsx`
- `src/routes/auth/mfa.tsx`
- `src/routes/__root.tsx`
- `src/components/admin/dashboard/admin-dashboard-view.tsx`
- `src/components/admin/sessions/admin-sessions-view.tsx`
- `src/components/messaging/use-messaging-page.ts`

### 3.4 Route organization is mostly good, but some routes are acting like state containers

The file-based route structure is clean in general, but some route files now contain significant business state, filtering, and data orchestration.

Why this is problematic:

- Route files should stay thin.
- Heavy route files become hard to scan and test.
- The boundary between route concern and feature concern is blurred.

Suggested fix:

- Keep routes as loaders + navigation + render stubs.
- Move feature state into feature components or feature hooks.

Affected files:

- `src/routes/admin/index.tsx`
- `src/routes/lecturer/index.tsx`
- `src/routes/tutor/index.tsx`
- `src/routes/admin/users.tsx`
- `src/routes/admin/sessions.tsx`
- `src/routes/admin/schedules.tsx`

## 4. Code Quality Findings

### 4.1 Typecheck is failing in multiple real areas

The current `tsc` output surfaced concrete issues, including:

- invalid prop names passed to components
- incorrect route destinations
- missing DTO fields
- stale imports and unused variables
- unsafe casts between Supabase row shapes and DTOs
- workflow enum mismatches

Why this is problematic:

- These are not cosmetic issues. They indicate broken assumptions in code paths that are meant to be reliable.
- Several of the failures are in shared or high-traffic modules, which raises the blast radius.

Suggested fix:

- Prioritize type-cleaning shared modules and route shells before touching cosmetic refactors.
- Replace shape casts with explicit mapping where data comes from Supabase.
- Remove dead imports and stale branches as you touch each file.

Representative affected files:

- `src/components/admin/sessions/admin-sessions-view.tsx`
- `src/components/app-shell.tsx`
- `src/routes/__root.tsx`
- `src/routes/admin/index.tsx`
- `src/routes/admin/route.tsx`
- `src/routes/auth/login.tsx`
- `src/routes/auth/mfa.tsx`
- `src/routes/index.tsx`
- `src/routes/lecturer/route.tsx`
- `src/routes/settings/index.tsx`
- `src/lib/apply-platform-gate.ts`
- `src/lib/claim-workflow/execute-transition.ts`
- `src/server-actions/lecturer-verification/perform-verification-action.ts`
- `src/server-actions/admin-institutions/get-institution-management.ts`

### 4.2 Oversized files are mixing too many concerns

Examples include:

- `src/components/tutor/sessions/tutor-sessions-workspace.tsx`
- `src/server-actions/tutor-sessions/index.ts`
- `src/components/lecturer/sessions/lecturer-session-detail-sheet.tsx`
- `src/components/lecturer/verification/verification-claim-detail-sheet.tsx`
- `src/components/admin/users/admin-user-detail-sheet.tsx`

Why this is problematic:

- Hard to navigate and hard to review.
- Hard to isolate tests.
- Higher chance of accidental coupling between unrelated UI sections.

Suggested fix:

- Split large files by user flow or panel, not by tiny helper granularity.
- Extract only when there is clear reuse or a clear readability payoff.

### 4.3 Repeated logic exists in several route families

Repeated patterns:

- auth loading and redirect handling
- `booting` + `loadError` + `load` async state
- search debounce with local timers
- sheet open/close state synchronized to URL search params

Why this is problematic:

- The same bugs will reappear in multiple places.
- Future feature work requires editing many files for one behavior change.

Suggested fix:

- Extract only the parts with real reuse, such as search-param sheet syncing or common fetch state.
- Keep one-off feature logic local when extraction would create a generic abstraction too early.

### 4.4 Weak typing and `any` usage still leaks into user-facing code

Examples:

- `src/routes/__root.tsx` uses `any` for session state.
- `src/components/user-nav.tsx` accepts `user: any`.
- `src/routes/auth/login.tsx` catches `error: any`.

Why this is problematic:

- These are key auth and navigation paths where weak typing hides real mistakes.
- The `any` values make it easier for UI and route assumptions to drift from Supabase reality.

Suggested fix:

- Replace `any` with explicit Supabase session/user types.
- Prefer `unknown` in catch blocks and narrow by shape.

### 4.5 Dead code and stale imports are already visible

Typecheck flagged unused imports and variables in:

- `src/components/lecturer/schedule/lecturer-schedule-view.tsx`
- `src/components/lecturer/schedule/schedule-series-lists.tsx`
- `src/components/lecturer/tutors/lecturer-tutors-view.tsx`
- `src/routes/tutor/index.tsx`
- `src/server-actions/admin-approvals/types.ts`
- `src/server-actions/session-automation/run-jobs.ts`
- `src/server-actions/settings/index.ts`

Why this is problematic:

- It is usually a sign that nearby logic has drifted or was partially refactored.
- It makes the active code path harder to reason about.

Suggested fix:

- Remove the dead code when touching the file.
- If the unused symbol points to missing behavior, decide whether the behavior should be restored or removed.

## 5. Component Structure Recommendations

### Recommended target structure

```text
src/
├── features/
│   ├── admin/
│   ├── lecturer/
│   ├── tutor/
│   ├── messaging/
│   ├── settings/
│   └── auth/
├── components/
│   ├── ui/
│   └── shared/
├── hooks/
├── lib/
├── server-actions/
├── contexts/
├── types/
└── utils/
```

### What to move or colocate

- Keep feature-specific UI in the nearest feature folder, especially for tutor sessions, lecturer verification, admin users, and messaging.
- Centralize truly shared UI primitives in `src/components/ui/`.
- Move reusable feature shells and repeated panels into `src/features/<domain>/components/` only when there are real multiple consumers.
- Keep route-local one-off sections inside the route until they clearly warrant extraction.

### Concrete recommendations

- Move the messaging view pieces into a `src/features/messaging/` grouping if they are shared across admin, lecturer, and tutor routes.
- Consider splitting the giant tutor sessions workspace into a feature folder with subcomponents for kanban, evidence, attendance, and claim submission.
- Keep dashboard KPI cards and action panels together within each dashboard domain unless they are already used in multiple dashboards.

### Components that should be split or reorganized

- `src/components/tutor/sessions/tutor-sessions-workspace.tsx`
- `src/components/admin/users/admin-user-detail-sheet.tsx`
- `src/components/lecturer/sessions/lecturer-session-detail-sheet.tsx`
- `src/components/lecturer/verification/verification-claim-detail-sheet.tsx`
- `src/components/admin/dashboard/admin-dashboard-view.tsx`

## 6. Hook Structure Recommendations

### 6.1 Hooks doing too much

Current examples:

- `src/components/messaging/use-messaging-page.ts`
- `src/components/tutor/schedules/use-tutor-assigned-schedule.ts`

Why this is problematic:

- They mix loading, state initialization, subscriptions, refresh logic, and event handling in one place.
- They are difficult to reuse because the hook shape is already tied to a specific page flow.

Suggested fix:

- Split by responsibility where there is clear benefit:
  - data loading
  - realtime subscription
  - selection state
  - mutation handlers
- Keep the final exported hook named for the page or feature it serves, not for a generic utility abstraction.

### 6.2 Missing query hooks and mutation hooks

Because TanStack Query is absent, the app lacks standard query/mutation hooks for common data flows.

Why this is problematic:

- The same fetch and refresh logic gets reimplemented per page.
- Mutation side effects are inconsistent.

Suggested fix:

- Introduce query hooks for repeated client data only where there is clear reuse.
- Introduce mutation hooks where a mutation has a repeated invalidation or optimistic-update pattern.

### 6.3 Duplicate hook patterns

Examples:

- `useEffect` fetch on mount
- local debounced search
- URL search-param sync for detail sheets
- manual cancel flags

Suggested organization:

- Name hooks after feature intent, for example `useMessagingPage`, `useTutorAssignedSchedule`, `useAdminUsersSearchState`.
- Avoid creating a generic hook if it would only wrap one file.

### 6.4 Hook naming conventions

- Page-level hooks: `use<Feature>Page`
- Data hooks: `use<Feature>Data`
- Selection/search hooks: `use<Feature>Filters`
- Realtime hooks: `use<Feature>Subscription`
- Mutation hooks: `use<Feature>Mutation`

## 7. UI/UX Findings

### 7.1 Several pages rely on loading spinners without richer fallback states

Observed pattern:

- Many dashboard pages render a centered spinner during boot.
- Some detail sheets show a loading state, but error and empty states are inconsistent.

User impact:

- Users cannot tell whether a page is slow, empty, or broken.
- Long-loading pages feel less trustworthy and less responsive.

Suggested improvement:

- Add route-specific skeletons or progressive placeholders where the user expects structured content.
- Keep the spinner for short waits, but use richer skeletons for dashboard and list pages.

Affected files:

- `src/routes/admin/index.tsx`
- `src/routes/lecturer/index.tsx`
- `src/routes/tutor/index.tsx`
- `src/routes/admin/users.tsx`
- `src/routes/lecturer/verification-queue.tsx`

### 7.2 Error states are inconsistent and sometimes swallowed

Observed pattern:

- Several loaders catch and return `null` or silently keep current state.
- Some catch blocks suppress errors without user-visible fallback.

User impact:

- A failed fetch can look like an empty screen or stale content.
- Users do not get enough feedback to retry or recover.

Suggested improvement:

- Show explicit error banners with retry actions where data is critical.
- Only swallow errors when the previous state is intentionally valid and clearly communicated.

Affected files:

- `src/routes/settings/index.tsx`
- `src/components/messaging/use-messaging-page.ts`
- `src/routes/admin/index.tsx`
- `src/routes/lecturer/index.tsx`
- `src/routes/tutor/index.tsx`

### 7.3 Navigation flow is confusing in a few places

Observed issues:

- Route targets are inconsistent across canonical and trailing-slash variants.
- Some links are rendered as plain anchors where `Link` would preserve client-side navigation.
- `src/components/user-nav.tsx` uses `href` for dashboard/settings navigation.

User impact:

- Full page reloads where SPA navigation is expected.
- Potentially broken active states and breadcrumb logic.
- Users can land on routes that are technically valid but inconsistent with the rest of the app.

Suggested improvement:

- Use `Link` for in-app navigation consistently.
- Normalize route targets and active-state matching.

Affected files:

- `src/components/user-nav.tsx`
- `src/components/app-shell.tsx`
- `src/components/admin-app-shell.tsx`
- `src/components/lecturer-app-shell.tsx`
- `src/components/tutor-app-shell.tsx`

### 7.4 Accessibility could be improved in some custom controls

Observed patterns:

- Custom dropdown and profile menus rely on bespoke markup in a few places.
- Some custom loading-only controls lack explicit labels or fallback text.
- Some forms do not consistently surface validation feedback beyond the first failing field.

User impact:

- Keyboard and screen-reader behavior may be less predictable than with standard primitives.
- Error recovery is slower when feedback is too subtle.

Suggested improvement:

- Prefer shared Radix/shadcn primitives for menus, dialogs, and form controls.
- Make sure every actionable form has field-level errors and a visible submit-state message.

Affected files:

- `src/components/user-nav.tsx`
- `src/components/app-shell.tsx`
- `src/routes/auth/login.tsx`
- `src/routes/auth/mfa.tsx`
- `src/routes/auth/register.tsx`

### 7.5 Mobile responsiveness is decent but shell complexity is high

Observed pattern:

- The app shells are responsive, but they contain a lot of conditional layout behavior.
- Some pages are dense on smaller screens and would benefit from more deliberate stacking and progressive disclosure.

Suggested improvement:

- Test the main dashboards on narrow widths and reduce information density where needed.
- Prefer collapsible panels or stacked summaries on small screens.

## 8. Performance Findings

### 8.1 Manual fetch-on-mount patterns can re-run often

Observed pattern:

- Dashboard pages and list pages fetch on mount and whenever local state changes.
- There is no cache deduplication layer.

Performance impact:

- More repeated network calls.
- More state churn when navigating between sibling pages.

Suggested improvement:

- Add route loaders or query caching for repeatable payloads.
- Use stale-time and invalidation rules for shared data.

### 8.2 Some modules are large enough to increase render and parse cost

Observed modules:

- `src/components/tutor/sessions/tutor-sessions-workspace.tsx`
- `src/server-actions/tutor-sessions/index.ts`
- `src/components/lecturer/sessions/lecturer-session-detail-sheet.tsx`
- `src/components/lecturer/verification/verification-claim-detail-sheet.tsx`

Performance impact:

- Bigger modules are slower to parse and harder to tree-shake.
- Large components tend to re-render more than necessary because unrelated state lives nearby.

Suggested improvement:

- Split heavy feature modules by functional area.
- Keep unrelated state in separate child components.

### 8.3 Missing lazy loading and code splitting opportunities

Observed pattern:

- Several feature routes and their large component trees load eagerly.
- This is acceptable for core dashboards, but some secondary flows could be lazy-loaded.

Performance impact:

- Larger initial JS payloads.
- Slower first interaction on lower-end devices.

Suggested improvement:

- Lazy-load rarely used dialogs, sheets, or secondary routes.
- Use route-level code splitting where the path is not part of the main daily workflow.

### 8.4 Potential list rendering hotspots

Observed pattern:

- Admin, lecturer, tutor, and messaging screens render large lists and tables.
- Some lists are fully controlled by local state with no virtualization.

Performance impact:

- Large list pages may become expensive as data grows.

Suggested improvement:

- Add virtualization only where the list size justifies it.
- Avoid premature virtualization on small, stable lists.

### 8.5 No clear N+1 was confirmed statically, but several server actions fan out heavily

Observed pattern:

- Some server actions use multiple sequential Supabase reads and transforms.
- This is not automatically an N+1 bug, but it is a place to watch for repeated lookups and shape conversions.

Suggested improvement:

- Profile the heaviest server actions before refactoring.
- Prefer single joined queries or explicit data maps where possible.

Affected files:

- `src/server-actions/admin-dashboard/get-dashboard-data.ts`
- `src/server-actions/admin-reports/generate-report.ts`
- `src/server-actions/lecturer-analytics/get-lecturer-analytics.ts`
- `src/server-actions/tutor-sessions/index.ts`

## 9. Security Findings

### 9.1 Client-side gating duplicates server-side trust boundaries

Observed pattern:

- The app has client-side role gating and redirect logic in route layouts.
- Server actions still enforce permissions, which is good, but the UI layer also makes security decisions.

Security impact:

- Client-side checks are not a security boundary.
- They are useful for UX, but they can hide the need for stronger server enforcement.

Suggested improvement:

- Keep the server as the authority for access control.
- Use client gating only to improve the experience after server-side enforcement.

Affected files:

- `src/routes/admin/route.tsx`
- `src/routes/lecturer/route.tsx`
- `src/routes/tutor/route.tsx`
- `src/lib/apply-platform-gate.ts`

### 9.2 Weak typing can hide unsafe assumptions on auth/session objects

Observed pattern:

- `src/components/user-nav.tsx` and `src/routes/__root.tsx` treat user/session objects loosely.

Security impact:

- Incorrect assumptions about available claims or metadata can lead to wrong redirects or access labels.

Suggested improvement:

- Type auth/session objects explicitly.
- Narrow untrusted shapes before using them in navigation or display logic.

### 9.3 Some error handling swallows operational failures

Observed pattern:

- Several catch blocks intentionally keep previous state or redirect away without visible detail.

Security/reliability impact:

- Operational failures become harder to detect.
- Silent fallback can mask broken data flows.

Suggested improvement:

- Log server errors where appropriate.
- Show a clear, user-safe message when the state is incomplete or invalid.

### 9.4 Workflow transition code has mismatch risk

Observed issues:

- `src/lib/claim-workflow/execute-transition.ts` imports `assertTransitionAllowed` from `./guards`, but `guards.ts` does not export it.
- `src/server-actions/lecturer-verification/perform-verification-action.ts` references `SIGN_AND_APPROVE` in its action schema and map, but the related workflow types are inconsistent.

Security/reliability impact:

- Workflow state transitions are central business logic.
- Mismatches here can create invalid claim states or prevent expected approvals.

Suggested improvement:

- Align transition enums, action maps, and server action inputs in one place.
- Add focused tests for every allowed state transition.

## 10. Prioritized Action Plan

### High Priority Issues

1. Normalize route paths and redirects across the app
   - Impact: very high
   - Effort: low to medium
   - Why: already causing type errors and navigation drift.

2. Fix the typecheck blockers in shared and workflow-critical files
   - Impact: very high
   - Effort: medium
   - Why: several files currently do not type-check, including routing, shells, and claim workflow code.

3. Repair claim workflow enum and transition mismatches
   - Impact: very high
   - Effort: medium
   - Why: these are core business rules for verification and approval.

4. Replace weakly typed auth/session state with explicit types
   - Impact: high
   - Effort: low to medium
   - Why: auth and redirect behavior depends on these objects.

### Medium Priority Issues

1. Move repeated fetch-on-mount logic into route loaders or query hooks
   - Impact: medium to high
   - Effort: medium
   - Why: reduces duplication and improves consistency.

2. Split oversized components and server-action modules
   - Impact: medium
   - Effort: medium to high
   - Why: improves readability and lowers future maintenance cost.

3. Add consistent loading, empty, and error states to the main list and dashboard screens
   - Impact: medium
   - Effort: medium
   - Why: improves trust and usability.

4. Standardize navigation to use `Link` for in-app transitions
   - Impact: medium
   - Effort: low
   - Why: reduces full reloads and keeps SPA behavior predictable.

### Low Priority Issues

1. Remove unused imports and stale local variables as files are touched
   - Impact: low
   - Effort: low
   - Why: incremental cleanup with immediate hygiene value.

2. Tighten custom control accessibility details
   - Impact: low to medium
   - Effort: low to medium
   - Why: important, but less urgent than broken types and route drift.

3. Evaluate lazy-loading for secondary dialogs and long-tail flows
   - Impact: low to medium
   - Effort: medium
   - Why: useful once core correctness work is done.

### Quick Wins

1. Fix the obvious route target typos and canonical slash mismatches.
2. Remove unused imports and variables reported by `tsc`.
3. Replace `any` in `src/components/user-nav.tsx` and `src/routes/__root.tsx`.
4. Convert internal anchor tags to `Link` where the destination is in-app.
5. Add explicit error banners to the pages that currently only show spinners.

### Refactoring Opportunities

1. Extract a small shared auth-gate helper for dashboard layouts.
2. Break up `src/server-actions/tutor-sessions/index.ts` into submodules by feature.
3. Split the tutor sessions workspace into smaller feature components.
4. Move repetitive sheet/state sync patterns into small feature hooks only where they are genuinely reused.

### Architecture Improvements

1. Introduce a canonical route-path module or equivalent constants so redirects and nav targets cannot drift.
2. Add a real client cache/invalidation strategy for repeat data flows, either by adopting TanStack Query where it fits or by using loader-driven route data more consistently.
3. Make route loaders the default for page-owned data, reserving `useEffect` for client-only concerns.
4. Keep server actions as the authoritative business layer, but make their DTOs and row mappings explicit instead of relying on casts.

## Verification Notes

- `pnpm test` passed.
- `pnpm exec tsc --noEmit` failed with multiple current type errors across routes, shells, server actions, and workflow logic.
- TanStack Query is not present in `package.json`, so caching/invalidation recommendations above are based on the current absence of a query layer.

