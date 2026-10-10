# Phase 05 — Technician Dashboard and Estimate Builder

**Goal.** A technician can see their assigned jobs, inspect vehicles, prepare repair estimates, carry out repairs, and send completed work to QC.

The estimate API is provided by Phase 02. This phase builds the technician-facing workflow around it.

## Build

- **My jobs.** Show bookings assigned to the signed-in technician, with booking details, vehicle information, and customer notes. The API and UI both enforce assignment scope; hiding another technician’s jobs in the interface is not sufficient.

- **Inspection.** Starting an assigned job moves it from `ASSIGNED` to `INSPECTING` through the central booking transition function.

- **Estimate builder.** Add `PART` lines using a catalog part when available, or a custom text line without a `partId`. Each line carries a quantity and unit cost. Support `LABOUR` lines and show a live subtotal preview. The server remains responsible for validating the estimate and calculating its total.

- **Submit for review.** An estimate must contain at least one line before it can be submitted. Submission moves the booking from `INSPECTING` to `ESTIMATE_REVIEW`, where the service advisor can review it.

- **Repair and QC return.** The repair view shows QC issues returned to the technician, including each issue’s title, description, and history. Once the repair is ready for another inspection, the technician moves the booking from `IN_REPAIR` to `QC_PENDING`.

- **Seed data.** Add `prisma/seed/technician.ts` with assigned bookings in `ASSIGNED`, `INSPECTING`, and `IN_REPAIR`, so the main technician workflows can be tested without manually creating every scenario.

## Constraints

- **Assignment is an authorization boundary.** A technician must never retrieve or access another technician’s bookings, even by requesting an endpoint directly.

- **The transition function owns booking status changes.** The UI requests transitions; it does not update booking status directly. This keeps role permissions, valid transitions, history, and side effects consistent.

- **The server owns estimate validity and totals.** A live subtotal is useful feedback, but it cannot replace server-side validation. Empty estimates must be rejected.

- **Inventory remains a separate responsibility.** Phase 05 can prepare for catalog integration, but stock checks, purchase orders, and allocation belong to Phase 06. The catalog part picker should integrate with the Phase 06 API once it is available.

- **QC remains a separate workflow.** This phase must display returned QC issues and support resubmitting repaired work, but it does not build the QC dashboard or inspection controls.

## Acceptance check

1. Sign in as a technician and confirm that only bookings assigned to that technician appear. Attempt to access another technician’s booking through the API and confirm access is denied.
2. Start an assigned job and verify the transition from `ASSIGNED` to `INSPECTING`.
3. Build an estimate with part and labour lines. Confirm the subtotal updates, and that submitting an estimate with no lines is rejected.
4. Submit a valid estimate and confirm the booking enters `ESTIMATE_REVIEW`.
5. Return a booking from QC with an issue. Confirm it appears in `IN_REPAIR` with the issue details and history visible to the assigned technician.
6. Confirm the catalog part picker integrates with the Phase 06 API when that API is available.

## Not in this phase

Inventory management, purchase orders, stock allocation, and the QC dashboard. These remain in Phases 06 and 07 respectively.

## Implementation workflow

1. Read `AGENTS.md`, the relevant sections of `project-doc.md` (4.1, 5.4, 5.7, and 7), and this phase document.
2. Post an implementation plan of no more than 15 lines, then build the phase in the order described above.
3. After each sub-part, run `npm run lint && npm run typecheck && npm test`. Commit the completed work before moving to the next sub-part.
4. If implementation requires changes to files frozen or shared under section 5 of `AGENTS.md`, stop and request human approval before proceeding.
5. Verify the acceptance checks and report only results supported by commands actually run.

Finish with a phase report covering **Done**, **Verified** (commands and results), **Gaps and spec questions**, and **Handoff notes**.
