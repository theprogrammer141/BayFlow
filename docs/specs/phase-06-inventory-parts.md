# Phase 06 — Inventory, Purchase Orders and Parts Dashboard

**Goal.** The parts person can manage shop inventory, identify shortages for approved estimates, create purchase orders, receive parts partially or fully, and allocate parts to repair jobs without allowing stock to become inconsistent.

## Build

### 6.1 Parts catalog

- **Inventory API.** Implement `GET`, `POST`, and `PATCH /shops/:shopId/parts`. Each part has a SKU unique within its shop, quantity, reorder level, and cost.
- **Inventory dashboard.** Show parts in a searchable table and highlight low-stock items.

### 6.2 Shortage check

- **Estimate requirements.** Implement `GET /shops/:shopId/bookings/:id/parts-check` to compare required quantities with available stock for estimate lines that have a `partId`.
- **Custom lines.** Estimate lines without a `partId` are not stock-tracked, as specified by decision D-013.

### 6.3 Purchase orders

- **Create and track orders.** Allow purchase orders to be created from shortages, with items linked to the relevant booking. Support listing purchase orders and the statuses `ORDERED`, `PARTIALLY_RECEIVED`, and `RECEIVED`.
- **Booking transitions.** Register the `PARTS_PENDING → PARTS_ORDERED` effect to create a purchase order. Allow `PARTS_PENDING → PARTS_READY` only when all required parts are in stock.
- **Effects.** Implement these rules in `src/lib/state/effects/parts.ts` using the existing transition and effects registry.

### 6.4 Receiving

- **Receive parts.** Implement the purchase-order receiving endpoint with the payload `{ items: [{ itemId, qty }] }`. Receiving must update stock, each item's `qtyReceived`, and the purchase-order status in a single transaction.
- **Handle partial and full receipts.** Partial receipts keep the booking in `PARTS_ORDERED`. Once all parts required for the booking have been fully received, transition it from `PARTS_ORDERED` to `PARTS_READY` through `transitionBooking`.

### 6.5 Allocation and release

- **Allocate stock.** When a booking transitions from `PARTS_READY` to `IN_REPAIR`, deduct the required stock and create the corresponding `Allocation` records in the same transaction. Reject the transition if allocation would make stock negative.
- **Release allocations.** Expose an idempotent `releaseAllocations(tx, bookingId)` function so the cancellation effect owned by Member A can safely release allocated stock.

### 6.6 Parts dashboard

- **Jobs awaiting parts.** Show required versus available quantities for each tracked estimate line, the job's current status, and the parts still needed.
- **Parts workflow.** Provide actions to create purchase orders, receive deliveries, and allocate parts when the job is ready.

## Constraints

- **Stock consistency is mandatory.** Receiving, allocation, and release must preserve inventory invariants. Stock must never become negative, and allocations must not deduct the same stock twice.
- **Transactions protect related updates.** Stock changes, purchase-order receiving quantities, allocation records, and associated status changes must remain consistent if an operation fails.
- **Booking status changes use the central transition function.** The parts effects must be registered with the engine and must not bypass `transitionBooking`.
- **Shop tenancy is an authorization boundary.** Parts staff can access inventory and purchase orders only within their shop. Other roles must not be able to mutate stock.
- **Notifications and estimate editing are outside this phase.** The parts workflow consumes existing estimate lines; it does not add notification UI or estimate-editing capabilities.

## Acceptance check

1. **In-stock job.** Confirm a booking can move from `PARTS_PENDING` to `PARTS_READY` without creating a purchase order when all required parts are available.
2. **Partial receipt.** Receive only part of a purchase order and confirm the PO becomes `PARTIALLY_RECEIVED` while the booking remains `PARTS_ORDERED`.
3. **Full receipt.** Receive all outstanding items and confirm the PO becomes `RECEIVED` and the booking moves to `PARTS_READY` when all required parts for that booking are available.
4. **Allocation and release.** Confirm moving a booking into `IN_REPAIR` deducts stock exactly once. Confirm stock cannot become negative and releasing allocations restores stock safely, including when the release function is called more than once.
5. **Shop isolation.** Confirm parts staff can access only their shop's inventory and purchase orders, and other roles cannot mutate stock.
6. **Regression tests.** Verify stock invariants for receiving, allocation, release, partial receipts, and shop-tenancy enforcement.

## Deliverables

- Inventory, purchase-order, and allocation services and endpoints.
- `src/lib/state/effects/parts.ts`.
- Parts dashboard.
- Seed module: `prisma/seed/inventory.ts`.

## Handoff

Provide Member A with the registered effect keys and the exact `releaseAllocations(tx, bookingId)` signature so the cancellation effect can release stock safely.

## Implementation workflow

1. Read `AGENTS.md`, the relevant sections of `project-doc.md` (5.4, 5.5, 4.1, 4.3, and 7), and this phase document.
2. Post an implementation plan of no more than 15 lines that confirms the sub-part split above. Merge or split sub-parts only when necessary, with a one-line reason for each change.
3. Implement one sub-part at a time. After each sub-part, run `npm run lint && npm run typecheck && npm test`. Commit the completed sub-part using a conventional commit message before starting the next. Do not proceed while any required check is failing.
4. If implementation requires changes to files frozen or shared under section 5 of `AGENTS.md`, stop and request human approval before proceeding.
5. Verify every acceptance check and report only results supported by commands actually run.

Finish with a phase report covering **Done**, **Verified** (commands and results), **Gaps and spec questions**, and **Handoff notes**.

## Not in this phase

Notifications UI and estimate editing. These remain outside Phase 06.
