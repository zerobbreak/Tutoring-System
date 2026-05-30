# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project overview

**Emeris Tutoring Operations Platform** — a full-stack app for university tutoring: schedules, session claims, lecturer verification, admin approval, payroll export, attendance (QR check-in), and messaging.

| Layer | Stack |
|-------|-------|
| UI | React 19, TanStack Router, TanStack Start (SSR) |
| Build | Vite 8, TypeScript, pnpm |
| Styling | Tailwind CSS 4, Radix/shadcn (`src/components/ui/`) |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| API | TanStack `createServerFn` in `src/server-actions/` |

**Roles:** `TUTOR` → `/tutor`, `LECTURER` → `/lecturer`, `ADMIN` / `SUPER_ADMIN` → `/admin`. No student login — students use public `/student/check-in`.

Business rules live in server actions; Postgres RLS enforces institution tenancy and role access.

## Environment

Create `.env.local` at the repo root (never commit secrets):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only (no `VITE_` prefix). Required for admin provisioning, invite signup, payroll export, and similar privileged flows.

**Prerequisites:** Node.js 20+, pnpm 10+ (project pins pnpm in `package.json`).

## Key commands

Always use **pnpm** (not npm or yarn):

| Action | Command |
|--------|---------|
| Install deps | `pnpm install` |
| Dev server (port 3000) | `pnpm dev` |
| Production build | `pnpm build` |
| Preview build | `pnpm preview` |
| Unit tests | `pnpm test` |
| Apply DB migrations | `pnpm db:push` |

After adding or renaming route files, run `pnpm dev` or `pnpm build` so `src/routeTree.gen.ts` regenerates.

There is no dedicated lint script — mentally lint touched files before finishing.

## Repository layout

```
src/
├── routes/           # File-based TanStack Router routes (thin — load data, render views)
├── components/       # Feature UI by role (admin/, lecturer/, tutor/) + ui/, messaging/
├── server-actions/   # Domain server functions (one folder per domain)
├── lib/              # Supabase clients, auth helpers, shared business logic
└── routeTree.gen.ts  # Generated — do not edit manually
supabase/migrations/  # SQL schema, enums, RLS
docs/                 # ARCHITECTURE.md, DATABASE.md, USER_TESTING.md
.cursor/rules/        # Persistent coding rules (always read these)
```

**Import alias:** `#/` maps to `src/` (e.g. `#/components/ui/button`, `#/server-actions/admin-users`).

## How to implement changes

### Routes

Routes are thin. Layout routes (`src/routes/admin/route.tsx`, `lecturer/route.tsx`, `tutor/route.tsx`) handle auth, MFA, role gating, and app shells. Page routes load data and render feature components.

```tsx
// src/routes/tutor/my-page.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tutor/my-page")({
  component: MyPage,
});
```

Use `Link` from `@tanstack/react-router` for in-app navigation.

### Server functions

Follow patterns in `.cursor/rules/tanstack-server-functions.mdc`. Review [TanStack Start server functions docs](https://tanstack.com/start/latest/docs/framework/react/server-functions) when unsure.

```ts
export const myFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mySchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    // auth via requireAdminContext, requireLecturerId, requireUserId, etc.
  });
```

- **Location:** `src/server-actions/<domain>/`
- **Validation:** Zod + `.inputValidator()` on all mutations
- **Auth:** `createSupabaseServerClient()` + role-specific `require*()` helpers in `src/lib/`
- **Methods:** `GET` for reads, `POST` for mutations

Mirror the nearest existing module in the same domain folder before inventing new patterns.

### Components

- Reuse `src/components/ui/` primitives before adding new ones.
- Colocate feature UI under `src/components/<role>/<feature>/`.
- Role app shells: `admin-app-shell.tsx`, `lecturer-app-shell.tsx`, `tutor-app-shell.tsx`.

### Database changes

Add SQL migrations under `supabase/migrations/`. Keep client types and server actions in sync with schema changes. See `docs/DATABASE.md` for enums, RLS, and bucket conventions.

## Code conventions

Project rules in `.cursor/rules/` are authoritative. Key points:

**Scope** — Change only what the task requires. Match existing naming, imports, and patterns.

**Avoid premature abstraction** — Keep logic inline in the route or feature component until reuse is proven (2+ call sites, ~200+ unwieldy lines, user request, or established nearby pattern).

**Do not** create thin wrappers, single-use `shared/` helpers, or markdown docs unless asked.

**Types** — Keep accurate; avoid `any` unless surrounding code already does.

## Testing

```bash
pnpm test
```

Vitest + Testing Library. Colocate tests with the code they cover (e.g. `src/lib/foo.test.ts`). Add tests only when requested or when they cover meaningful behavior.

## Boundaries

- **Do not commit** `.env.local`, service role keys, or credentials.
- **Do not edit** `src/routeTree.gen.ts` manually.
- **Do not** bypass RLS with client-side-only checks — enforce auth in server functions and layouts.
- **Do not** add payment processing — payroll is export-only (CSV batches).
- **Do not** create git commits or push unless the user explicitly asks.
- **Do not** add README or docs sections unless the user asks.

## Core workflow (claims → payroll)

```
Session conducted → Attendance captured → Tutor submits claim
  → Lecturer verifies → Admin approves → Payroll export
```

Claim statuses flow through `DRAFT` → `PENDING_VERIFICATION` → `VERIFIED` → `APPROVED`. See `docs/ARCHITECTURE.md` §7 for the full lifecycle.

## Deep reference

| Document | Use when |
|----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Routing map, auth flow, features by dashboard, server-action layout |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, enums, RLS policies, migrations |
| [docs/USER_TESTING.md](docs/USER_TESTING.md) | E2E workflows and feature checklists |
| [README.md](README.md) | Human-oriented setup and product summary |
