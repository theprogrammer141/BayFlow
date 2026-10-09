# BayFlow: Project Document (Source of Truth)

> Multi-tenant auto repair shop management platform.
> Hackathon deadline: **12:00 PM, Sat 10 Oct 2026**. Team of 3.
>
> This file is the **single source of truth** for what we build. If code and this document disagree, fix the document first (via a PR), then the code. Agents must read this file before starting any task (see `AGENTS.md`).

---

## 1. Overview

BayFlow lets customers discover an independent auto repair shop, book a service and track their vehicle, while shop staff run the whole repair job (check-in to pick-up) in one role-based POS.

Three surfaces, one backend:

1. **Customer portal:** public landing page, booking wizard, customer dashboard (status timeline, estimate approval).
2. **Shop POS:** role-based dashboards for Owner, Service Advisor (SA), Technician, QC Inspector, Parts Person.
3. **Backend API:** multi-tenant, authenticated, with an explicit booking **state machine** that enforces who can move a job to which step.

### 1.1 Problem being solved

Independent garages run on paper job cards, WhatsApp and phone calls. Each hand-off loses information.

| Problem | BayFlow answer |
|---|---|
| No visibility of where a car is | Status timeline for customer; filtered dashboards for staff |
| No accountability (verbal approvals) | Itemized estimate, accepted in-app with timestamp; audit log on every transition |
| Wrong stock | Live per-shop inventory; shortages flagged; receiving updates stock |
| Unclear ownership | Every status has exactly one responsible role |
| Skipped quality checks | Mandatory QC stage; failed QC returns job to technician with a recorded issue |
| Multi-branch chaos | Tenant isolation: each shop has its own team, inventory, slots, bookings |

### 1.2 Scope tiers

| Tier | Status | Items |
|---|---|---|
| **Core** | Mandatory | Everything in sections 3 to 10 |
| **Bonus** | Optional, only after core works end to end | In-app calling (WebRTC/LiveKit/Daily), AI Front Desk |
| **Out of scope** | Not building | Real payments, SMS, native apps |

### 1.3 Judging weights (drives priorities)

| Criteria | Weight |
|---|---|
| Core flow completeness (full lifecycle live, QC loop, estimate approval) | 35% |
| Architecture and code quality (state machine, tenant isolation, validation) | 20% |
| Product and UX | 15% |
| Deployment and docs | 10% |
| Multi-tenancy and security | 10% |
| Bonus | 10% |

**Prioritization rule:** a smaller, correct, deployed product beats a large broken one.

---

## 2. Users and Roles

| Role | Who | Responsibilities | Sees |
|---|---|---|---|
| **Customer** | Vehicle owner (global account) | Browse shops, book, track, approve/reject estimate, mark pick-up | Only their own bookings |
| **Owner** | Shop owner | Sign up, create shops, add/edit/deactivate team, configure services, full visibility | All data of their own shops |
| **Service Advisor (SA)** | Front desk | Confirm/decline bookings, assign technician, review/edit/send estimate, assign parts person, notify ready, complete | All bookings of the shop |
| **Technician** | Mechanic | Inspect, build estimate, repair, send to QC, fix QC issues | Only bookings assigned to them |
| **Parts Person** | Inventory and procurement | View stock, create POs, receive orders, allocate parts | Jobs awaiting parts; shop inventory |
| **QC Inspector** | Quality control | Pick a job from shared queue, test, pass or raise issue | Shared QC queue |

### 2.1 Access rules

- Roles are **scoped per shop** via `Membership(userId, shopId, role)`. One role per membership; a user may hold different roles in different shops.
- Staff accounts are created **only by the Owner** (no self sign-up for staff).
- Owner can do everything inside their own shops (view and manage all bookings; acting as other roles is optional and not built).
- Customers are global accounts and can book at any shop.

---

## 3. Multi-Tenancy

