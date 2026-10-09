# Phase 03 — Customer Portal and Booking Engine

## Goal

Enable customers to discover shops, book service appointments through a guided wizard, authenticate or reuse an existing account, and track and manage their bookings through a customer dashboard.

## Build

### 1. Landing page

- Implement a customer-facing landing page with a hero section and shop grid.
- Display each shop's name, city, rating placeholder, and available services.
- Add city filtering and text search.
- Initially use typed mocks from Phase 00 so development does not depend on live APIs.
- Switch to `GET /public/shops` when the Phase 02 API is available and verified.
- Include loading, empty, and error states for shop discovery.

### 2. Slot engine

- Implement slot calculation using each shop's working hours, `slotMinutes`, and `slotCapacity`.
- Materialize `Slot` records when needed for the first booking.
- Implement `GET /public/shops/:shopId/slots?date=` to return only slots with remaining capacity, where `booked < capacity`.
- Validate requested dates and slot availability on the server.
- Ensure slot generation and availability checks use consistent shop-specific configuration.
- Prevent overbooking when multiple customers attempt to reserve the same remaining capacity.

### 3. Booking creation service

- Implement `POST /bookings` to create a booking in a single database transaction.
- Reuse an existing customer account when the email and password match; return a clear validation error when the email exists but the password is incorrect.
- Create a customer account when no existing account matches.
- Create the customer's vehicle when required by the booking request.
- Claim the selected slot using a conditional database update that prevents capacity from being exceeded.
- Create the booking with `PENDING` status, selected services, and customer notes.
- Write the appropriate booking history record and notify the relevant SAs within the transaction.
- Automatically authenticate the customer after successful booking creation using the authentication mechanism established in Phase 01.
- Ensure failed bookings do not leave partial customer, vehicle, slot, booking, history, or notification records.

### 4. Booking wizard UI

- Implement a mobile-first, multi-step booking wizard with the following steps:
  1. Shop selection.
  2. Service selection, including multi-select and free-text service details.
  3. Date and available-slot selection.
  4. Personal and vehicle details.
  5. Review and confirmation.
- Use shared Zod schemas for client-side validation and compatible server-side request validation.
- Preserve entered data when navigating between wizard steps.
- Display clear validation errors, unavailable-slot messages, loading states, and booking submission failures.
- Prevent duplicate submissions and refresh slot availability when necessary.
- Display a clear confirmation after successful booking creation.

### 5. Customer dashboard

- Implement a customer dashboard displaying the authenticated customer's bookings.
- Add booking detail pages with a live `StatusTimeline`.
- Highlight pending customer actions with a contextual action banner.
- Implement an itemized estimate view showing parts and labour.
- Support estimate acceptance and rejection through the customer transition endpoint, allowing these actions only while the booking is in `AWAITING_CUSTOMER`.
- Allow booking cancellation before `IN_REPAIR`, subject to the transition rules and permissions defined in the project specification.
- Display a ready-for-pickup message when the booking reaches the appropriate status.
- Allow the customer to mark a booking as picked up, transitioning it to `COMPLETED` through the centralized state machine.
- Enforce server-side booking ownership checks for every customer-facing read and mutation.
- Include loading, empty, error, and unauthorized states throughout the dashboard.

### 6. Tests and verification

- Add a slot-capacity concurrency test proving that competing bookings cannot exceed the available capacity.
- Add account-reuse tests for matching and incorrect passwords.
- Add tests verifying that customers cannot read or modify another customer's bookings.
- Test the booking wizard, customer dashboard, and estimate actions against the documented API contracts.
- Verify that estimate acceptance and rejection are rejected outside `AWAITING_CUSTOMER`.
- Test responsive layouts at 375 px viewport width.
- Run `npm run lint && npm run typecheck && npm test` after each sub-part.
- Run `npm run build` during final verification.
- Commit each completed sub-part using a conventional commit message and proceed only after its checks pass.

### 7. API handoff

