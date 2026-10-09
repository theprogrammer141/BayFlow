import { NextResponse } from "next/server";
import { handle } from "@/lib/api-handler";
import { CreateBookingRequestSchema } from "@/lib/contracts/booking";
import { createCustomerBooking } from "@/lib/services/bookings";
import { attachAuthCookie } from "@/lib/auth/cookies";

export const POST = handle(
  async ({ body }) => {
    const { booking, customer, token } = await createCustomerBooking(body);
    const response = NextResponse.json(
      { data: { booking, user: customer, token } },
      { status: 201 }
    );
    attachAuthCookie(response, token);
    return response;
  },
  {
    requireAuth: false,
    schema: {
      body: CreateBookingRequestSchema,
    },
  }
);
