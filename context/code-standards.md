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

* React
* TanStack Router
* TanStack Query
* TanStack Table
* TanStack Virtual
* TypeScript
* Tailwind CSS
* Zod

## Backend

* Node.js
* Fastify or Express
* Prisma ORM
* PostgreSQL
* Redis (optional)
* JWT Authentication

## Infrastructure

* Docker
* GitHub Actions
* Vercel / Azure / AWS
* Sentry
* OpenTelemetry

---

# 3. Project Structure

```text
src/
│
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
│
├── features/
│   ├── auth/
│   ├── users/
│   ├── events/
│   └── dashboard/
│
├── components/
│   ├── ui/
│   └── shared/
│
├── hooks/
│
├── services/
│
├── lib/
│
├── types/
│
├── utils/
│
└── routes/
```

### Rules

* Organize by feature, not by file type.
* Each feature owns its components, hooks, services, and tests.
* Shared functionality belongs in shared directories.
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

Use centralized query keys.

```typescript
export const userKeys = {
  all: ["users"],
  detail: (id: string) => ["users", id],
};
```

## Query Functions

Keep query functions separate.

```typescript
export async function getUser(id: string) {
  return api.get(`/users/${id}`);
}
```

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
  queryKey: userKeys.all,
});
```

---

# 7. API Layer Standards

Never call fetch directly from components.

Bad:

```typescript
fetch("/api/users")
```

Good:

```typescript
userService.getUsers()
```

### Service Pattern

```typescript
export const userService = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};
```

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

Recommended:

* JWT Access Tokens
* Refresh Tokens

## Authorization

Use:

```typescript
Admin
Student
Tutor
Manager
```

Role-based access control.

## Security Rules

Never:

* Store passwords in plain text
* Store secrets in source code
* Expose private API keys

Always hash passwords using:

```typescript
bcrypt
argon2
```

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

* Utilities
* Hooks
* Services

## Integration Testing

Test:

* API interactions
* Query behavior
* Authentication flows

## E2E Testing

Use:

```text
Playwright
```

Test critical user journeys.

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

Every feature must include:

* Purpose
* Data flow
* API usage
* Permission requirements

Every public service should contain documentation comments.

---

# 21. Environment Configuration

Use:

```text
.env.development
.env.production
.env.test
```

Never commit:

```text
.env
.env.local
```

Store secrets using deployment platform secret management.

---

# 22. Production Readiness Checklist

Before deployment verify:

* TypeScript passes
* Linting passes
* Tests pass
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
