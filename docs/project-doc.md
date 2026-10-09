# BayFlow

BayFlow is a multi-tenant platform for independent auto repair shops. Customers find a shop, book a service, and follow their vehicle through the repair. Shop staff manage the job from booking to pickup in one role-based point of sale.

**The product rule:** every status change is controlled, every shop's data stays isolated, and every stock mutation is consistent.

This document explains what we are building and why. `AGENTS.md` contains the rules for agents working on it. If an implementation decision is missing here, stop and raise it rather than silently inventing behaviour.

## What it is

BayFlow has three connected surfaces:

- **Customer portal.** Discover shops, book an appointment, follow the repair timeline, approve or reject an estimate, and confirm pickup.
- **Shop POS.** Role-specific workspaces for Owners, Service Advisors, Technicians, Parts Personnel, and QC Inspectors.
- **Backend.** Authentication, tenant isolation, booking lifecycle enforcement, estimates, inventory, procurement, quality control, and in-app notifications.

A booking moves through a controlled lifecycle. The person responsible for the next action is explicit, and the history of every transition is recorded.

## The problem

Independent garages often run on paper job cards, WhatsApp, and phone calls. Information gets lost between the front desk, mechanic, parts counter, quality inspection, and customer.

BayFlow replaces those hand-offs with a shared, auditable workflow.

| Problem                                      | BayFlow's answer                                                 |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Customers cannot tell where their vehicle is | A status timeline and clear pending actions                      |
| Estimates are approved verbally              | Itemized estimates with recorded approval or rejection           |
| Staff disagree about who owns the next step  | Explicit transition permissions and responsible roles            |
| Parts are missing or stock counts are wrong  | Per-shop inventory, shortage checks, and transactional receiving |
| Repairs skip quality control                 | A mandatory QC stage with a recorded failure-and-repair loop     |
| Branches share data accidentally             | Shop-scoped access enforced by the backend                       |

The goal is not to build a generic garage dashboard. It is to make the complete repair workflow work reliably, from booking to pickup.

## Who it's for

The primary user is an independent repair shop and its customers.

A customer needs to know what is happening to their vehicle and when they need to act. Staff need a clear queue of work that belongs to their role. An owner needs visibility across their own shops without exposing one shop's data to another.

The same user may have different staff roles in different shops. A customer account is global and can book at any shop.

## The rule everything rests on

**A booking can change status only through the state machine.**

The transition table defines which status changes are allowed, which roles may perform them, what additional conditions must hold, and what side effects follow. A single `transitionBooking(...)` function enforces those rules.

No route handler, component, or separate service may bypass it by writing `booking.status` directly.

This is more than a code-organization preference. Without one enforcement point, different parts of the application can disagree about which transitions are valid, omit audit records, or trigger only some of the required side effects.

The same principle applies to stock: receiving, allocating, and releasing parts must be transactional. A workflow that advances while its inventory records remain inconsistent is not a successful workflow.

## Scope

### Core

Everything required for the complete repair lifecycle:

- Sign-in with owner signup, staff login, and customer account reuse.
- Shops, memberships, team management, and service catalogs.
- Public shop discovery and capacity-aware appointment booking.
- Customer booking history, status timeline, and estimate approval.
- Role-specific shop dashboards.
- Centralized booking transitions and audit history.
- Estimate creation, revision, and locking.
- Inventory, purchase orders, receiving, and allocation.
- QC assignment, inspection, and the failure loop.
- In-app notifications and unread counts.
- Seed data, documentation, automated tests, and a live deployment.

### Bonus, only after core works end to end

- In-app calling using a suitable provider such as WebRTC, LiveKit, or Daily.
- AI Front Desk.

These features are worth considering only after the complete core flow has been demonstrated on the live URL. A broken core workflow is more damaging than a missing bonus.

### Out of scope

- Real payment processing.
- SMS delivery.
- Native mobile applications.
- Features not specified in this document.

## Users and access

