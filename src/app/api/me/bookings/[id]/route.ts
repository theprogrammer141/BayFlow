import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerBookingById } from "@/lib/services/bookings";

const ParamsSchema = z.object({
  id: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    return getCustomerBookingById(authUser.id, params.id);
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);
