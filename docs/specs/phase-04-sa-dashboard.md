# Phase 04 — Service Advisor Dashboard

## Goal

A Service Advisor (SA) can manage a booking from intake through estimate approval, parts assignment, customer notification, and completion. Every action follows the booking state machine, and the advisor can see only bookings belonging to their shop.

## Build

- **Bookings list and detail.** Show bookings for the current shop, with status filters and counts. Each booking's detail view includes the customer, vehicle, requested services, notes, estimate, and `BookingHistory` timeline.
- **Intake.** From `PENDING`, the advisor can confirm a booking, decline it with a cancellation note, or assign an active technician belonging to the same shop. Each action is available only when the current booking status permits it.
- **Estimate review.** The advisor can inspect estimate lines, add or edit lines when permitted, and remove lines. Totals are calculated on the server in integer PKR, never trusted from the browser. The current revision is visible. Sending an estimate to the customer locks its lines.
- **Rejected estimates.** When a customer rejects an estimate, the advisor can either send it back for technician revision or cancel the booking. Revising returns the booking to the appropriate review flow through the existing state machine.
- **Parts assignment and closing.** Assign an active parts team member from the same shop when the booking reaches the appropriate status. Notify the customer when the vehicle is ready, recording `readyNotifiedAt` and creating the in-app notification. Complete the booking through the state machine when its status and required conditions allow it.
- **Cancellation.** The advisor can cancel a booking before `IN_REPAIR`, with a note where required by the existing contract. The API rejects cancellation once the permitted window has passed.
- **Dashboard interface.** Build the SA list, detail, estimate-editing views, status-specific actions, loading and error states, and empty states using the shared application components. Show each action only when appropriate, but treat the API as the authority.
- **Tests and handoff.** Test the mapping between booking status and available actions, and verify every SA transition's role, status, shop-membership, and assignment guards. Document which flows were actually verified on the live URL for the Phase 09 handoff.

## Constraints

- **The state machine owns every status change.** Use the existing transition engine and its effects, history, and notification handling. No dashboard action or service may write `booking.status` directly.
- **The server owns permissions.** A hidden or disabled button is not authorization. Every request must validate the authenticated user, shop membership, role, booking status, and any applicable assignee or ownership guard.
- **Shop boundaries apply to every operation.** Bookings and assignable staff must belong to the requested shop. Never expose another shop's bookings or permit cross-shop assignments.
- **Estimate totals and revisions are authoritative on the server.** Reuse the Phase 02 estimate service and its rules for line validation, recalculation, revision increments, and locking. A sent estimate is read-only until the existing workflow explicitly permits a new revision.
- **Notifications follow the established transaction boundary.** Persist required in-app notification records with the corresponding database changes in the same transaction. Do not send email, SMS, or push notifications inside a database transaction. External delivery remains outside this phase unless the project specification explicitly requires it.
- **Reuse the authentication, tenancy, contracts, shared components, error handling, and notification services from earlier phases.** Do not introduce a second implementation of these systems.
- Read `AGENTS.md` and `project-doc.md` sections 5.4, 4.1 (rows 1, 2, 5, 6c, 6d, 7, 14), and 7 before implementation. If the documented transition rules conflict with this phase, surface the conflict rather than inventing behavior.
- Build in the order listed below. Before implementation, provide a plan of at most 15 lines. For each sub-part, implement and run `npm run lint && npm run typecheck && npm test`; commit with a conventional commit message before proceeding. Stop if a required frozen-file change needs human approval. Run the production build and record actual verification results before reporting completion.

## Acceptance checks

1. An SA can list and filter bookings belonging to their shop. Status counts and detail data match the underlying records.
2. A user without the required SA permissions cannot perform SA actions, even by calling the API directly. Cross-shop booking access and staff assignment are rejected.
3. From `PENDING`, the advisor can confirm, decline with a note, or assign an eligible technician. Each action succeeds only in an allowed status; invalid transitions return the established error response.
4. Estimate edits recalculate totals on the server and increment revisions according to the existing estimate rules. A sent estimate cannot be edited.
5. A rejected estimate can be returned for technician revision or cancelled through the documented state transitions. The revised estimate can proceed through review and be sent again when permitted.
6. The advisor can assign an eligible parts team member only in the permitted status and complete the booking only when the workflow allows it.
7. Ready notification records `readyNotifiedAt` and creates the required in-app notification. These records remain consistent with the corresponding database changes if a transaction fails.
8. Cancellation works before `IN_REPAIR` and is rejected once the booking passes the permitted cancellation window.
9. Component tests verify status-to-action mapping. API tests cover every SA transition, including wrong role, invalid status, cross-shop access, and applicable assignment guards.
10. `npm run lint`, `npm run typecheck`, `npm test`, and the production build have been run, with actual results and any remaining gaps recorded in the phase report.

## Not in this phase

Technician, parts, and QC dashboards; changes to authentication, tenancy, or the state machine; new booking-creation flows; a separate estimate implementation; external email, SMS, or push delivery; manual Supabase or Vercel configuration; and features assigned to later phases.