| Role                 | Responsibility                                                                   | Access                                       |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Customer             | Book, track, approve or reject an estimate, cancel when allowed, confirm pickup  | Their own bookings                           |
| Owner                | Manage shops, team, services, and shop operations                                | All data belonging to their own shops        |
| Service Advisor (SA) | Manage bookings, assign staff, review estimates, notify customers, complete jobs | All bookings in their shop                   |
| Technician           | Inspect vehicles, prepare estimates, repair vehicles, respond to QC issues       | Jobs assigned to them                        |
| Parts Person         | Check stock, create purchase orders, receive parts, allocate stock               | Shop inventory and jobs awaiting parts       |
| QC Inspector         | Pick jobs from the shared QC queue, inspect, pass or raise an issue              | The shop's QC queue and assigned inspections |

Staff permissions come from `Membership(userId, shopId, role)`. Each membership has one role and can be deactivated independently. Staff accounts are created by an Owner, not through public staff signup.

Owners may inspect other role views for support, but acting as another role is not part of the core workflow.

Customers are global accounts, not shop-scoped accounts. Their authorization depends on ownership of the booking.

## Multi-tenancy

**A shop is the tenant.** Every shop-owned record must be associated with its shop, directly or through a well-defined parent relationship.

Shop-owned records include memberships, services, slots, bookings, parts, purchase orders, allocations, and other records derived from shop operations.

Every protected shop operation must verify membership and scope its data access to the relevant shop. The `shopId` in a request body is not proof of authorization. The authenticated membership or the booking's own `shopId` determines the permitted scope.

A staff member from Shop A must not be able to access Shop B's bookings, team, inventory, or purchase orders by changing an identifier.

Customers are authorized through `booking.customerId`, not staff membership.

Tenant isolation is a backend security property, not a UI filtering feature.

## The booking lifecycle

The lifecycle is implemented as a transition table plus one enforcement function. The table below is the source for valid status changes, role guards, extra guards, effects, and notifications.

### Status transitions

| From                | To                  | Permitted actor               | Required condition or effect                                                 |
| ------------------- | ------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `PENDING`           | `CONFIRMED`         | SA, Owner                     | Confirm the booking                                                          |
| `PENDING`           | `CANCELLED`         | SA, Owner, booking's Customer | Cancel the booking                                                           |
| `CONFIRMED`         | `ASSIGNED`          | SA, Owner                     | Target user has a Technician membership in this shop; set `technicianId`     |
| `ASSIGNED`          | `INSPECTING`        | Assigned Technician           | Actor matches `booking.technicianId`                                         |
| `INSPECTING`        | `ESTIMATE_REVIEW`   | Assigned Technician           | At least one estimate line; create estimate at revision 1                    |
| `ESTIMATE_REVIEW`   | `AWAITING_CUSTOMER` | SA, Owner                     | Estimate has lines and server-computed total; lock the sent estimate version |
| `AWAITING_CUSTOMER` | `ESTIMATE_APPROVED` | Booking's Customer            | Record `approvedAt`                                                          |
| `AWAITING_CUSTOMER` | `ESTIMATE_REJECTED` | Booking's Customer            | Record `rejectedAt`                                                          |
| `ESTIMATE_REJECTED` | `ESTIMATE_REVIEW`   | SA, Owner                     | Revise the estimate with the Technician; increment revision                  |
| `ESTIMATE_REJECTED` | `CANCELLED`         | SA, Owner                     | Cancel after estimate rejection                                              |
| `ESTIMATE_APPROVED` | `PARTS_PENDING`     | SA, Owner                     | Target user has a Parts membership in this shop; set `partsPersonId`         |
| `PARTS_PENDING`     | `PARTS_ORDERED`     | Parts Person                  | A shortage exists and a purchase order is created                            |
| `PARTS_PENDING`     | `PARTS_READY`       | Parts Person                  | All required parts are in stock                                              |
| `PARTS_ORDERED`     | `PARTS_READY`       | Parts Person                  | All purchase-order items required for the booking are fully received         |
| `PARTS_READY`       | `IN_REPAIR`         | Parts Person                  | Stock is sufficient; allocate parts and deduct stock atomically              |
| `IN_REPAIR`         | `QC_PENDING`        | Assigned Technician           | Send the job for inspection                                                  |
| `QC_PENDING`        | `QC_IN_PROGRESS`    | QC Inspector                  | Atomic claim; only the first picker succeeds                                 |
| `QC_IN_PROGRESS`    | `READY_FOR_PICKUP`  | Assigned QC Inspector         | Inspection passes                                                            |
| `QC_IN_PROGRESS`    | `IN_REPAIR`         | Assigned QC Inspector         | A QC issue with title and description is recorded; clear `qcInspectorId`     |
| `READY_FOR_PICKUP`  | `COMPLETED`         | SA, Owner, booking's Customer | Record `completedAt`                                                         |