- **Tenant = shop.** Every shop-owned record carries `shopId`: Membership, Service, Slot, Part, PurchaseOrder, Booking, and anything derived from a booking.
- **Every** query on shop-owned data goes through `withShopScope(shopId)` (or equivalent) which also verifies the caller has a Membership in that shop.
- The `shopId` used for authorization comes from the **authenticated membership or the booking's own `shopId`**, never trusted from the request body alone.
- Acceptance test: a staff token for Shop A requesting Shop B's booking by ID gets **403 or 404**.
- Customers are not tenant-scoped; they are scoped to `booking.customerId`.

---

## 4. Booking Lifecycle (State Machine)

The heart of the product. Implemented as **data** (one transitions table) plus **one function** `transitionBooking(...)`. No code path may write `booking.status` directly.

### 4.1 Statuses and transitions

| # | From | To | Actor (role guard) | Extra guard | Side effects | Notifies |
|---|---|---|---|---|---|---|
| 1 | `PENDING` | `CONFIRMED` | SA, Owner | | | Customer (optional) |
| 1b | `PENDING` | `CANCELLED` | SA, Owner, booking's Customer | | | Counterparty |
| 2 | `CONFIRMED` | `ASSIGNED` | SA, Owner | Target user has TECHNICIAN membership in this shop | Set `technicianId` | Technician |
| 3 | `ASSIGNED` | `INSPECTING` | Technician | Must be `booking.technicianId` | | |
| 4 | `INSPECTING` | `ESTIMATE_REVIEW` | Technician | Assigned tech; at least one estimate line | Create Estimate (revision 1) | SA |
| 5 | `ESTIMATE_REVIEW` | `AWAITING_CUSTOMER` | SA, Owner | Estimate has lines; total recomputed | Lock estimate version | Customer |
| 6a | `AWAITING_CUSTOMER` | `ESTIMATE_APPROVED` | Customer | Must own booking | Store `approvedAt` | SA |
| 6b | `AWAITING_CUSTOMER` | `ESTIMATE_REJECTED` | Customer | Must own booking | Store `rejectedAt` | SA |
| 6c | `ESTIMATE_REJECTED` | `ESTIMATE_REVIEW` | SA, Owner | Revise with technician | `estimate.revision += 1` | Technician |
| 6d | `ESTIMATE_REJECTED` | `CANCELLED` | SA, Owner | | | Customer |
| 7 | `ESTIMATE_APPROVED` | `PARTS_PENDING` | SA, Owner | Target user has PARTS membership | Set `partsPersonId` | Parts Person |
| 8a | `PARTS_PENDING` | `PARTS_ORDERED` | Parts Person | At least one shortage; PO created for missing items | Create PO | |
| 8b | `PARTS_PENDING` | `PARTS_READY` | Parts Person | Every required part in stock | | Technician |
| 9 | `PARTS_ORDERED` | `PARTS_READY` | Parts Person | All PO items for this booking fully received | Stock increases on each receipt | Technician |
| 10 | `PARTS_READY` | `IN_REPAIR` | Parts Person | Stock sufficient | Allocate: deduct stock, create Allocation rows (same transaction) | Technician |
| 11 | `IN_REPAIR` | `QC_PENDING` | Technician | Assigned tech | | QC queue |
| 12 | `QC_PENDING` | `QC_IN_PROGRESS` | QC Inspector | Atomic lock: only the first picker succeeds | Set `qcInspectorId` | |
| 13a | `QC_IN_PROGRESS` | `READY_FOR_PICKUP` | QC Inspector | Must be `qcInspectorId` | | SA |
| 13b | `QC_IN_PROGRESS` | `IN_REPAIR` | QC Inspector | Must be `qcInspectorId`; **QcIssue required** (title, description) | Clear `qcInspectorId` | Technician |
| 14 | `READY_FOR_PICKUP` | `COMPLETED` | SA, Owner, booking's Customer | | Set `completedAt` | |

