import { NextResponse } from "next/server";
import { handle } from "@/lib/api-handler";
import { LoginRequestSchema } from "@/lib/contracts/auth";
import { login } from "@/lib/services/auth";
import { attachAuthCookie } from "@/lib/auth/cookies";

export const POST = handle(
  async ({ body }) => {
    const { user, token } = await login(body);
    const response = NextResponse.json({ data: { user } }, { status: 200 });
    attachAuthCookie(response, token);
    return response;
  },
  {
    schema: {
      body: LoginRequestSchema,
    },
  }
);
