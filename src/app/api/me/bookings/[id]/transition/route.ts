import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { TransitionBookingRequestSchema } from "@/lib/contracts/booking";
import { transitionBooking } from "@/lib/services/booking-state";
import { db } from "@/lib/db";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

const ParamsSchema = z.object({
  id: z.string().min(1),
});

export const POST = handle(
  async ({ user, body, params }) => {
    const authUser = requireAuth(user);
    const bookingId = params.id;

    // Verify booking ownership
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { customerId: true },
    });

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    if (booking.customerId !== authUser.id) {
      throw new ForbiddenError("Not authorized to transition this booking");
    }

    const result = await transitionBooking({
      bookingId,
      to: body.to,
      actor: authUser,
      note: body.note,
      payload: body.payload,
    });

    return result;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: TransitionBookingRequestSchema,
    },
  }
);
