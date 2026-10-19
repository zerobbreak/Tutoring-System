@AGENTS.md

# CLAUDE.md

Project memory for Claude Code. `AGENTS.md` (imported above) holds the stack, commands, conventions and boundaries; this file adds the project map, the core domain process, and the gotchas no config file shows. Keep each fact in one place: if `AGENTS.md` already says it, change it there.

## Working process

1. **Orient**: read `context/progress.md` (what's in flight) and the relevant section of `docs/ARCHITECTURE.md` / `docs/DATABASE.md` before touching a domain.
2. **Mirror**: find the nearest sibling module in the same `src/server-actions/<domain>/` or `src/components/<role>/<feature>/` folder and copy its shape.
3. **Implement**: server action (Zod + auth helper) → query key in `src/lib/query-keys.ts` → hook/loader → feature component → thin route.
4. **Verify**: `pnpm exec tsc --noEmit` and `pnpm test` both pass. Restart `pnpm dev` after adding routes or bulk-editing server functions.
5. **Record**: log the change in `context/progress.md` under the right header; delete any scratch files.

## Project map

```
src/
├── router.tsx               # Router + QueryClient + SSR query integration
├── styles.css               # Theme tokens (see context/theme.md)
├── routes/                  # Thin file routes
│   ├── __root.tsx           # Root session, public nav, auth sync
│   ├── auth/                # login, register, mfa, forgot/recover-password, account-blocked
│   ├── admin/ lecturer/ tutor/   # route.tsx = auth + MFA + role gate + app shell
│   ├── settings/            # Shared profile/security (TOTP enrolment)
│   └── student/check-in.tsx # Public QR check-in, no login
├── components/
│   ├── admin|lecturer|tutor/<feature>/   # Feature views, *-view.tsx, use-*-data.ts hooks
│   ├── ui/                  # shadcn primitives (add via `pnpm dlx shadcn@latest add <name>`)
│   ├── messaging/ notifications/ sessions/ workflow/ settings/ auth/
├── server-actions/<domain>/ # ~37 domains, prefixed by role (admin-*, lecturer-*, tutor-*)
│                            # plus shared: messaging, notifications, scheduled-sessions,
│                            # session-automation, venue-unlock, settings, private-session-feedback
└── lib/
    ├── claim-workflow/      # Status transition matrix, guards, execute-transition
    ├── schedule-sync/       # Propagates schedule edits → claims, QR windows, venue unlocks
    ├── schedule-claims/     # Materialise series → scheduled_sessions → draft claims
    ├── job-outbox/          # Background job outbox processor
    ├── *-server.ts          # Auth helpers: requireAdminContext, requireLecturerId, requireStepUpMfa
    ├── supabase-server.ts   # createSupabaseServerClient (RLS-scoped, per request)
    ├── supabase-admin.ts    # getSupabaseAdmin (service role, bypasses RLS, may return null)
    ├── query-keys.ts        # Single source for all TanStack Query keys
    ├── app-paths.ts         # APP_PATHS: canonical route strings for navigation
    └── query-page-gate.tsx, query-error.ts   # Shared loading / error / retry UX
supabase/migrations/         # Baseline schema (squashed) + incremental migrations
scripts/                     # Migration squash/repair helpers
electron/main.mjs            # Optional desktop wrapper loading the dev server (`pnpm electron:dev`)
context/                     # progress.md (status board), audit.md, code-standards.md, theme.md
docs/                        # ARCHITECTURE, DATABASE, USER_TESTING, WORKFLOW_QA
```

## Core process: schedule → claim → payroll

1. **Schedule**: lecturers/admins publish `schedule_series`; `lib/schedule-claims` materialises them into `scheduled_sessions` and draft `session_claims`. Tutors can also request ad-hoc sessions (need admin approval before they become visible) or import their own timetable.
2. **Schedule edits** flow through `lib/schedule-sync` (classify change → sync claims → notify → effects for QR and venue unlock). Route schedule mutations through it so linked claims stay consistent.
3. **Attendance**: tutor opens a QR window; students check in at `/student/check-in`; counts land on the claim.
4. **Claim workflow**: transitions are defined in `src/lib/claim-workflow/transitions.ts` and mirrored by a DB trigger; change both together.
   - `DRAFT → PENDING_VERIFICATION` (tutor) → `VERIFIED` (lecturer) → `APPROVED` (admin).
   - Side branches: `REJECTED` / `DISPUTED` return to `DRAFT` for tutor edits; admin can send `VERIFIED` back to `PENDING_VERIFICATION`.
   - Submit, verify and approve require **step-up TOTP** (`requireStepUpMfa`); test accounts need TOTP enrolled under Settings → Security.
   - Approved claims are frozen (`frozen_at`, compensation snapshot); edits are rejected by both server and DB.
5. **Payroll**: admin exports approved claims as CSV batches (`payroll_export_claims`). Export only, no payments.
6. **Automation**: `server-actions/session-automation/run-jobs.ts` (`runSessionAutomationJobs`) locks ended attendance, refreshes QR tokens, auto-submits eligible claims, sends reminders, repairs draft/schedule mismatches, and soft-deletes sessions whose claims are paid out. Venue-unlock jobs (digest, JIT, urgent) live in `venue-unlock-jobs.ts`.

## Gotchas

- Server functions use **`.validator()`**, not `.inputValidator()` (all ~116 files were migrated). The snippets in `AGENTS.md` and `.cursor/rules/tanstack-server-functions.mdc` still show the old name; follow the code.
- Supabase nested joins can come back as an array or an object; normalise them with `normalizeSupabaseNestedRow` (`lib/supabase-nested-row.ts`).
- `getSupabaseAdmin()` returns `null` when the service key is missing; handle that case and import it only from server modules.
- Deletes are mostly soft (`lib/soft-delete.ts`); filter out soft-deleted rows in new queries.
- "Invalid server function ID" or "Query data cannot be undefined" after bulk server-fn edits means stale Vite caches: restart the dev server.
- `context/code-standards.md` is a generic TanStack guide (mentions Prisma/JWT/Express). This repo's real choices are Supabase Auth + RLS + server functions; where they conflict, `AGENTS.md` and `.cursor/rules/` win.
- Migrations: history before mid-2026 is squashed into `20260513000000_baseline_schema.sql`; the squash scripts in `scripts/` repair remote migration history. Apply with `pnpm db:push` (or `db:push:all` for out-of-order ones).
