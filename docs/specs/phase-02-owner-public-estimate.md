# Phase 02 — Owner Module, Public Shop APIs and Estimate Service

## Goal

Implement owner shop and team management, public shop discovery APIs, server-side estimate management, and a minimal Owner dashboard. Ensure ownership and role-based permissions are enforced, estimate totals are calculated on the server, and estimate changes follow the centralized booking state machine.

## Build

### 1. Owner APIs

- Implement `GET /shops` to list shops owned by the authenticated owner.
- Implement `POST /shops` to create a shop with independent team, services, and inventory scope.
- Implement `PATCH /shops/:shopId` to update shop details, ensuring only the owning user can modify the shop.
- Implement team management endpoints:
  - `GET /shops/:shopId/team` — list team members.
  - `POST /shops/:shopId/team` — create staff accounts using email and a temporary password.
  - `PATCH /shops/:shopId/team/:membershipId` — update a member's role or deactivate their membership.
- Implement service management endpoints:
  - `GET /shops/:shopId/services`
  - `POST /shops/:shopId/services`
  - `PATCH /shops/:shopId/services` or the resource-specific route established by the existing API conventions.
- Enforce owner authorization, shop ownership, input validation, and consistent error responses across all owner endpoints.
- Ensure deactivated staff cannot authenticate or access the relevant shop.

### 2. Public shop APIs

- Implement `GET /public/shops?city=&q=` to return discoverable shops, including services offered and a rating placeholder.
- Support filtering by city and search text.
- Implement `GET /public/shops/:shopId` to return shop details, available services, and working hours.
- Expose only fields intended for public access; never return private team information or internal operational data.
- Add validation and tests for query parameters, shop lookup, and public response shapes.

### 3. Estimate service

- Implement `PUT /shops/:shopId/bookings/:id/estimate` to replace estimate lines according to the permitted booking status and actor role.
- Allow the assigned Technician to edit estimates while the booking is in `INSPECTING`.
- Allow SA or Owner edits while the booking is in `ESTIMATE_REVIEW`, subject to the project's authorization rules.
- Ensure technicians can only edit estimates for bookings assigned to them.
- Recalculate estimate totals on the server from validated line items, using integer PKR values. Ignore any client-supplied total.
- Support estimate lines with `type` values `PART` and `LABOUR`, including an optional `partId`.
- Increment `revision` when SA edits an estimate, following the project's revision rules.
- Lock estimate lines once the estimate has been sent to the customer.
- Implement estimate read access for authorized staff and the customer associated with the booking.
- Integrate estimate lifecycle behavior with the centralized state machine:
  - Create an estimate on `INSPECTING → ESTIMATE_REVIEW`.
  - Lock the estimate when it is sent.
  - Record timestamps on acceptance and rejection.
  - Increment the revision during the reject-and-revise workflow as specified.
- Keep estimate creation, updates, locking, revisions, and lifecycle timestamps consistent with the state machine and database transaction rules.
- Add tests for totals, revisions, edit permissions, locking, and lifecycle effects.

### 4. Minimal Owner dashboard

- Implement a minimal Owner dashboard using the shared components from Phase 00.
- Include a shop switcher and shop creation form.
- Add a team table with add, edit, role-change, and deactivate actions.
- Add service CRUD interfaces.
- Display overview counts grouped by booking status.
- Integrate the dashboard with the implemented APIs where available.
- Use existing contracts and mocks only where necessary to support development; clearly distinguish mock data from live API data.
- Ensure the dashboard handles loading, validation errors, authorization failures, and empty states.

### 5. Tests and verification

- Add tests for estimate total calculation, revision behavior, and estimate locking.
- Add role-guard tests for estimate edits.
- Verify that an owner cannot access or modify another owner's shop.
- Verify that deactivated staff cannot authenticate or access the deactivated shop membership.
- Verify that public shop searches filter correctly by city and search text.
- Run `npm run lint && npm run typecheck && npm test` after each sub-part.
- Run `npm run build` during final verification.
- Commit each completed sub-part with a conventional commit message, proceeding only after its checks pass.
- Document any blocked checks and the exact user actions needed to resolve them.

