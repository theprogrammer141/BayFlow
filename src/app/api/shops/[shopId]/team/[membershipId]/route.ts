import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { UpdateTeamMemberRequestSchema } from "@/lib/contracts/shop";
import { updateTeamMember } from "@/lib/services/shops";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
  membershipId: z.string().min(1),
});

export const PATCH = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const updated = await updateTeamMember(
      authUser,
      params.shopId,
      params.membershipId,
      body
    );
    return updated;
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: UpdateTeamMemberRequestSchema,
    },
  }
);