The table is implemented in `src/lib/state/transitions.ts`. The implementation and this document must agree. A change to valid transitions requires an explicit specification change as well as a code change.

### Actions that do not change status

When an SA tells the customer that the vehicle is ready, the booking remains `READY_FOR_PICKUP`. The action sets `readyNotifiedAt` and creates an in-app notification for the customer.

A notification or timestamp does not, by itself, constitute a status transition.

### Cancellation boundary

Cancellation is intended to be available before `IN_REPAIR`, with allocated parts released through an idempotent release function.

The transition table above does not enumerate every possible pre-repair cancellation edge. **This is a specification gap, not permission to invent transitions.** Before implementing broader cancellation support, explicitly reconcile the intended cancellation edges with the transition table and record the decision in the Decision Log.

### State machine invariants

- An invalid transition returns `409 INVALID_TRANSITION`.
- A wrong role or wrong assignee returns `403 FORBIDDEN_ACTION`.
- Every successful transition writes exactly one `BookingHistory` record in the same database transaction as the status change.
- Required in-app notification records are created in that transaction as well.
- `COMPLETED` and `CANCELLED` are terminal statuses.
- A QC failure returns the job to the same Technician and records the issue.
- Two QC Inspectors attempting to claim the same job cannot both succeed.

## Estimates

An estimate contains a revision number, line items, and a server-computed total.

Each line has a type (`PART` or `LABOUR`), name, quantity, and unit cost. Part lines may reference a catalog `partId`. A custom part line without a `partId` can be quoted but is not stock-tracked.

Money is stored as integer PKR. The server computes totals; client-supplied totals are never authoritative.

The Technician prepares the estimate during `INSPECTING`. The SA can review and edit it in `ESTIMATE_REVIEW`. Sending it to the customer locks that version. The customer may accept or reject it while the booking is `AWAITING_CUSTOMER`.

A rejection leads to `ESTIMATE_REJECTED`. The SA may revise the estimate with the Technician and return it to review, or cancel the booking as allowed by the transition table. Revisions increment according to the specified edit and reject-revise rules.

The estimate lifecycle must remain consistent with the booking lifecycle. It must not be possible to approve a stale, unlocked, or client-altered total.

## Inventory and procurement

Inventory belongs to a shop. Each part has a SKU, name, quantity on hand, reorder level, and cost.

When an estimate is approved, the required stock-tracked parts are compared with available inventory. If all required parts are available, the job can move directly from `PARTS_PENDING` to `PARTS_READY`. Otherwise, the Parts Person creates a purchase order for the shortage.

Purchase orders support `ORDERED`, `PARTIALLY_RECEIVED`, and `RECEIVED`.

Receiving increments stock by the quantity actually received. Partial receipts keep the relevant booking in `PARTS_ORDERED` until all required items have arrived. Moving a booking to `IN_REPAIR` allocates the required parts and deducts stock in the same transaction as the transition.

Cancellation before repair releases applicable allocations. Releasing an allocation twice must not return stock twice.

**Stock must never become negative.** Every receive, allocation, and release must be safe under concurrent requests and transactional failure.

## Quality control

When a Technician finishes the repair, the job enters `QC_PENDING` and appears in the shop's shared QC queue.