### 6. Endpoint handoff

- Document the estimate endpoint contract, request schema, response schema, error responses, and example payloads.
- Include examples covering estimate creation, revision, and read access.
- Ensure the contract is clear enough for the SA review, customer estimate view, and technician estimate builder to consume.
- Keep the documentation consistent with the actual implementation rather than an assumed future interface.

## Constraints

- Follow `AGENTS.md` section 4 and `project-doc.md` sections 5.2, 5.7, and 7.
- Read the required specifications and inspect the existing codebase before implementation.
- Post an implementation plan of no more than 15 lines, confirming the sub-part sequence and explaining any proposed changes.
- Implement the phase incrementally in the specified order. For each sub-part, run `npm run lint && npm run typecheck && npm test`, commit with a conventional commit message, and proceed only when the checks pass.
- If any sub-part fails verification, fix the failure before starting the next sub-part.
- If a change touches frozen or shared files identified in `AGENTS.md` section 5, stop and request human approval before proceeding.
- Reuse the existing authentication, tenancy, error-handling, contract, and state-machine infrastructure from earlier phases.
- Enforce shop ownership, membership, role, booking assignment, and customer ownership checks on the server.
- Never trust client-supplied estimate totals or other derived financial values.
- Keep all booking status changes inside the centralized transition engine.
- Preserve transaction consistency for estimate lifecycle changes and state-machine effects.
- Do not expose internal shop, team, inventory, or customer data through public endpoints.
- Do not manually configure Supabase, Vercel, production environment variables, or other external services.
- If external credentials, permissions, or manual setup are required, hand off the exact steps to the user and continue with independently testable work wherever possible.
- Never claim that tests, database operations, deployments, or live endpoint checks succeeded unless they were actually executed and verified.

## Acceptance checks

- [ ] An owner can create a second shop with independent team membership, services, and inventory scope.
- [ ] An owner can list and update only their own shops.
- [ ] An owner can add team members, change their roles, and deactivate memberships.
- [ ] Deactivated staff cannot log in to or access the relevant shop.
- [ ] Owner endpoints enforce ownership and authorization consistently.
- [ ] Public shop listing supports city and search-text filtering.
- [ ] Public shop details include services and working hours without exposing private operational data.
- [ ] The assigned Technician can edit estimates only for their assigned bookings in `INSPECTING`.
- [ ] SA and Owner estimate edits are restricted to the permitted status and authorization rules.
- [ ] Estimate totals are always calculated server-side, and client-supplied totals are ignored.
- [ ] Estimate lines support `PART` and `LABOUR`, with an optional `partId`.
- [ ] Estimate revisions increment according to the specified rules.
- [ ] Sent estimates cannot have their lines modified.
- [ ] Estimate creation, sending, acceptance, rejection, and reject-and-revise behavior integrate correctly with the state machine.
- [ ] Estimate lifecycle changes and audit records remain transactionally consistent.
- [ ] Authorized staff and the booking's customer can read estimates; unauthorized users cannot.
- [ ] Tests cover estimate totals, revisions, permissions, locking, and lifecycle effects.
- [ ] Tests verify that one owner cannot access or modify another owner's shop.
- [ ] The minimal Owner dashboard supports shop switching, shop creation, team management, service CRUD, and booking-status overview counts.
- [ ] The estimate API contract and example payloads are documented and match the implementation.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` have been executed, with actual results recorded.
- [ ] Any blocked external setup or verification is documented with the exact user action required.

## Not in this phase

- Slot generation, availability calculations, and booking creation, which belong to Phase 03.
- Technician and SA UI implementations, which belong to Phases 04 and 05.
- Full inventory, parts, purchase-order, or quality-control workflows.
- Reimplementing authentication, tenancy, or the booking state machine from Phase 01.
- Bypassing the centralized transition engine to change booking statuses.
- Manual Supabase or Vercel configuration, production deployment, or external credential management.
- Features assigned to subsequent phases.
