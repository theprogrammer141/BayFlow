import { z } from "zod";
import { handle } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth/guards";
import { CreatePartRequestSchema, UpdatePartRequestSchema } from "@/lib/contracts/inventory";
import { createPart, listParts } from "@/lib/services/inventory";

const ParamsSchema = z.object({ shopId: z.string().min(1) });

export const GET = handle(
  async ({ user, params }) => listParts(requireAuth(user), params.shopId),
  { requireAuth: true, schema: { params: ParamsSchema } }
);

export const POST = handle(
  async ({ user, params, body }) => createPart(requireAuth(user), params.shopId, body),
  { requireAuth: true, status: 201, schema: { params: ParamsSchema, body: CreatePartRequestSchema } }
);

export const PATCH = handle(
  async ({ user, params, body }) => {
    const partId = body.id;
    return import("@/lib/services/inventory").then(({ updatePart }) =>
      updatePart(requireAuth(user), params.shopId, partId, body.data)
    );
  },
  {
    requireAuth: true,
    schema: {
      params: ParamsSchema,
      body: z.object({ id: z.string().min(1), data: UpdatePartRequestSchema }),
    },
  }
);