Picking a job is an atomic claim. Only the first successful picker becomes its assigned QC Inspector; concurrent attempts must not both claim it.

A passing inspection moves the booking to `READY_FOR_PICKUP`. A failed inspection requires a recorded issue containing a title and description, then returns the job to `IN_REPAIR` for the same Technician. The cycle repeats until the inspection passes.

The issue record, status transition, audit history, and required notification records must remain consistent. A QC failure cannot silently skip the recorded issue or reassign the job to another Technician.

## Notifications

In-app notifications are the minimum supported notification channel. A notification bell displays the unread count; users can mark individual notifications or all notifications as read. Polling at roughly ten-second intervals is sufficient.

| Event                            | Recipient                    |
| -------------------------------- | ---------------------------- |
| New booking                      | Service Advisors of the shop |
| Technician assigned              | Assigned Technician          |
| Estimate submitted by Technician | Service Advisors of the shop |
| Estimate sent to customer        | Customer                     |
| Estimate accepted or rejected    | Service Advisors of the shop |
| Parts needed                     | Assigned Parts Person        |
| Parts ready                      | Assigned Technician          |
| Job sent to QC                   | QC Inspectors of the shop    |
| QC failure                       | Assigned Technician          |
| Vehicle ready for pickup         | Customer                     |

Notification **records** and external notification **delivery** are separate concerns. Required in-app records are written in the same transaction as the booking operation or transition that produces them. Email, SMS, or push delivery must not execute inside a database transaction. If external delivery is introduced, it happens after commit; reliable retries may require a transactional outbox. External delivery is not part of the core scope.

## Authentication and API behaviour

Authentication uses bcryptjs for password hashing and JWT sessions in secure, HttpOnly cookies. In production, cookies use `SameSite=Lax` and `Secure`.

Owners can sign up. Staff accounts are created by Owners and can log in using their assigned credentials. Customers can create an account during booking.

If a booking email already exists, BayFlow reuses the existing customer only when the supplied credentials are valid or the customer is already authenticated. An existing email with an incorrect password must produce a clear error, not create a duplicate account.

The API uses JSON and Zod validation. Shared schemas live in `src/lib/contracts/`, with TypeScript types inferred from those schemas.

Successful responses use `{ data: ... }`. Errors use `{ error: { code, message, details? } }` with the appropriate HTTP status.

| HTTP status | Error code                                                   |
| ----------- | ------------------------------------------------------------ |
| `400`       | `VALIDATION_ERROR`                                           |
| `401`       | `UNAUTHENTICATED`                                            |
| `403`       | `FORBIDDEN_ACTION`                                           |
| `404`       | `NOT_FOUND`                                                  |
| `409`       | `INVALID_TRANSITION` or `CONFLICT`, depending on the failure |

Shop-scoped endpoints live under `/api/shops/:shopId/...` and verify membership. Route handlers authenticate, validate input, call the appropriate service, and map errors to HTTP responses. Domain operations belong in services, not in route handlers or React components.

### API surface

