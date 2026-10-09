import { z } from "zod";
import { IdSchema } from "./common";

export const PublicShopsQuerySchema = z.object({
  city: z.string().optional(),
  q: z.string().optional(),
});
export type PublicShopsQuery = z.infer<typeof PublicShopsQuerySchema>;

export const PublicServiceItemSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  estMinutes: z.number().int().positive(),
  basePrice: z.number().int().nonnegative().nullable().optional(),
});
export type PublicServiceItem = z.infer<typeof PublicServiceItemSchema>;

export const PublicShopSchema = z.object({
  id: IdSchema,
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string(),
  logoUrl: z.string().nullable().optional(),
  workStart: z.string(),
  workEnd: z.string(),
  slotMinutes: z.number().int().positive(),
  slotCapacity: z.number().int().positive(),
  services: z.array(PublicServiceItemSchema).optional(),
});
export type PublicShop = z.infer<typeof PublicShopSchema>;

export const PublicSlotsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD"),
});
export type PublicSlotsQuery = z.infer<typeof PublicSlotsQuerySchema>;

export const PublicSlotSchema = z.object({
  id: IdSchema,
  shopId: IdSchema,
  startsAt: z.string(),
  capacity: z.number().int(),
  booked: z.number().int(),
  available: z.boolean(),
});
export type PublicSlot = z.infer<typeof PublicSlotSchema>;
