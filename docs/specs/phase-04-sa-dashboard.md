# Phase 04: Service Advisor Dashboard

| | |
|---|---|
| **Owner** | Member B |
| **Window** | H8 to H13 |
| **Depends on** | Phase 01, 02 (estimate), 03 (bookings exist) |
| **Unblocks** | Phase 09 |
| **Size** | Large |
| **Spec references** | project-doc.md sections 5.4 (SA row), 4.1 (rows 1, 2, 5, 6c, 6d, 7, 14), 7 |

## Goal

The advisor can run a booking from `PENDING` through estimate review, parts assignment, ready notification and completion.

## Scope

**In scope**

- SA list and detail views and every SA action

**Out of scope**

- Technician, parts and QC screens

## Sub-parts (build in this order)

### 4.1 Bookings list and detail

- `GET /shops/:shopId/bookings?status=` list with status filter chips and counts
- Detail view: customer, vehicle, services, notes, estimate, `BookingHistory` timeline

### 4.2 Intake actions

- Confirm, decline (cancel with note), assign technician (active technicians of this shop)

### 4.3 Estimate review

- Editable lines (add, edit, remove; revision count visible), recomputed total from server, send to customer
- Rejected estimate: revise (back to review with technician) or cancel

### 4.4 Post-approval and closing

- Assign parts person; notify customer ready (sets `readyNotifiedAt`, creates notification); complete booking
- Cancel allowed before `IN_REPAIR`

## Deliverables

- SA dashboard pages and components

## Acceptance criteria

- [ ] SA sees all bookings of own shop only; filters by status work
- [ ] Every SA action is available only in the correct status and is rejected by the API otherwise
- [ ] Estimate edits show an incremented revision; sent estimates are read-only
- [ ] Rejected-estimate path works end to end from the SA side

## Tests required

- Component-level test for status-to-actions mapping
- API role-guard test for each SA transition

## Handoff

Confirm to A (Phase 09) which SA flows were verified on the live URL.

## Agent workflow (follow exactly)

This phase is **Large**. Do not build it in one pass.

1. Read `AGENTS.md`, `project-doc.md` (sections listed above) and this file.
2. Post a plan of at most 15 lines that **confirms the sub-part split below** (you may merge or split parts, with a one-line reason each).
3. **Build part by part.** For each sub-part: implement, run `npm run lint && npm run typecheck && npm test`, commit with a conventional message, then (and only then) start the next sub-part. Never start a sub-part while the previous one is red.
4. If the plan touches frozen or shared files (AGENTS.md section 5), stop and wait for human approval; otherwise proceed.
5. Verify every acceptance criterion below. Do not claim a result you did not run.
6. Finish with the **phase report**: Done / Verified (commands and results) / Gaps and spec questions / Handoff notes.