| Area             | Endpoint                                                                                                                             | Purpose                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Authentication   | `POST /api/auth/owner/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                   | Signup, sessions, identity and memberships |
| Public shops     | `GET /api/public/shops?city=&q=`, `GET /api/public/shops/:shopId`                                                                    | Discover shops and services                |
| Slots            | `GET /api/public/shops/:shopId/slots?date=`                                                                                          | Return available slots                     |
| Booking          | `POST /api/bookings`, `GET /api/me/bookings`, `GET /api/me/bookings/:id`                                                             | Create and view customer bookings          |
| Customer actions | `POST /api/me/bookings/:id/estimate/accept`, `.../reject`, `.../pickup`, `.../cancel`                                                | Customer lifecycle actions                 |
| Owner and team   | `GET/POST /api/shops`, `PATCH /api/shops/:shopId`, `GET/POST /api/shops/:shopId/team`, `PATCH /api/shops/:shopId/team/:membershipId` | Manage shops and team                      |
| Services         | `GET/POST/PATCH /api/shops/:shopId/services`                                                                                         | Manage service catalog                     |
| Shop bookings    | `GET /api/shops/:shopId/bookings?status=`, `GET /api/shops/:shopId/bookings/:id`                                                     | List and inspect bookings by permission    |
| Transitions      | `POST /api/shops/:shopId/bookings/:id/transition`                                                                                    | Request an allowed status change           |
| Estimates        | `PUT /api/shops/:shopId/bookings/:id/estimate`                                                                                       | Replace estimate lines in permitted states |
| Inventory        | `GET/POST/PATCH /api/shops/:shopId/parts`                                                                                            | Read and manage shop parts                 |
| Parts check      | `GET /api/shops/:shopId/bookings/:id/parts-check`                                                                                    | Compare required and available stock       |
| Purchase orders  | `GET/POST /api/shops/:shopId/purchase-orders`, `POST /api/shops/:shopId/purchase-orders/:id/receive`                                 | Create and receive orders                  |
| QC               | `GET /api/shops/:shopId/qc/queue`, `POST /api/shops/:shopId/bookings/:id/qc/pick`, `.../qc/pass`, `.../qc/fail`                      | Claim and inspect jobs                     |
| Notifications    | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`                                     | Read notification state                    |
| Overview         | `GET /api/shops/:shopId/overview`                                                                                                    | Owner's per-shop summary                   |

The QC and receiving endpoints may be thin wrappers around the relevant services and transition engine. They must not introduce a second way to change booking status.

## Data model

The schema is relational because the workflows depend on transactions, ownership, and explicit relationships. IDs use `cuid()`. Tables carry timestamps where appropriate, and shop-owned tables are indexed by `shopId`.

The following is the conceptual model; the actual Prisma schema must be valid for the installed Prisma version.

- **User:** identity, name, email, phone, password hash, customer flag, active flag.
- **Shop:** owner, name, address, city, phone, optional logo, working hours, slot duration, slot capacity.
- **Membership:** user, shop, role, active flag; unique per user and shop.
- **Service:** shop, name, description, estimated duration, optional base price.
- **Slot:** shop, start time, capacity, booked count; unique per shop and start time.
- **Vehicle:** owner, registration, make, model, year, optional colour and mileage.
- **Booking:** shop, customer, vehicle, slot, status, notes, assigned Technician, Parts Person and QC Inspector, relevant timestamps, and selected services.
- **BookingHistory:** booking, previous and next status, actor, optional note, timestamp.
- **Estimate:** booking, revision, total, sent, approved and rejected timestamps.
- **EstimateItem:** estimate, line type, optional part reference, name, quantity and unit cost.
- **Part:** shop, SKU, name, quantity, reorder level and cost; unique SKU per shop.
- **PurchaseOrder:** shop, status, creator and line items.
- **PurchaseOrderItem:** order, part, optional booking, ordered quantity and received quantity.
- **Allocation:** shop, booking, part, quantity and optional release timestamp.
- **QcIssue:** booking, reporting inspector, title, description and timestamp.
- **Notification:** recipient, optional shop and booking, type, message, read timestamp and creation timestamp.

The staff role comes from Membership, not from a client-supplied value or an independent role field in a request.

The BookingStatus enum must match the statuses defined in the lifecycle section. Schema changes must preserve those invariants and be reflected in this document.

## Supabase and Prisma

Supabase is managed PostgreSQL, not the application authentication provider or a second database API. All application database access happens through Prisma on the server.

Prisma 7 uses the `prisma-client` generator with generated output under `src/generated/prisma`. The generated output is not committed. Runtime access uses `DATABASE_URL` through `@prisma/adapter-pg` in `src/lib/db.ts`; Prisma CLI operations use `DIRECT_URL` configured in `prisma.config.ts`. The schema does not declare `url` or `directUrl`.

The runtime connection normally uses the Supabase transaction pooler. The CLI connection uses a direct or suitable session-pooler connection. The exact connection values depend on the configured Supabase project and must be supplied by the developer.

