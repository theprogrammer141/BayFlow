import { z } from "zod";
import { RoleEnum, IdSchema } from "./common";

export const OwnerSignupRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  shopName: z.string().min(1, "Shop name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  shopPhone: z.string().min(1, "Shop phone is required"),
  workStart: z.string().default("09:00"),
  workEnd: z.string().default("18:00"),
  slotMinutes: z.number().int().positive().default(60),
  slotCapacity: z.number().int().positive().default(2),
  logoUrl: z.string().url().optional(),
});
export type OwnerSignupRequest = z.infer<typeof OwnerSignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const MembershipSchema = z.object({
  id: IdSchema,
  shopId: IdSchema,
  role: RoleEnum,
  isActive: z.boolean(),
  shop: z
    .object({
      id: IdSchema,
      name: z.string(),
    })
    .optional(),
});
export type MembershipDto = z.infer<typeof MembershipSchema>;

export const AuthUserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  isCustomer: z.boolean(),
  memberships: z.array(MembershipSchema),
});
export type AuthUserDto = z.infer<typeof AuthUserSchema>;

export const AuthResponseSchema = z.object({
  user: AuthUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
