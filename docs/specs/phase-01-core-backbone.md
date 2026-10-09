# Phase 01 — Core Backbone: Auth, Tenancy, State Machine

## Goal

Implement the core backend foundations required by subsequent phases: authentication, tenant isolation, role and membership resolution, and a centralized booking state machine with transactional audit logging, notifications, and an extensible effects registry.

## Build

### 1. Foundations

- Read `AGENTS.md`, the relevant sections of `project-doc.md`, and the existing implementation before making changes.
- Implement a Zod-validated environment loader.
- Create `AppError` classes mapped to the project's standard error response shape and HTTP status codes.
- Implement a `handle()` route wrapper that handles authentication, Zod validation, service execution, and consistent error mapping.

### 2. Authentication

- Implement password hashing using `bcryptjs`.
- Implement JWT authentication using `jose`, storing tokens in secure, `HttpOnly` cookies with appropriate security flags.
- Implement `requireAuth` and `requireRole` helpers.
- Implement the following endpoints:
  - `POST /auth/owner/signup`
  - `POST /auth/login`
  - `POST /auth/logout`
  - `GET /auth/me`
- Ensure `GET /auth/me` returns the authenticated user and their memberships.
- Support owner, staff, and customer authentication.
- Enforce the account reuse rules defined in `project-doc.md` section 5.1.
- Validate authentication behavior, password verification, cookie settings, and invalid credentials.

### 3. Tenancy and membership

- Implement `requireMembership(shopId, roles?)` to verify shop membership and allowed roles.
- Implement `withShopScope(shopId)` to enforce tenant-scoped database access.
- Ensure authenticated users cannot access another shop's data without the required membership and permissions.
- Create reusable test factories for shops, users, memberships, and bookings in every supported status.
- Return consistent forbidden or not-found responses for unauthorized cross-tenant access, following the project's security conventions.

### 4. Booking state machine and effects

- Implement `transitionBooking({ bookingId, to, actor, note, payload })` as the single entry point for booking status changes.
- Execute each transition within one database transaction:
  - Load and validate the booking.
  - Confirm that the requested transition exists in the transition table.
  - Validate actor roles and assignee requirements.
  - Apply the registered transition effects.
  - Write exactly one `BookingHistory` record.
  - Create the required notifications.
- Implement the effects registry at `src/lib/state/effects/index.ts`, supporting registrations through `registerEffect('FROM->TO', fn(tx, ctx))`.
- Implement the effects assigned to this phase for statuses 1–6 and cancellation, including technician and parts-person assignments and relevant timestamps, as specified in the project documentation.
- Implement `lib/services/notifications.ts` with `createNotifications(tx, ...)` for use by the state machine.
- Add a generic booking transition endpoint at `POST /shops/:shopId/bookings/:id/transition`.
- Add the customer-side transition entry point with booking ownership validation.
- Ensure no code outside the state machine engine directly modifies `booking.status`.

### 5. Tests and seed data

- Add table-driven tests for every transition defined in the transitions table.
- Verify that permitted roles can perform valid transitions and that incorrect roles or assignees are rejected.
- Verify that invalid transition pairs return `409 INVALID_TRANSITION`.
- Verify that unauthorized roles, assignees, and cross-tenant access return the appropriate forbidden or not-found responses.
- Add authentication tests covering password hashing, cookie security flags, successful login, and incorrect passwords.
- Verify that each successful transition creates exactly one `BookingHistory` record and the required notifications within the same transaction.
- Create `prisma/seed/core.ts` with minimal development/test seed data: one owner, one shop, one user for each staff role, and one customer.
- Ensure seed data uses safe development credentials and does not introduce real secrets.

## Constraints

- Follow `AGENTS.md` sections 4.1–4.6 and `project-doc.md` sections 3, 4, 5.1, 7, and 8.
- Post an implementation plan of no more than 15 lines before starting work. The plan must confirm the sub-part sequence and explain any proposed changes to it.
- Implement the phase incrementally in the specified order. For each sub-part, run `npm run lint && npm run typecheck && npm test`, commit with a conventional commit message, and proceed only when the checks pass.
- If a sub-part fails verification, fix the failure before starting the next sub-part.
- If a change touches frozen or shared files identified in `AGENTS.md` section 5, stop and request human approval before proceeding.
- Keep booking status changes centralized in `transitionBooking`; do not introduce alternative status-update paths.
- Enforce tenant isolation on every relevant data-access path and validate role, membership, ownership, and assignee requirements server-side.
- Keep audit logging and notification creation inside the transition transaction so they remain consistent with the status change.
- Do not expose JWTs to client-side JavaScript or store authentication tokens in `localStorage`.
- Never claim that a test, migration, deployment, or security check succeeded unless it was actually executed and verified.
- Do not manually perform external setup, including configuring Supabase or Vercel, setting production environment variables, or managing external credentials.
- If external access, credentials, permissions, or manual configuration are required, hand off the exact steps to the user and continue with independently testable implementation wherever possible.
- Do not publish demo credentials, secrets, or sensitive configuration in public repositories, logs, or handoff notes.

## Acceptance checks

- [ ] Owners can sign up and log in; staff and customers can log in through the supported authentication flow.
- [ ] `GET /auth/me` returns the authenticated user and their memberships.
- [ ] Passwords are hashed, incorrect passwords are rejected, and authentication cookies use appropriate security flags.
- [ ] JWT authentication, `requireAuth`, and `requireRole` behave as specified.
- [ ] Account reuse follows `project-doc.md` section 5.1.
- [ ] `requireMembership` and `withShopScope` enforce shop membership and tenant isolation.
- [ ] Automated tests confirm that a Shop A staff token cannot access Shop B booking data and receives the appropriate `403` or `404` response.
- [ ] Invalid transition pairs return `409 INVALID_TRANSITION`.
- [ ] Unauthorized roles and assignees return `403 FORBIDDEN_ACTION` as specified.
- [ ] Table-driven tests cover every transition defined in the transitions table.
- [ ] Every successful transition writes exactly one `BookingHistory` record and creates the required notifications in the same transaction.
- [ ] The effects registry supports the documented registration interface, and all effects assigned to this phase are implemented and tested.
- [ ] No code outside the state machine engine writes `booking.status`.
- [ ] The customer-side transition entry point validates booking ownership.
- [ ] The core seed module creates the required development/test records.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` pass after each sub-part before work proceeds.
- [ ] All required checks have been run and their actual results recorded.
- [ ] If production deployment requires manual Vercel configuration or credentials, the deployment is clearly marked as pending and the exact required user actions are documented.

## Not in this phase

- Owner dashboard or owner-facing UI implementation.
- Estimate editing and estimate-management workflows.
- Slot availability, scheduling, or booking-slot logic beyond what is strictly required by the state machine.
- Inventory, parts management, and purchase-order business logic.
- Full customer-facing or shop-floor workflows.
- Implementing features assigned to subsequent phases.
- Manually configuring Supabase, Vercel, production environment variables, or external credentials.
- Publishing production deployments or claiming live deployment verification without actual execution and confirmation.
- Publishing seeded demo credentials to public repositories or unauthenticated channels.
