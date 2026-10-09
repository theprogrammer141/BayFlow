import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { requireMembership } from "@/lib/tenancy/membership";
import { TransitionBookingRequestSchema } from "@/lib/contracts/booking";
import { transitionBooking } from "@/lib/services/booking-state";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const POST = handle(
  async ({ user, body, params }) => {
    const authUser = requireAuth(user);
    const { shopId, id: bookingId } = params;

    // Verify membership in shop
    requireMembership(authUser, shopId);

    // Verify booking belongs to this shop
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { shopId: true },
    });

    if (!booking || booking.shopId !== shopId) {
      throw new NotFoundError("Booking not found in this shop");
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