Tenant isolation is enforced in the application service layer. Row-level security must be enabled on all tables and remain deny-by-default when accessed through Supabase's auto-generated API. No client-side database access, Supabase Auth, or `@supabase/supabase-js` is part of this architecture.

Database passwords and service credentials are secrets. They must never enter source control or browser code.

## The interface

BayFlow is an operational tool, not a marketing dashboard with a different layout for every screen.

The public landing page helps customers find shops and understand available services. The booking wizard guides them through shop, service, date and slot, customer details, vehicle details, and confirmation. The customer dashboard makes the current status and next action obvious.

The POS is role-specific. Staff should see the queue and actions relevant to their work. Owners can switch shops and inspect shop operations. Shared components should keep tables, forms, badges, timelines, loading states, empty states, and error states consistent.

The customer portal is mobile-first. Every data view needs loading, empty, and error states. Forms should preserve entered information when possible and prevent duplicate submissions.

A centralized API client in `src/lib/api-client.ts` unwraps successful `{ data }` responses and raises typed errors. Components should not scatter raw `fetch` calls throughout the UI.

## Reliability and performance

The system is a single deployable Next.js application. It does not need queues, workers, containers, or WebSockets to meet the core requirements.

Transactions are required for booking creation with slot capacity, booking transitions, purchase-order receiving, stock allocation, and cancellation release. Concurrent operations must not overbook slots, allow multiple QC claims, or make inventory negative.

Notifications and dashboards may poll at approximately ten-second intervals. This is sufficient for the hackathon scope.

TypeScript strict mode, Zod validation, meaningful tests, and a build that passes are required. Tests should exercise real service behaviour and, where practical, use a test database rather than asserting only against mocks.

## Where this is likely to go wrong

**Slot capacity.** Checking availability before booking is not enough. Two requests can observe the same remaining capacity. The final capacity check and slot claim must be atomic.

**Tenant isolation.** Filtering the UI is not authorization. Every protected query and mutation must enforce the correct shop and membership.

**Status drift.** If separate services write status independently, audit history, notifications, assignments, and side effects will diverge. The transition engine must remain the only status-change path.

**Estimate revisions.** A sent estimate must not change underneath a customer who is reviewing it. Revision increments, server-side totals, and locking must follow the specified lifecycle.

**Inventory races.** Concurrent receiving, allocation, or cancellation can corrupt stock if mutations are not transactional and guarded.

**QC concurrency.** A normal read followed by a write lets two Inspectors claim the same job. Claiming must use an atomic conditional update or equivalent concurrency-safe operation.

**External delivery.** An in-app notification record does not prove that an email or SMS was delivered. External delivery must remain separate from the database transaction.

**Incomplete cancellation rules.** The prose permits cancellation before `IN_REPAIR`, but the transition table lists only some cancellation edges. Resolve the missing edges explicitly before implementing broader cancellation.

## What has to be true before this ships

The product is not done because the screens look plausible. The following must work on the live URL using seeded accounts:

- A customer books through the wizard and the booking appears as `PENDING` on the SA dashboard.
- The full lifecycle reaches `COMPLETED`: confirmation, assignment, inspection, estimate review, customer approval, parts, repair, QC, ready for pickup, and completion.
- The estimate-rejected path supports revision and resend, or cancellation.
- The QC-fail loop records an issue and returns the booking to the same Technician until it passes.
- The in-stock shortcut and partial-delivery behaviour work.
- Concurrent bookings cannot exceed slot capacity, and concurrent QC picks cannot both succeed.
- A Shop A staff identity receives `403` or `404` when requesting Shop B data; automated tests demonstrate the boundary.
- Automated transition tests cover allowed roles, invalid transitions, and assignment guards.
- One Owner can manage multiple shops with independent teams and services.
- Required in-app notification events produce the correct records and unread-count behaviour.
- Seed data includes at least three shops, a team for each required role, services, inventory, slots for the next fourteen days, and bookings in different statuses.
- A fresh setup can follow the README and `.env.example` without relying on committed secrets.
- Lint, type checks, tests, and the production build pass. The live URL is checked rather than assumed to be deployed.

