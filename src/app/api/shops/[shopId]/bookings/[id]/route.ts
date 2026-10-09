import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getShopBookingById } from "@/lib/services/bookings";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  id: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    const booking = await getShopBookingById(
      authUser,
      params.shopId,
      params.id
    );
    return booking;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
