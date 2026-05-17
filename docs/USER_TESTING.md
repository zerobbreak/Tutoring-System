# User testing guide

How to plan, run, and record user testing for the **Emeris Tutoring Operations Platform**. Use this doc to test **one feature at a time** or to walk through **end-to-end workflows** across roles.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) (routes and features), [DATABASE.md](./DATABASE.md) (data model), [README.md](../README.md) (local setup).

---

## Table of contents

1. [Goals and scope](#1-goals-and-scope)
2. [Test environment setup](#2-test-environment-setup)
3. [Test participants and accounts](#3-test-participants-and-accounts)
4. [Running a test session](#4-running-a-test-session)
5. [Recording results](#5-recording-results)
6. [End-to-end workflows](#6-end-to-end-workflows)
7. [Feature checklists](#7-feature-checklists)
8. [Known gaps (skip or note)](#8-known-gaps-skip-or-note)
9. [Bug report template](#9-bug-report-template)

---

## 1. Goals and scope

### What user testing should validate

| Category | Examples |
|----------|----------|
| **Task completion** | Can a tutor submit a claim? Can a lecturer verify it? |
| **Clarity** | Are labels, statuses, and next steps obvious without training? |
| **Errors & edge cases** | Wrong password, blocked account, missing evidence, duplicate check-in |
| **Role boundaries** | Tutors cannot approve payroll; students cannot access dashboards |
| **Cross-role flows** | Schedule → session → attendance → claim → verify → approve |

### Out of scope (unless explicitly testing)

- Automated unit tests (`pnpm test`) — run separately in CI
- Load/performance testing
- Payment processing (platform exports payroll data; it is not a payment gateway)

### Roles in the app

| Role | Dashboard | Primary tester persona |
|------|-----------|------------------------|
| **Admin** / **Super Admin** | `/admin` | Finance / operations lead |
| **Lecturer** | `/lecturer` | Module coordinator |
| **Tutor** | `/tutor` | Session tutor |
| **Student** | *(no login)* | Uses `/student/check-in` only |

Staff use `/auth/login`. There is no student account type.

---

## 2. Test environment setup

### Prerequisites

- Node 20+, pnpm 10+
- Supabase project with migrations applied (`npx supabase db push`)
- `.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (required for invites, provisioning, payroll export)

### Start the app

```bash
pnpm install
pnpm dev
```

Open **http://localhost:3000** (port 3000 by default).

### Test data checklist

Before feature testing, confirm the institution has:

- [ ] At least one **campus** and **academic term**
- [ ] At least one **module** with a lecturer assignment
- [ ] At least one **tutor** assigned to that module
- [ ] Optional: **students** in the directory (for roster and QR check-in)
- [ ] Optional: a **published** schedule series with upcoming `scheduled_sessions`

Record institution name, module codes, and test user emails in your session notes (see [§5](#5-recording-results)).

---

## 3. Test participants and accounts

### Recommended minimum set

| Account | Role | Used for |
|---------|------|----------|
| `admin@…` | ADMIN | Users, schedules, approvals, institutions |
| `lecturer@…` | LECTURER | Verification, schedule, attendance |
| `tutor@…` | TUTOR | Sessions, claims, QR, imports |
| *(none)* | Student | Public check-in only |

Create accounts via **Admin → Users** (provision) or **invite registration** at `/auth/register`. For MFA tests, enable MFA on a dedicated account.

### Account states to cover

| State | How to test |
|-------|-------------|
| Active, approved | Default happy path |
| Pending onboarding | User awaiting document review in `/settings` |
| Blocked | `/auth/account-blocked` after block action |
| MFA enrolled | Login → `/auth/mfa` challenge |

---

## 4. Running a test session

### Session plan (copy per round)

| Field | Value |
|-------|-------|
| **Date** | |
| **Build / branch / commit** | |
| **Environment** | Local / staging / production |
| **Facilitator** | |
| **Participant(s)** | Role(s) |
| **Features under test** | e.g. “Tutor sessions Kanban”, “Lecturer verification queue” |
| **Duration** | ~30–60 min per focused feature; 90+ min for E2E |

### Facilitator script (short)

1. State the **goal** (“Submit a session claim with attendance evidence”).
2. Give **no step-by-step** unless the participant is stuck for 2+ minutes.
3. Ask **think-aloud** questions: “What do you expect this button to do?”
4. Note **severity**: blocker / major / minor / cosmetic.
5. Capture **screenshots or screen recording** for failures.

### Per-feature test flow

1. Pick one checklist from [§7](#7-feature-checklists).
2. Log in as the correct role.
3. Walk through every **Pass criteria** row; mark Pass / Fail / Skip / N/A.
4. File bugs using [§9](#9-bug-report-template).
5. If Fail on a blocker, stop the dependent E2E path until fixed.

---

## 5. Recording results

Use a spreadsheet or issue tracker with these columns:

| Column | Description |
|--------|-------------|
| `Test ID` | e.g. `TUT-SES-03` (prefix by role, see checklists) |
| `Feature` | Nav label or route |
| `Scenario` | Short task description |
| `Result` | Pass / Fail / Skip / Blocked |
| `Severity` | Blocker / Major / Minor / Cosmetic |
| `Notes` | What happened, quotes, confusion |
| `Issue link` | GitHub issue or ticket ID |
| `Tester` | Name |
| `Date` | |

### Sign-off per feature

A feature is **signed off** when:

- All **Pass criteria** rows are Pass (or documented Skip with reason)
- No open **Blocker** or **Major** issues for that feature
- At least one participant matching the **target persona** completed the tasks without facilitator hints

### Sign-off per release

- [ ] All P0 E2E paths in [§6](#6-end-to-end-workflows) Pass
- [ ] Each implemented sidebar route has a completed checklist section
- [ ] Placeholder routes documented in [§8](#8-known-gaps-skip-or-note)

---

## 6. End-to-end workflows

Run these after individual feature passes, or as dedicated 90-minute sessions.

### E2E-1: Official schedule → claim → payroll readiness

| Step | Actor | Action | Pass if |
|------|-------|--------|---------|
| 1 | Lecturer or Admin | Create draft series, assign tutor/venue, publish | Sessions appear on calendar |
| 2 | Tutor | See session on dashboard or `/tutor/sessions` | Upcoming session visible |
| 3 | Tutor | Run session: QR and/or register evidence | Attendance captured |
| 4 | Tutor | Submit claim from draft → pending verification | Status updates in Kanban/table |
| 5 | Lecturer | Verify in verification queue | Status = verified |
| 6 | Admin | Approve in approvals; optional payroll export | Status = approved / export succeeds |

**Test IDs:** `E2E-1`

### E2E-2: Tutor timetable import → claim

| Step | Actor | Action | Pass if |
|------|-------|--------|---------|
| 1 | Tutor | Import Excel on `/tutor/schedules` | Import saved; events visible |
| 2 | Tutor | Link or create claim from import | Claim exists |
| 3 | Lecturer | Verify claim | Same as E2E-1 steps 5–6 |

**Test IDs:** `E2E-2`

### E2E-3: Student QR check-in

| Step | Actor | Action | Pass if |
|------|-------|--------|---------|
| 1 | Tutor | Open QR for a session | QR/link works |
| 2 | Student | Open `/student/check-in?token=…` (no login) | Form loads |
| 3 | Student | Submit name / student number | Success message; row on lecturer attendance |

**Test IDs:** `E2E-3`

### E2E-4: Dispute and messaging

| Step | Actor | Action | Pass if |
|------|-------|--------|---------|
| 1 | Lecturer | Dispute or reject a pending claim | Status reflects dispute/rejection |
| 2 | Tutor | Open messaging; reply in workflow thread | Message delivered; realtime update |
| 3 | Lecturer | Resolve via verification or thread | Claim reaches expected terminal state |

**Test IDs:** `E2E-4`

### E2E-5: New staff onboarding

| Step | Actor | Action | Pass if |
|------|-------|--------|---------|
| 1 | Admin | Send invite / provision user | Invite or credentials received |
| 2 | Tutor/Lecturer | Register or first login; upload onboarding docs | `/settings` shows pending state |
| 3 | Admin | Approve onboarding in users | User reaches dashboard |

**Test IDs:** `E2E-5`

---

## 7. Feature checklists

Mark each row: **P** Pass · **F** Fail · **S** Skip · **N/A**

Priority key: **P0** = release blocker · **P1** = important · **P2** = nice to have

---

### 7.1 Auth and account security

**Routes:** `/auth/login`, `/auth/register`, `/auth/mfa`, `/auth/forgot-password`, `/auth/recover-password`, `/auth/account-blocked`

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| AUTH-01 | P0 | Login with valid credentials | Redirects to role dashboard |
| AUTH-02 | P0 | Login with wrong password | Clear error; no dashboard access |
| AUTH-03 | P1 | Forgot password flow | Email/step completes without crash |
| AUTH-04 | P1 | Recover password (from link) | New password works on next login |
| AUTH-05 | P1 | Register via valid invite | Account created; pending or active per policy |
| AUTH-06 | P1 | Register with invalid/expired invite | Clear rejection |
| AUTH-07 | P1 | MFA challenge after login | Second factor required; success reaches dashboard |
| AUTH-08 | P1 | Blocked user login | Lands on account-blocked page |
| AUTH-09 | P2 | Logout / session end | Must sign in again to access dashboards |

---

### 7.2 Settings (all staff)

**Route:** `/settings`

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| SET-01 | P0 | Update profile (name, contact) | Saves and persists on reload |
| SET-02 | P1 | Change password / security | Works or shows expected restriction |
| SET-03 | P1 | Notification preferences | Saves correctly |
| SET-04 | P1 | Upload onboarding documents | Files appear; admin can review |
| SET-05 | P1 | Pending approval user | Cannot access role dashboard until approved |

---

### 7.3 Admin — Dashboard (`/admin`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-DASH-01 | P1 | Load dashboard | KPIs and feed render without error |
| ADM-DASH-02 | P2 | Quick actions / deadlines | Links navigate to correct pages |

---

### 7.4 Admin — Approvals (`/admin/approvals`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-APP-01 | P0 | List verified claims | Table loads; filters work |
| ADM-APP-02 | P0 | Approve claim | Status → approved |
| ADM-APP-03 | P0 | Reject claim (if available) | Status updates; tutor sees change |
| ADM-APP-04 | P1 | Payroll export | File downloads or clear success; no silent failure |

---

### 7.5 Admin — Institutions (`/admin/institutions`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-INST-01 | P1 | View institution profile | Data matches database |
| ADM-INST-02 | P1 | Add/edit campus | Persists after reload |
| ADM-INST-03 | P1 | Add/edit academic term | Persists; date validation sensible |
| ADM-INST-04 | P1 | Add/edit module | Module available for scheduling/assignments |

---

### 7.6 Admin — Users (`/admin/users`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-USR-01 | P0 | List users | Correct roles and statuses |
| ADM-USR-02 | P0 | Provision new user | User can log in |
| ADM-USR-03 | P1 | Send invite | Invite link works for registration |
| ADM-USR-04 | P1 | Review onboarding documents | Approve/reject updates user access |
| ADM-USR-05 | P2 | MFA reset | User can re-enroll MFA |

---

### 7.7 Admin — Schedules (`/admin/schedules`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-SCH-01 | P0 | View institution calendar | Events visible for published series |
| ADM-SCH-02 | P0 | Create draft series | Appears as draft |
| ADM-SCH-03 | P0 | Publish series | Sessions materialize; tutor sees them |
| ADM-SCH-04 | P1 | Conflict detection | Conflicts shown before bad publish |
| ADM-SCH-05 | P1 | Archive / delete draft | State matches action; no orphan crashes |
| ADM-SCH-06 | P1 | Review schedule change requests | Approve/deny updates calendar |

---

### 7.8 Admin — Sessions (`/admin/sessions`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-SES-01 | P1 | Browse sessions list | Filters and pagination work |
| ADM-SES-02 | P1 | Open session detail sheet | Evidence, disputes, timeline visible |

---

### 7.9 Admin — Messaging (`/admin/messaging`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-MSG-01 | P1 | List conversations | Loads for institution |
| ADM-MSG-02 | P1 | Send message | Appears in thread; tutor/lecturer receives |
| ADM-MSG-03 | P2 | Institution notice (if used) | Delivered to intended audience |

---

### 7.10 Admin — Analytics & audit

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-AN-01 | P2 | Analytics page | Tables/charts load |
| ADM-AUD-01 | P1 | Audit logs | Filterable feed; recent actions appear |

---

### 7.11 Lecturer — Dashboard (`/lecturer`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-DASH-01 | P1 | Pending verification table | Matches queue data |
| LEC-DASH-02 | P2 | Activity feed / weekly sessions | Readable and accurate |

---

### 7.12 Lecturer — Verification queue (`/lecturer/verification-queue`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-VER-01 | P0 | Open pending claim detail | Evidence and attendance visible |
| LEC-VER-02 | P0 | Verify claim | Status → verified; admin can approve |
| LEC-VER-03 | P0 | Reject claim | Tutor sees rejection |
| LEC-VER-04 | P1 | Dispute claim | Status disputed; messaging/workflow usable |

---

### 7.13 Lecturer — Schedule (`/lecturer/schedule`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-SCH-01 | P0 | Calendar views (month/week/day/agenda) | Switch without errors |
| LEC-SCH-02 | P0 | Create and publish series | Tutor sees official sessions |
| LEC-SCH-03 | P1 | Archive published series | Upcoming sessions cancelled/archived as expected |
| LEC-SCH-04 | P1 | Delete draft series | Removed from calendar |
| LEC-SCH-05 | P1 | Handle change requests | Reschedule reflected on calendar |

---

### 7.14 Lecturer — Sessions (`/lecturer/sessions`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-SES-01 | P1 | List module sessions | Cancelled sessions distinguished |
| LEC-SES-02 | P1 | Open detail sheet | Link to verification works |

---

### 7.15 Lecturer — Tutors (`/lecturer/tutors`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-TUT-01 | P0 | Assign tutor to module | Tutor sees assignments |
| LEC-TUT-02 | P1 | Remove assignment | Tutor loses access to module sessions |
| LEC-TUT-03 | P2 | Invite tutor | Invite flow completes |

---

### 7.16 Lecturer — Attendance (`/lecturer/attendance`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-ATT-01 | P1 | KPIs and live snapshot | Reflects recent check-ins |
| LEC-ATT-02 | P1 | Integrity issues list | Flags mismatches or missing evidence |

---

### 7.17 Lecturer — Messages, analytics, reports

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| LEC-MSG-01 | P1 | Workflow thread on claim | Send/receive with tutor |
| LEC-AN-01 | P2 | Analytics charts | Load without error |
| LEC-RPT-01 | P1 | Generate report export | JSON/CSV/XLSX/PDF downloads open correctly |

---

### 7.18 Tutor — Dashboard (`/tutor`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-DASH-01 | P1 | Stats and upcoming sessions | Match schedule data |
| TUT-DASH-02 | P2 | Notifications preview | Links to relevant pages |

---

### 7.19 Tutor — Sessions workspace (`/tutor/sessions`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-SES-01 | P0 | Kanban columns (today / upcoming / completed / pending) | Cards in correct columns |
| TUT-SES-02 | P0 | Open session detail | Module, time, roster visible |
| TUT-SES-03 | P0 | Upload attendance evidence | File attached; lecturer can view |
| TUT-SES-04 | P0 | Generate QR for check-in | Student URL works (see E2E-3) |
| TUT-SES-05 | P1 | Submit claim | Moves to pending verification |
| TUT-SES-06 | P1 | Drag-reschedule (if enabled) | Time updates without data loss |
| TUT-SES-07 | P2 | Filters | Narrow list correctly |

---

### 7.20 Tutor — Claims (`/tutor/claims`, `/tutor/claims/$claimId`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-CLM-01 | P0 | Claims table sort/filter | Status colors/labels clear |
| TUT-CLM-02 | P1 | Claim detail page | Full history and actions visible |

---

### 7.21 Tutor — Schedules import (`/tutor/schedules`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-SCH-01 | P1 | Upload valid Excel timetable | Parsed events shown |
| TUT-SCH-02 | P1 | Invalid file | Clear error |
| TUT-SCH-03 | P1 | Link import to claim | Claim created or matched |

---

### 7.22 Tutor — Register generation (`/tutor/register-generation`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-REG-01 | P1 | Live register during session | Check-ins update in UI |
| TUT-REG-02 | P2 | Export register | Download usable for records |

---

### 7.23 Tutor — Notes (`/tutor/notes`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-NOT-01 | P2 | Add topics / examples / struggles | Saves on claim |
| TUT-NOT-02 | P2 | Reload page | Notes persist |

---

### 7.24 Tutor — Messaging & help

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-MSG-01 | P1 | Message lecturer | Realtime or refresh shows reply |
| TUT-HELP-01 | P2 | Help page | Content readable; links valid |

---

### 7.25 Tutor — Earnings (`/tutor/earnings`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| TUT-EAR-01 | P1 | View earnings summary | Amounts align with approved claims |
| TUT-EAR-02 | P2 | Filters / date range | Results update correctly |

---

### 7.26 Student — Check-in (`/student/check-in`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| STU-CHK-01 | P0 | Valid token/session params | Form loads on mobile and desktop |
| STU-CHK-02 | P0 | Successful check-in | Confirmation shown |
| STU-CHK-03 | P1 | Duplicate check-in | Handled gracefully |
| STU-CHK-04 | P1 | Invalid/expired token | Clear error; no data leak |

---

## 8. Known gaps (skip or note)

Mark **Skip** with reason `Not implemented` for placeholder routes:

| Route | Status |
|-------|--------|
| `/admin/settings` | Placeholder UI (use global `/settings` instead) |

**Admin reports** (`/admin/reports`) and **payroll** (`/admin/payments`) are implemented — use checklist section 7.10a below.

### 7.10a Admin — Reports (`/admin/reports`)

| ID | Priority | Scenario | Pass criteria |
|----|----------|----------|---------------|
| ADM-RPT-01 | P0 | Payroll reconciliation | Preview loads; export CSV/PDF |
| ADM-RPT-02 | P0 | Payroll batch detail | Select batch; line items match export |
| ADM-RPT-03 | P0 | Admin approval queue | VERIFIED claims listed |
| ADM-RPT-04 | P1 | Institution approved hours | Hours match approvals |
| ADM-RPT-05 | P1 | Claims pipeline snapshot | Status buckets sum sensibly |
| ADM-RPT-06 | P1 | Audit log export | Events in date range export |
| ADM-RPT-07 | P2 | Onboarding status | Staff list matches Users page |

---

## 9. Bug report template

Copy into GitHub Issues or your tracker:

```markdown
## Summary
One sentence: what went wrong?

## Test ID
e.g. LEC-VER-02, E2E-1 step 5

## Environment
- URL: (local/staging/prod)
- Commit/branch:
- Browser/device:

## Role
Admin / Lecturer / Tutor / Student (check-in)

## Steps to reproduce
1.
2.
3.

## Expected result


## Actual result


## Severity
- [ ] Blocker — cannot complete workflow
- [ ] Major — workaround exists but painful
- [ ] Minor — cosmetic or edge case
- [ ] Cosmetic

## Screenshots / recording
(attach)

## Extra context
(module code, claim ID, approximate time)
```

---

## Quick reference: routes by role

| Admin | Lecturer | Tutor | Public |
|-------|----------|-------|--------|
| `/admin` | `/lecturer` | `/tutor` | `/student/check-in` |
| `/admin/approvals` | `/lecturer/verification-queue` | `/tutor/sessions` | `/auth/login` |
| `/admin/institutions` | `/lecturer/schedule` | `/tutor/claims` | `/auth/register` |
| `/admin/users` | `/lecturer/sessions` | `/tutor/schedules` | |
| `/admin/schedules` | `/lecturer/tutors` | `/tutor/register-generation` | |
| `/admin/sessions` | `/lecturer/attendance` | `/tutor/notes` | |
| `/admin/messaging` | `/lecturer/messages` | `/tutor/messaging` | |
| `/admin/analytics` | `/lecturer/analytics` | `/tutor/earnings` | |
| `/admin/audit-logs` | `/lecturer/reports` | `/tutor/help` | |
| | | `/settings` (all staff) | |

---

*Last aligned with app routes in [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-features-by-dashboard). Update checklists when new routes or workflows ship.*