**Action without status change:** "SA notifies customer vehicle is ready" is an action on `READY_FOR_PICKUP` (sets `readyNotifiedAt`, creates a notification for the customer). Status stays `READY_FOR_PICKUP` until completion.

**Cancellation** (`PENDING` through `PARTS_READY`, i.e. any status before `IN_REPAIR`): allowed for SA, Owner and the booking's Customer. Releases any allocated parts back to stock (idempotent release function).

### 4.2 Rules

1. Invalid transition: reject with `409 INVALID_TRANSITION`.
2. Wrong role or wrong assignee: reject with `403 FORBIDDEN_ACTION`.
3. Every transition writes `BookingHistory(bookingId, fromStatus, toStatus, actorId, note, createdAt)` **in the same DB transaction** as the status change.
4. Every transition creates the notifications listed in 4.1 in the same transaction.
5. Terminal statuses: `COMPLETED`, `CANCELLED`.

### 4.3 Edge cases (all must work)

| Case | Behavior |
|---|---|
| Estimate rejected | `ESTIMATE_REJECTED`; SA can revise (back to `ESTIMATE_REVIEW`, revision +1) or cancel |
| Parts already in stock | `PARTS_PENDING` goes straight to `PARTS_READY` (no PO) |
| Partial delivery | Receiving only some PO items keeps booking in `PARTS_ORDERED`; PO status `PARTIALLY_RECEIVED` |
| QC failure loop | QcIssue recorded, job returns to the **same technician** in `IN_REPAIR`; repeats until pass |
| Slot conflict | Two bookings cannot exceed slot capacity (transaction with row lock or unique constraint) |
| Cancellation | Allowed before `IN_REPAIR`; allocated parts released to stock |
| Two QC users pick same job | Atomic update `WHERE status = QC_PENDING`; second user gets `409` |

---

## 5. Features by Module

### 5.1 Authentication
- Owner sign-up and login; staff login (credentials created by Owner); customer login (email and password given at booking).
- Passwords hashed (bcryptjs). Session via JWT in httpOnly cookie. Role and shop resolved from Membership.
- Customer account reuse: if the email exists and password matches (or user is logged in), reuse; if email exists and password does not match, reject with a clear error. Never create duplicates.

### 5.2 Owner: shops and team
- Create shop: name, address, city, phone, working hours, slot duration, slot capacity, optional logo.
- Add team members with a role (SA, Technician, QC, Parts); edit or deactivate. Deactivated users cannot log in to that shop.
- Create additional shops later; each has independent team, services, slots, inventory.
- Shop switcher in the dashboard.
- Service catalog: name, description, estimated duration, optional base price.
- Overview per shop: bookings by status, team list, inventory summary.

### 5.3 Customer portal
- **Landing page:** hero, grid of all shops (name, city, rating placeholder, services offered), search or city filter.
- **Booking wizard:** shop, services/problems (multi-select plus free text), date and slot, personal details (name, email, password), vehicle details (registration, make, model, year, optional color/mileage), review and confirm. Creates booking in `PENDING`.
- Slot picker shows only available slots for the chosen date and shop.
- **Customer dashboard:** bookings list with live status timeline, pending actions highlighted ("Estimate awaiting your approval"), itemized estimate (parts and labour), accept/reject, ready-for-pickup message, mark pick-up.
- Responsive; works on mobile.

### 5.4 Shop POS dashboards

| Role | Views and actions |
|---|---|
| SA | Bookings list with status filter; confirm/decline; assign technician; review/edit estimate; send to customer; assign parts person; notify ready; complete; notification bell |
| Technician | My assigned jobs; booking and vehicle detail; add estimate lines (part, quantity, unit cost) and labour; submit to SA; start repair; send to QC; view QC issues sent back |
| Parts Person | Inventory table (SKU, name, quantity, reorder level, cost); jobs awaiting parts (required vs available); create PO; receive PO items; allocate parts |
| QC Inspector | Shared QC queue; pick job; checklist/notes; pass, or create issue (title, description) which returns job to technician |
| Owner | Per-shop overview; team; inventory summary; open any role view for support (read) |

