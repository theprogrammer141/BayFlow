import { NextResponse } from "next/server";
import { handle } from "@/lib/api-handler";
import { clearAuthCookie } from "@/lib/auth/cookies";

export const POST = handle(async () => {
  const response = NextResponse.json({ data: { success: true } }, { status: 200 });
  clearAuthCookie(response);
  return response;
});
