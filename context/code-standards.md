# TanStack Full-Stack Development Standards & Best Practices

## Purpose

This document defines the coding standards, architectural principles, and development practices for building scalable, maintainable, secure, and high-performance full-stack applications using the TanStack ecosystem.

---

# 1. Core Principles

Every feature must follow these principles:

* Keep components small and focused.
* Prefer composition over inheritance.
* Maintain strict type safety.
* Avoid duplicated business logic.
* Write predictable and testable code.
* Keep UI, business logic, and data access separated.
* Follow a feature-first architecture.
* Favor readability over clever code.

---

# 2. Recommended Technology Stack

## Frontend

* React 19
* TanStack Router + TanStack Start (SSR)
* TanStack Query
* TypeScript
* Tailwind CSS 4 + shadcn/Radix (`src/components/ui/`)
* React Hook Form + Zod

## Backend

* TanStack Start server functions (`createServerFn`) in `src/server-actions/<domain>/`
* Supabase: Postgres, Auth, Storage, Realtime
* Row Level Security (RLS) for tenancy and role access
* SQL migrations in `supabase/migrations/`

## Tooling

* Vite, pnpm, Vitest + Testing Library
* Electron wrapper (`electron/main.mjs`) for an optional desktop shell

---

# 3. Project Structure

```text
src/
│
├── routes/                       # Thin file routes; role layouts in <role>/route.tsx
├── components/
│   ├── <role>/<feature>/         # admin | lecturer | tutor feature views + use-*-data hooks
│   ├── ui/                       # shadcn primitives
│   └── messaging/, notifications/, sessions/, ...   # cross-role features
├── server-actions/<domain>/      # Server functions per domain
├── lib/                          # Supabase clients, auth helpers, query keys, shared business logic
└── hooks/                        # Generic hooks only (e.g. use-mobile)
```

### Rules

* Organize by role and feature, not by file type.
* A feature folder owns its views, data hooks, dialogs, and tests.
* Shared business logic goes in `src/lib/` only once it has two or more callers.
* Avoid deeply nested folders.

---

# 4. TypeScript Standards

## Strict Mode

Always enable:

```json
{
  "strict": true
}
```

## Avoid

```typescript
any
```

Use:

```typescript
unknown
```

or explicit interfaces.

## Prefer Interfaces

```typescript
interface User {
  id: string;
  name: string;
}
```

Avoid unnecessary type aliases for object structures.

## Export Types Separately

```typescript
export interface User {}
export type UserRole = "Admin" | "Student";
```

---

# 5. TanStack Router Standards

## Route Organization

Each route should own:

```text
routes/
└── users/
    ├── index.tsx
    ├── create.tsx
    └── $userId.tsx
```

## Load Data Through Route Loaders

Preferred:

```typescript
loader: async () => {
  return queryClient.ensureQueryData(...)
}
```

Avoid loading everything inside components.

## Route Parameters

Always validate route params.

```typescript
validateSearch: z.object({
  page: z.number().default(1)
})
```

---

# 6. TanStack Query Standards

## Query Keys

All query keys live in `src/lib/query-keys.ts`, grouped by role.

```typescript
export const queryKeys = {
  admin: {
    all: ["admin"] as const,
    users: (filters: { category: AdminUserCategory; search?: string }) =>
      ["admin", "users", filters] as const,
  },
};
```

## Query Functions

Query functions call server functions; data hooks sit beside the feature (`use-<feature>-data.ts`).

```typescript
useQuery({
  queryKey: queryKeys.admin.users(filters),
  queryFn: () => listAdminUsersFn({ data: filters }),
});
```

Use the shared loading/error UX in `src/lib/query-page-gate.tsx` and `src/lib/query-error.ts`.

## Cache Management

Configure:

```typescript
staleTime: 1000 * 60 * 5
```

when possible.

Avoid excessive refetching.

## Mutations

Always invalidate relevant queries.

```typescript
queryClient.invalidateQueries({
  queryKey: queryKeys.admin.all,
});
```

---

# 7. Server Function Standards

Components get data only through server functions in `src/server-actions/<domain>/`, never through `fetch` or a direct Supabase client call.

```typescript
export const myFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => mySchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    // auth via requireAdminContext, requireLecturerId, requireUserId, ...
  });
```

* `GET` for reads, `POST` for mutations.
* Validate every input with Zod.
* One server function per file when a domain grows; the folder's `index.ts` re-exports the public API.

---

# 8. State Management

## Use Server State for Server Data

Use:

* TanStack Query

Avoid storing API data in:

* useState
* Context API

## Use Local State Only For

* Modals
* Form inputs
* UI toggles
* Temporary interactions

