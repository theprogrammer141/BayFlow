import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { BookingStatusEnum } from "@/lib/contracts/common";
import { getShopBookings } from "@/lib/services/bookings";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

const QuerySchema = z.object({
  status: BookingStatusEnum.optional(),
});

export const GET = handle(
  async ({ user, params, query }) => {
    const authUser = requireAuth(user);
    const result = await getShopBookings(authUser, params.shopId, {
      status: query?.status,
    });
    return result;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      query: QuerySchema,
    },
  }
);
