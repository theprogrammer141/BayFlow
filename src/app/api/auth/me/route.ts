import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { getMe } from "@/lib/services/auth";

export const GET = handle(
  async ({ user }) => {
    const authedUser = requireAuth(user);
    const me = await getMe(authedUser.id);
    return { user: me };
  },
  {
    requireAuth: true,
  }
);
