# Phase 07 — QC Queue and Issue Loop

**Goal.** QC inspectors share a queue where the first inspector to pick a job locks it. Failed inspections return the job to the same technician with a recorded issue, and the inspection cycle can repeat until the job passes.

## Build

- **QC queue.** Implement `GET /shops/:shopId/qc/queue` to return bookings in `QC_PENDING` for the inspector's shop.
- **Pick lock.** Implement `POST .../qc/pick` using a conditional update that sets `qcInspectorId` and moves the booking from `QC_PENDING` to `QC_IN_PROGRESS`. If no row is updated, return `409 Conflict`.
- **Pass inspection.** Implement `POST .../qc/pass` to move the booking to `READY_FOR_PICKUP`. Only the inspector who picked the job can pass it.
- **Fail inspection.** Implement `POST .../qc/fail`, requiring `{ title, description }`. Create a `QcIssue`, clear `qcInspectorId`, and return the booking to `IN_REPAIR` for the same technician. Implement the effects in `src/lib/state/effects/qc.ts`.
- **QC dashboard.** Show job details, vehicle and estimate information, a checklist, notes, pass/fail forms, and issue history.
- **Seed data.** Add `prisma/seed/qc.ts` with bookings in `QC_PENDING` and `QC_IN_PROGRESS`.

## Constraints

- **Picking must be atomic.** If two inspectors pick the same job, exactly one succeeds and the other receives `409`.
- **Inspector ownership is enforced server-side.** Only the inspector who picked a job can pass or fail it.
- **Issues must be recorded.** A failed inspection requires both a title and description and returns the booking to the same technician.
- **The workflow must be repeatable.** A repaired job can return for QC, fail again, and eventually pass without breaking issue history.
- **Shop isolation is mandatory.** Inspectors can only access QC jobs belonging to their shop.

## Acceptance check

1. Have two inspectors attempt to pick the same job concurrently. Confirm exactly one succeeds and the other receives `409`.
2. Submit a failed inspection without a title or description and confirm it is rejected.
3. Fail a job, return it to the technician for repair, and submit it for QC again. Confirm the job can fail twice and then pass successfully.
4. Confirm only the inspector who picked the job can pass or fail it.
5. Confirm inspectors cannot access QC jobs belonging to another shop.

## Not in this phase

The technician repair UI, which is covered by Phase 05.