---

# 9. Form Standards

Use:

* React Hook Form
* Zod

Validation example:

```typescript
const schema = z.object({
  email: z.email(),
});
```

Validate:

* Frontend
* Backend

Never trust client-side validation alone.

---

# 10. Authentication Standards

## Authentication

* Supabase Auth owns sessions and password hashing; never handle raw passwords or tokens yourself.
* TOTP MFA is enforced in the role layouts, and claim submit/verify/approve require step-up TOTP (`requireStepUpMfa`).

## Authorization

Roles: `TUTOR`, `LECTURER`, `ADMIN`, `SUPER_ADMIN`. Students have no accounts and use the public `/student/check-in` route.

* Enforce access in server functions (`require*()` helpers in `src/lib/`) and in Postgres RLS. Client-side checks are only for UX.
* The service-role client (`getSupabaseAdmin()`) bypasses RLS; use it only in server code for privileged flows, after an explicit role check.

## Security Rules

* Keep secrets in `.env.local`; only `VITE_`-prefixed values may reach the browser.
* Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.

---

# 11. Database Standards

## Naming Conventions

Tables:

```text
users
events
sessions
```

Columns:

```text
first_name
created_at
updated_at
```

## Primary Keys

Use:

```typescript
uuid
```

instead of incremental IDs.

## Auditing

All entities should contain:

```text
id
created_at
updated_at
created_by
```

---

# 12. Error Handling

Create centralized error handlers.

Example:

```typescript
try {
  ...
} catch (error) {
  logger.error(error);
}
```

Never swallow exceptions.

Always return meaningful error messages.

---

# 13. Logging Standards

Log:

* Authentication attempts
* Errors
* Database failures
* Critical business events

Do not log:

* Passwords
* Tokens
* Secrets
* Personal sensitive data

---

# 14. Component Standards

## Component Size

Target:

* Under 200 lines

Split large components.

## Naming

```typescript
UserCard.tsx
EventTable.tsx
CreateUserDialog.tsx
```

Use PascalCase.

## Hooks

Prefix custom hooks with:

```typescript
use
```

Example:

```typescript
useUsers()
useAuth()
useEvents()
```

---

# 15. Performance Standards

## Memoization

Use:

```typescript
useMemo
useCallback
```

only when profiling indicates a benefit.

Avoid premature optimization.

## Virtualization

For large datasets:

```typescript
TanStack Virtual
```

## Code Splitting

Use lazy loading for:

* Large pages
* Admin areas
* Dashboards

---

# 16. Testing Standards

## Unit Testing

Use:

```text
Vitest
```

Test:

* Business logic in `src/lib/` (claim transitions, schedule materialisation, conflicts)
* Server-action helpers with clear inputs and outputs
* Hooks with meaningful behaviour

Colocate tests as `*.test.ts` beside the code and run them with `pnpm test`.

## E2E Testing

No automated E2E suite yet. Walk critical journeys manually using `docs/USER_TESTING.md` and `docs/WORKFLOW_QA.md`.

---

# 17. Git Standards

## Branch Naming

```text
feature/user-management
feature/authentication

bugfix/login-error

hotfix/security-patch
```

## Commit Format

```text
feat: add user management

fix: resolve auth bug

refactor: simplify query logic

docs: update README
```

Follow Conventional Commits.

---

# 18. Code Review Standards

Every pull request must verify:

* Type safety
* Security
* Error handling
* Test coverage
* Accessibility
* Performance impact
* Maintainability

No direct commits to production branches.

---

# 19. Accessibility Standards

Every page must support:

* Keyboard navigation
* Screen readers
* Semantic HTML
* Proper labels
* Focus management

Use:

```typescript
aria-label
```

where necessary.

---

# 20. Documentation Standards

* Add a short doc comment to exported server functions and non-obvious business rules.
* Add markdown docs or README sections only when asked; record meaningful changes in `context/progress.md`.

---

# 21. Environment Configuration

Use a single `.env.local` at the repo root (git-ignored via `*.local`):

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Never commit `.env` or `.env.local`. Store production secrets in the deployment platform's secret manager.

---

# 22. Production Readiness Checklist

Before deployment verify:

* `pnpm exec tsc --noEmit` passes (there is no lint script)
* `pnpm test` passes
* No console logs
* Environment variables configured
* Monitoring enabled
* Error tracking enabled
* Database migrations tested
* Security review completed
* Documentation updated

---

# Conclusion

A TanStack full-stack application should prioritize type safety, modular architecture, performance, maintainability, and security. Following these standards ensures that applications remain scalable, easy to maintain, and consistent across development teams.
