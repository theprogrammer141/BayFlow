import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerBookings } from "@/lib/services/bookings";

export const GET = handle(
  async ({ user }) => {
    const authUser = requireAuth(user);
    return getCustomerBookings(authUser.id);
  },
  {
    requireAuth: true,
  }
);
