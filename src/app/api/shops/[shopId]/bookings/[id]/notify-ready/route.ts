import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { notifyBookingReady } from "@/lib/services/bookings";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const POST = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const updated = await notifyBookingReady(
      authUser,
      params.shopId,
      params.id
    );
    return updated;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