### 5.5 Inventory and procurement
- Per-shop parts catalog with quantity on hand and reorder level.
- Required parts (from approved estimate) compared to stock automatically to show shortages.
- Purchase orders with items and status `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`.
- Receiving increases stock; allocation decreases stock and links parts to the booking; cancellation releases allocations.
- All stock mutations run in transactions; stock must never go negative.

### 5.6 Notifications (minimum, in-app)
Bell icon with unread count; mark-as-read. Polling (about 10 s) is enough.

| Event | Who |
|---|---|
| New booking created | SAs of that shop |
| Technician assigned | That technician |
| Estimate submitted by technician | SAs of that shop |
| Estimate sent to customer | Customer |
| Customer accepted or rejected estimate | SAs of that shop |
| Parts needed / parts ready | Parts Person / Technician |
| Sent to QC / QC failed | QC queue (all QC of shop) / Technician |
| Vehicle ready for pickup | Customer |

### 5.7 Estimate rules
- Estimate has `revision` (int), line items (`type` PART or LABOUR, name, quantity, unitCost), and computed `total`.
- SA edits increment `revision` before sending. Sent estimates are locked until rejected and revised.
- Money stored as integer PKR (no floats).

### 5.8 Seed data
Seed script creates: at least **3 shops** (one owned by an owner with 2 shops), a full team per shop (SA, Technician, QC, Parts), service catalog, sample inventory, available slots for the next 14 days, and a few bookings in different statuses so each dashboard has data. Demo credentials are listed in README only (never hard-coded in logic).

---

## 6. Data Model (Prisma sketch)

All ids are `cuid()`. All tables have `createdAt` and `updatedAt`. Shop-owned tables include `shopId` with an index.

```prisma
enum Role { OWNER SERVICE_ADVISOR TECHNICIAN QC_INSPECTOR PARTS_PERSON }

model User {            // staff, owners and customers
  id, name, email @unique, phone?, passwordHash, isCustomer Boolean, isActive Boolean
}
model Shop {
  id, ownerId -> User, name, address, city, phone, logoUrl?,
  workStart String, workEnd String,        // "09:00"
  slotMinutes Int, slotCapacity Int
}
model Membership {      // per-shop role
  id, userId -> User, shopId -> Shop, role Role, isActive Boolean
  @@unique([userId, shopId])
}
model Service {         // per-shop catalog
  id, shopId, name, description?, estMinutes Int, basePrice Int?
}
model Slot {            // generated rows, or computed on read
  id, shopId, startsAt DateTime, capacity Int, booked Int
  @@unique([shopId, startsAt])
}
model Vehicle {
  id, ownerId -> User, regNo, make, model, year Int, color?, mileage Int?
}
model Booking {
  id, shopId, customerId -> User, vehicleId -> Vehicle, slotId -> Slot,
  status BookingStatus, customerNotes?,
  technicianId?, partsPersonId?, qcInspectorId?,
  readyNotifiedAt?, completedAt?
  services BookingService[]
}
model BookingHistory { id, bookingId, fromStatus?, toStatus, actorId, note?, createdAt }
model Estimate { id, bookingId @unique, revision Int, total Int, sentAt?, approvedAt?, rejectedAt? }
model EstimateItem { id, estimateId, type (PART|LABOUR), partId?, name, quantity Int, unitCost Int }
model Part { id, shopId, sku, name, quantity Int, reorderLevel Int, cost Int  @@unique([shopId, sku]) }
model PurchaseOrder { id, shopId, status POStatus, createdById, items PurchaseOrderItem[] }
model PurchaseOrderItem { id, purchaseOrderId, partId, bookingId?, qtyOrdered Int, qtyReceived Int }
model Allocation { id, shopId, bookingId, partId, quantity Int, releasedAt? }
model QcIssue { id, bookingId, raisedById, title, description, createdAt }
model Notification { id, userId, shopId?, bookingId?, type, message, readAt?, createdAt }
```

