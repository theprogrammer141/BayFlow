import { NextResponse } from "next/server";
import { handle } from "@/lib/api-handler";
import { OwnerSignupRequestSchema } from "@/lib/contracts/auth";
import { ownerSignup } from "@/lib/services/auth";
import { attachAuthCookie } from "@/lib/auth/cookies";

export const POST = handle(
  async ({ body }) => {
    const { user, token } = await ownerSignup(body);
    const response = NextResponse.json({ data: { user } }, { status: 201 });
    attachAuthCookie(response, token);
    return response;
  },
  {
    schema: {
      body: OwnerSignupRequestSchema,
    },
    status: 201,
  }
);
