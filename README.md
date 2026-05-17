# Emeris Tutoring Operations Platform

A full-stack web application for university tutoring operations: official schedules, session claims, lecturer verification, admin approval, payroll export, attendance (including QR check-in), and in-app messaging. Built for institutions that need **compensation transparency** tied to verified academic work—not a payment processor.

| Role | Entry route | Primary responsibilities |
|------|-------------|-------------------------|
| **Admin** | `/admin` | Users, institutions, schedules, approvals, payroll batches, analytics, audit |
| **Lecturer** | `/lecturer` | Verify claims, manage modules/tutors, schedules, attendance |
| **Tutor** | `/tutor` | Deliver sessions, submit claims, track earnings, messaging |
| **Student** | `/student/check-in` | Public QR attendance check-in (no login) |

Staff sign in at `/auth/login`. New staff accounts are created by admins (provisioned credentials) or via **invite-based registration** at `/auth/register`.

---

## Documentation

| Document | Contents |
|----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, routing map, features by dashboard, server-action layout |
| [docs/DATABASE.md](docs/DATABASE.md) | Postgres schema, enums, RLS, storage buckets, migrations |
| [docs/USER_TESTING.md](docs/USER_TESTING.md) | User testing sessions, E2E workflows, per-feature checklists, bug template |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TanStack Router, TanStack Start (SSR) |
| Build | Vite 8, TypeScript |
| Styling | Tailwind CSS 4, Radix UI / shadcn (`src/components/ui/`) |
| Forms & validation | React Hook Form, Zod |
| Backend | Supabase (Postgres, Auth, Storage, Row Level Security) |
| API | TanStack `createServerFn` in `src/server-actions/` |

Business rules live in server actions; **RLS** enforces institution tenancy and role access at the database.

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 10+ ([install](https://pnpm.io/installation); Corepack: `corepack enable` then use the version in `package.json`)
- A **Supabase** project (local via [Supabase CLI](https://supabase.com/docs/guides/cli) or hosted)

---

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment variables

Create `.env.local` in the project root (do not commit secrets):

```env
# Client + server (Vite exposes these to the browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server only — required for admin provisioning, payroll export, invite signup, etc.
# Do NOT prefix with VITE_
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Without `SUPABASE_SERVICE_ROLE_KEY`, privileged flows (user provisioning, registration invites, payroll export, compensation snapshots) will fail with a clear server error.

### 3. Database

Apply migrations to your Supabase database:

```bash
npx supabase db push
```

Or link a remote project and push. Migration files live in `supabase/migrations/`.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server runs on port **3000** by default.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server (port 3000) |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build locally |
| `pnpm test` | Run Vitest unit tests |

---

## Repository layout

```
tutoring_system/
├── docs/                 # ARCHITECTURE.md, DATABASE.md
├── src/
│   ├── routes/           # File-based TanStack Router routes
│   ├── components/       # UI by role (admin/, lecturer/, tutor/, ui/)
│   ├── server-actions/   # Server functions (domain logic)
│   ├── lib/              # Supabase clients, auth, scheduling, money helpers
│   └── routeTree.gen.ts  # Generated route tree (regenerate via dev/build)
├── supabase/migrations/  # SQL schema + RLS
└── package.json
```

**Import alias:** use `#/` for paths under `src/` (e.g. `#/components/ui/button`, `#/server-actions/admin-users`).

---

## Core workflow (claims → payroll)

```text
Session conducted → Attendance captured → Tutor submits claim
  → Lecturer verifies → Admin approves → Included in payroll export
```

- **Claims** track status from `DRAFT` through `PENDING_VERIFICATION`, `VERIFIED`, `APPROVED`, and export linkage.
- **Payroll** (`/admin/payments`) batches approved hours for finance export (CSV); the platform does not move money.
- **Earnings** (`/tutor/earnings`) shows tutors expected compensation from approved hours (default institution rate **R225/hour** ZAR unless overridden per module).

---

## Adding routes

Routes are files under `src/routes/`. TanStack Router generates `src/routeTree.gen.ts` when you run `pnpm dev` or `pnpm build`. After adding a route file, restart dev or build so types and the route tree stay in sync.

Example:

```tsx
// src/routes/tutor/my-page.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tutor/my-page")({
  component: () => <div>My page</div>,
});
```

Use `Link` from `@tanstack/react-router` for in-app navigation.

---

## Testing

```bash
pnpm test
```

Tests use [Vitest](https://vitest.dev/) with Testing Library. Add tests next to the code they cover or under existing test conventions in the repo.

---

## Conventions

Project-specific guidance lives in `.cursor/rules/`:

- **codebase-maintenance** — scope, imports (`#/…`), quality bar
- **avoid-premature-abstraction** — keep logic local until reuse is proven
- **tanstack-server-functions** — patterns for `createServerFn` and Zod validation

---

## License

Private project — see repository owner for usage terms.