- Document the booking list endpoint and response shape.
- Document the booking detail payload, including status, services, vehicle, estimate, and customer-action information as applicable.
- Document the customer transition endpoint, supported actions, request payloads, authorization rules, and error responses.
- Ensure all documented contracts match the implemented endpoints so the SA module and other dependent phases can integrate without relying on assumptions.

## Constraints

- Follow `AGENTS.md` and `project-doc.md` sections 5.3, 4.1 rows 1, 6a, 6b, and 14, 4.3, and 7.
- Read the required specifications and inspect the existing codebase before implementation.
- Post an implementation plan of no more than 15 lines confirming the sub-part sequence and explaining any proposed changes.
- Implement the phase in the specified order. For each sub-part, run `npm run lint && npm run typecheck && npm test`, commit with a conventional commit message, and proceed only when the checks pass.
- If a sub-part fails verification, fix the failure before starting the next sub-part.
- If a change touches frozen or shared files identified in `AGENTS.md` section 5, stop and request human approval before proceeding.
- Reuse the existing authentication, tenancy, error-handling, Zod contracts, notification services, and state machine from earlier phases.
- Enforce authentication, customer ownership, shop scope, and valid booking transitions on the server.
- Treat client-side validation as a usability aid, never as a replacement for server-side validation.
- Use transactional database operations and concurrency-safe capacity claims to prevent overbooking.
- Keep booking status changes inside the centralized transition engine.
- Do not introduce duplicate authentication flows or bypass the established account reuse rules.
- Use mocks until the required APIs are available; switch to real endpoints only when their contracts and behavior have been verified.
- Do not manually configure Supabase, Vercel, production environment variables, or other external services.
- If external setup, credentials, permissions, or a reachable database are required, hand off the exact steps to the user and continue with independently testable work wherever possible.
- Never claim that tests, database operations, deployment, or live API behavior succeeded unless they were actually executed and verified.

## Acceptance checks

- [ ] Customers can browse shops and filter them by city and search text.
- [ ] Shop cards display the shop name, city, rating placeholder, and services.
- [ ] The landing page uses mocks until the public shop API is available and verified, then supports live API integration.
- [ ] `GET /public/shops/:shopId/slots?date=` returns only slots with remaining capacity.
- [ ] Slot calculation respects shop working hours, `slotMinutes`, and `slotCapacity`.
- [ ] Booking creation creates or reuses the customer account, creates the vehicle as required, claims capacity, creates a `PENDING` booking, writes history, and notifies SAs consistently.
- [ ] Existing customer accounts are reused when the email and password match; incorrect passwords are rejected.
- [ ] Concurrent booking attempts for the last available capacity cannot both claim the same remaining capacity; the capacity is never exceeded.
- [ ] Successful booking creation automatically authenticates the customer and displays the new `PENDING` booking in the dashboard.
- [ ] The customer dashboard lists only the authenticated customer's bookings.
- [ ] Customers cannot read or modify another customer's booking.
- [ ] Estimate details display itemized parts and labour.
- [ ] Estimate acceptance and rejection work only while the booking is `AWAITING_CUSTOMER`.
- [ ] Cancellation is restricted to the permitted pre-`IN_REPAIR` states and follows the centralized transition rules.
- [ ] Marking a booking as picked up uses the state machine to transition it to `COMPLETED`.
- [ ] The wizard and dashboard render and function at a 375 px viewport width.
- [ ] Automated tests cover slot concurrency, account reuse, booking ownership, and customer transition permissions.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` have been executed, and their actual results are documented.
- [ ] API contracts and example payloads are documented and match the implementation.
- [ ] Any blocked external setup or verification is documented with the exact user action required.

## Not in this phase

- SA dashboard implementation, which belongs to Phase 04.
- Notification bell implementation, which belongs to Phase 08.
- Technician dashboard and estimate-builder UI.
- Inventory management, parts workflows, purchase orders, and quality-control workflows.
- Reimplementing authentication, tenancy, or the centralized state machine.
- Bypassing the state machine for booking status changes.
- Manual Supabase or Vercel setup, production deployment, or external credential management.
- Features assigned to subsequent phases.
