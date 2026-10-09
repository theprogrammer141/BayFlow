import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { AddTeamMemberRequestSchema } from "@/lib/contracts/shop";
import { getTeamMembers, addTeamMember } from "@/lib/services/shops";

const ParamsSchema = z.object({
  shopId: z.string().min(1),
});

export const GET = handle(
  async ({ user, params }) => {
    const authUser = requireAuth(user);
    return getTeamMembers(authUser, params.shopId);
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
    },
  }
);

export const POST = handle(
  async ({ user, params, body }) => {
    const authUser = requireAuth(user);
    const membership = await addTeamMember(authUser, params.shopId, body);
    return membership;
  },
  {
    requireAuth: true,
    status: 201,
    schema: {
      params: ParamsSchema,
      body: AddTeamMemberRequestSchema,
    },
  }
);