## Project setup and deliverables

The application uses Next.js App Router, strict TypeScript, PostgreSQL through Supabase and Prisma, Zod, bcryptjs, `jose`, Tailwind, shadcn/ui, TanStack Query or SWR, and Vitest.

The repository should provide scripts for installing dependencies, running the app, generating the Prisma client, migrating the database, seeding demo data, linting, type-checking, testing, and building.

The README must explain the product, stack and exact prerequisites, environment setup, database setup, seed process, tests, demo credentials, deployment, and important architecture decisions. `.env.example` must list every required environment variable with safe placeholder values and brief comments.

The repository must not contain secrets, generated build output, or committed dependencies. Production deploys from `main`. The deployed app must include seeded demo accounts for the required roles.

The hackathon deadline is **12:00 PM, Saturday 10 October 2026**. Prioritize the smallest reliable live product that demonstrates the full repair lifecycle over bonus work.

## Decision log

Decisions and their reasoning belong here so future work does not silently change the architecture.

| ID    | Decision                                                                                                   | Reason                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D-001 | Next.js App Router and TypeScript monolith                                                                 | One repository and deployment keep the path to a working product short.                       |
| D-002 | PostgreSQL through Supabase and Prisma                                                                     | Relational data and transactions fit bookings, stock, and procurement.                        |
| D-003 | Transition table plus one `transitionBooking` function                                                     | Invalid transitions are centrally rejected and consistently audited.                          |
| D-004 | Polling at approximately ten seconds                                                                       | In-app notifications do not require WebSocket infrastructure.                                 |
| D-005 | One role per Membership                                                                                    | Shop-scoped permissions remain straightforward to reason about.                               |
| D-006 | Allocate stock atomically with `PARTS_READY → IN_REPAIR`                                                   | Booking progression and inventory deduction stay consistent.                                  |
| D-007 | Rejected estimates can return to review or be cancelled                                                    | Makes the rejection path explicit; cancellation edges must match the transition table.        |
| D-008 | Money is stored as integer PKR                                                                             | Avoids floating-point errors.                                                                 |
| D-009 | Parts and QC side effects use a registered effects mechanism                                               | Keeps transition enforcement centralized while allowing isolated side-effect implementations. |
| D-010 | Calling and AI Front Desk wait until core works live                                                       | Bonus features must not jeopardize the full lifecycle.                                        |
| D-011 | Supabase is accessed only through server-side Prisma; RLS is enabled by default                            | Prevents accidental alternate access paths and supports deny-by-default database access.      |
| D-012 | npm is the package manager                                                                                 | Keeps setup commands and dependency management consistent.                                    |
| D-013 | Estimate PART lines with `partId` are stock-tracked; custom lines without one are not                      | Supports one-off quotes without inventing inventory records.                                  |
| D-014 | Seed data is modular                                                                                       | Keeps seed responsibilities separated without changing the final seed command.                |
| D-015 | Transition side effects use a registry                                                                     | Allows domain effects to be implemented without creating a second transition engine.          |
| D-016 | Prisma 7 uses `prisma-client`, a custom output, `prisma.config.ts`, and `@prisma/adapter-pg`               | Keeps generated client setup and runtime database access explicit.                            |
| D-017 | Supabase is the shared live database; local development and testing must avoid destructive data collisions | Prevents parallel work and test data from corrupting the live demo.                           |

## Open decisions

These questions must be resolved explicitly before the relevant behaviour is implemented.

- **Cancellation:** Which pre-`IN_REPAIR` statuses have an explicit transition to `CANCELLED`, and which actors may cancel each one? Recommended: encode each allowed edge in the transition table rather than treating the prose as a shortcut.
- **Slot generation:** Compute slots from working hours on read and materialize a slot on its first booking. This avoids needing a scheduled job for the core flow.
- **Existing customer email:** If the email exists and the supplied password is wrong, reject with a clear error instead of creating another account.
- **Owner support views:** Owners may inspect other role views in read-only mode; role impersonation is not part of the core scope.
