# Workflow hardening — QA and deploy order

## Deploy order

1. Deploy application code (server functions + UI) first.
2. Apply migration `20260620120000_claim_workflow_enforcement.sql` via `pnpm db:push`.
3. Smoke-test each role with MFA enrolled.

## Manual QA matrix

| Check | Steps | Expected |
|-------|--------|----------|
| Transition matrix | `pnpm test` | All `claim-workflow` tests pass |
| Tutor submit | Draft claim → Submit with TOTP | Status `PENDING_VERIFICATION` |
| Tutor reopen | Rejected claim → Correct & resubmit → edit → submit | Returns to draft, then pending |
| Lecturer verify | Pending claim → Verify with TOTP | Status `VERIFIED` (not `APPROVED`) |
| Admin approve | Verified claim → Approve with TOTP | Status `APPROVED`, compensation snapshot |
| No sign shortcut | Lecturer UI | No “Sign & approve” control |
| Immutability | Approved claim → edit notes/evidence | Server error + DB rejection |
| RLS bypass | Client `update({ status: 'APPROVED' })` as tutor | Fails |
| Step-up required | Submit/verify/approve without code | Clear error |
| Failed MFA | Wrong TOTP on step-up | Toast error; `mfa_events` row with `mfa_step_up_failed` |
| Regression | Full path to payroll export | Unchanged export behaviour |

## Prerequisites

- Test users must have TOTP enrolled under Settings → Security.
- Lecturer and admin accounts need enrolled MFA before workflow actions succeed.
