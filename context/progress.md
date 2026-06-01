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
- Shared dashboard layout auth gating extracted into a single hook.

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