Rules: `Membership` is the only source of staff roles. `BookingStatus` enum values are exactly the statuses in section 4. Schema changes are made **only by Member A** (see `AGENTS.md`).

---

## 7. API Contract

Conventions:
- Base path `/api`. JSON in and out. Zod validation on every input; schemas live in `src/lib/contracts/`.
- Success: `200/201` with `{ data: ... }`.
- Error: `{ error: { code, message, details? } }` with proper status: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN_ACTION`, `404 NOT_FOUND`, `409 INVALID_TRANSITION | CONFLICT`.
- Shop-scoped routes live under `/api/shops/:shopId/...` and always verify Membership.

| Area | Method and path | Role |
|---|---|---|
| Auth | `POST /auth/owner/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | public / any |
| Public | `GET /public/shops?city=&q=`, `GET /public/shops/:shopId`, `GET /public/shops/:shopId/slots?date=` | public |
| Booking (customer) | `POST /bookings` (wizard confirm, creates account if needed), `GET /me/bookings`, `GET /me/bookings/:id` | customer |
| Customer actions | `POST /me/bookings/:id/estimate/accept`, `.../reject`, `.../pickup`, `.../cancel` | customer |
| Owner | `GET/POST /shops`, `PATCH /shops/:shopId`, `GET/POST /shops/:shopId/team`, `PATCH /shops/:shopId/team/:membershipId`, `GET/POST/PATCH /shops/:shopId/services` | owner |
| Bookings (staff) | `GET /shops/:shopId/bookings?status=`, `GET /shops/:shopId/bookings/:id` | SA, Owner (all); Technician (assigned); QC (queue) |
| Transitions | `POST /shops/:shopId/bookings/:id/transition` body `{ to, note?, payload? }` | per transition table |
| Estimate | `PUT /shops/:shopId/bookings/:id/estimate` (replace lines) | Technician (INSPECTING), SA (ESTIMATE_REVIEW) |
| Inventory | `GET/POST/PATCH /shops/:shopId/parts` | Parts, Owner (read: SA) |
| Shortages | `GET /shops/:shopId/bookings/:id/parts-check` | Parts, SA |
| Purchase orders | `GET/POST /shops/:shopId/purchase-orders`, `POST /shops/:shopId/purchase-orders/:id/receive` body `{ items: [{ itemId, qty }] }` | Parts |
| Allocation | handled inside transition `PARTS_READY -> IN_REPAIR` | Parts |
| QC | `GET /shops/:shopId/qc/queue`, `POST /shops/:shopId/bookings/:id/qc/pick`, `POST .../qc/pass`, `POST .../qc/fail` body `{ title, description }` | QC |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` | any authed |
| Dashboards | `GET /shops/:shopId/overview` | Owner |

Design note: `qc/pick`, `qc/pass`, `qc/fail` and `receive` may be thin wrappers that call `transitionBooking(...)`. The transition function stays the single place where status changes.

---

## 8. Non-Functional Requirements

- **Security:** bcrypt hashing; httpOnly + SameSite cookies; role check on every protected route; tenant isolation enforced server-side; no secrets in repo.
- **Validation:** Zod on all inputs; consistent error shape; correct HTTP codes.
- **Quality:** TypeScript strict; ESLint and Prettier configured; reusable UI components; centralized API client; small commits with meaningful messages.
- **UX:** responsive (mobile first for the customer portal); loading, empty and error states; each role sees only their own work.
- **Reliability:** all multi-row mutations (booking creation with slot, transitions, receive, allocate, cancel-release) in transactions.
- **Performance:** polling interval about 10 s for notifications and dashboards; no WebSockets needed.

---

## 9. Deliverables and Repo Standards

| Deliverable | Requirement |
|---|---|
| GitHub repo | Public; meaningful commit history; organized folders; no committed secrets |
| Live URL | Deployed (Vercel + Supabase); seeded data and demo accounts for every role |
| `README.md` | Overview, stack, prerequisites (exact versions), install, env setup, DB create/migrate/seed, run, tests, demo credentials, deployment notes, architecture summary and design decisions |
| `.env.example` | Every variable, placeholder values, one-line comment each |
| Optional | 3 to 5 min demo video, architecture diagram, OpenAPI/Postman |

`.env.example` baseline:

```
# --- App ---
NODE_ENV=development
APP_URL=http://localhost:3000
# --- Database ---
# Pooled connection for the running app (Supabase pooler, port 6543)
DATABASE_URL=postgresql://user:password@localhost:6543/bayflow?pgbouncer=true
# Direct or session-pooler connection for the Prisma CLI / migrations (port 5432)
DIRECT_URL=postgresql://user:password@localhost:5432/bayflow
# Tests only
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/bayflow_test
# --- Auth ---
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
# --- Email (optional) ---
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
# --- Bonus: calling / AI (leave blank if not used) ---
CALL_PROVIDER_API_KEY=
LLM_API_KEY=
STT_TTS_API_KEY=
```

---

## 10. Definition of Done

Core is done when **all** of these are true on the **live URL** using seeded accounts:

- [ ] A customer books through the wizard and the booking appears as `PENDING` on the SA dashboard.
- [ ] The full flow reaches `COMPLETED`: confirm, assign, inspect, estimate, SA review, send, customer approves, parts, repair, QC, ready, complete.
- [ ] The **estimate-rejected** path works (revise and resend, or cancel).
- [ ] The **QC-fail loop** works (issue recorded, job returns to the same technician, repeats until pass).
- [ ] Parts-in-stock shortcut and partial-delivery behavior work.
- [ ] Slot capacity cannot be exceeded; two QC users cannot pick the same job.
- [ ] A Shop A staff token gets 403/404 for Shop B data (automated test).
- [ ] No role can perform another role's action (automated tests on the transitions table).
- [ ] One owner can run multiple shops with a shop switcher.
- [ ] Notifications fire for all 8 events with an unread-count bell.
- [ ] Seed script produces 3+ shops, teams for every role, inventory, slots.
- [ ] README and `.env.example` let a stranger run it; no secrets in repo; commit history is meaningful.
- [ ] Every team member can explain their code and the state machine.

---

## 11. Work Breakdown and Ownership

Hours counted from now (H0). H20 = target submission. Sync points at **H5, H10, H15**.

| Member | Role | Owns |
|---|---|---|
| **A** | Core / backend lead | Prisma schema and migrations, auth, tenancy helper, state machine and audit log, notifications API, Owner module, tests, CI, deployment |
| **B** | Customer + advisor lead | Landing page, booking wizard, slot engine, booking creation and customer accounts, customer dashboard, SA dashboard, notification bell, README, `.env.example` |
| **C** | Shop-floor lead | Technician dashboard and estimate lines, inventory, POs and Parts dashboard, QC queue and issue loop, seed script |

| Block | A | B | C |
|---|---|---|---|
| H0 to 1.5 | Repo, schema draft, transitions table, Supabase + Vercel | SPEC and contract review, design tokens, layout shell | Task list, shop-floor screens, inventory/PO model |
| H1.5 to 5 | Auth, Membership, `withShopScope`, transition engine, audit log, hello-world deploy | Landing page, wizard UI, slot logic (typed mocks) | Inventory/PO services, Technician and Parts UI (typed mocks) |
| **H5 Sync 1** | Merge auth, tenancy, engine; seed one owner and shop | Wire wizard to real endpoints | Wire dashboards to real endpoints |
| H5 to 10 | Owner module, notifications API, estimate endpoints | Booking creation (slot transaction), customer dashboard, SA dashboard (confirm, assign, review, send) | Technician flow, estimate lines, inventory table, shortage check, create PO |
| **H10 Sync 2** | End to end up to estimate approval | Same flow, customer and SA side | Same flow, technician side |
| H10 to 15 | Remaining transitions, cancellation and release, tenant isolation tests | SA parts assign, notify ready, complete; customer pickup; bell wired to 8 events | Receive PO, allocate, in-stock shortcut, QC queue, lock, pass/fail loop |
| **H15 Sync 3** | Full lifecycle live incl. QC-fail and estimate-rejected | Same, customer and SA side | Same, shop-floor side |
| H15 to 18 | Transition unit tests, guards, Owner overview, CI | Mobile pass, empty/loading states, README draft | Seed script final, QC and parts UX polish |
| H18 to 20 | Code freeze, final deploy, judge checklist | README final, demo accounts, optional demo video | Fresh-DB seed test on production, bug fixes only |

Suggested sleep windows (staggered, everyone on keyboard from H17): B H9 to 13, C H12 to 16, A H14 to 17.

---

## 12. Decision Log

Record each key decision with a one-line rationale. Add new rows via PR.

| ID | Decision | Rationale |
|---|---|---|
| D-001 | Next.js (App Router) + TypeScript monolith | One repo, one deploy; fastest path to a live URL for three people |
| D-002 | PostgreSQL (Supabase) + Prisma | Relational data; transactions for slots, stock, PO receiving; Supabase used as managed Postgres only |
| D-003 | State machine as data (transitions table) + single `transitionBooking` function | Meets the "reject invalid transitions" requirement and is easy to unit test |
| D-004 | Polling (about 10 s) instead of WebSockets | Meets "in-app notifications" with far less risk |
| D-005 | One role per Membership | Simpler permissions; brief allows it |
| D-006 | Allocation (stock deduct) happens atomically with `PARTS_READY -> IN_REPAIR`; release function is idempotent | Brief says allocate then repair and cancel before repair; keeps stock consistent |
| D-007 | `ESTIMATE_REJECTED -> ESTIMATE_REVIEW or CANCELLED` | Brief names the status but not its exits; matches "SA can revise or cancel" |
| D-008 | Money as integer PKR | Avoids floating point errors |
| D-009 | Only Member A edits `schema.prisma` and the transitions table | Prevents migration and logic conflicts across three parallel workers |
| D-010 | Bonus (calling, AI Front Desk) only after Sync 3 passes with 3+ hours of margin | Bonus is 10% and counts only if core works |
| D-011 | Supabase accessed only via Prisma on the server (no supabase-js, anon key or Supabase Auth); RLS enabled with no policies | Tenant isolation is enforced in our own service layer; avoids an unintended second access path via PostgREST |
| D-012 | npm as package manager | Team preference; scripts and commands in AGENTS.md use npm |
| D-013 | Estimate PART lines with a `partId` participate in stock checks; custom lines without `partId` are not stock-tracked | Lets technicians quote one-off items without blocking the parts flow |
| D-014 | Seed is modular under `prisma/seed/`; Member C owns the index `prisma/seed.ts` | Each member seeds their own module without merge conflicts |
| D-015 | Transition side effects live in an effects registry (`registerEffect('FROM->TO', fn)`); engine and `transitions.ts` stay with A | Lets C implement parts and QC effects without editing frozen files |
| D-016 | Prisma 7: `prisma-client` generator with output `src/generated/prisma`, `prisma.config.ts` reads `DIRECT_URL` for the CLI, runtime uses `DATABASE_URL` via `@prisma/adapter-pg` | Matches current Prisma docs for Supabase pooling; avoids migrate-through-pooler errors |
| D-017 | Each member develops against their own local Postgres (Docker); Supabase is the live database only | Prevents migration and test-data collisions between three parallel developers |

### 12.1 Open questions (resolve at kickoff)

- Slot generation: pre-generated rows (seed plus cron) or computed on read from working hours? Default: **computed on read, materialized on first booking**.
- Customer login with an existing email but wrong password: block with error (default) vs. offer login. Default: **block with error**.
- Owner acting as other roles for support: **read-only views only** (default).
