import { registerEffect } from "./registry";
import { ValidationError } from "@/lib/errors";

/**
 * QC Transition Effects
 * Row 13b: QC_IN_PROGRESS -> IN_REPAIR
 *
 * Requirements (Phase 07):
 * - Requires title & description
 * - Creates a QcIssue record linked to booking and actor (the inspector)
 * - Clears qcInspectorId
 * - Booking returns to IN_REPAIR for the same technician (technicianId remains unchanged)
 */
registerEffect("QC_IN_PROGRESS->IN_REPAIR", async (tx, ctx) => {
  const title = (ctx.payload?.title as string | undefined)?.trim();
  const description =
    (ctx.payload?.description as string | undefined)?.trim() ??
    ctx.note?.trim();

  if (!title || !description) {
    throw new ValidationError(
      "Issue title and description are required for QC return"
    );
  }

  await tx.qcIssue.create({
    data: {
      bookingId: ctx.booking.id,
      raisedById: ctx.actor.id,
      title,
      description,
    },
  });

  await tx.booking.update({
    where: { id: ctx.booking.id },
    data: { qcInspectorId: null },
  });
});
