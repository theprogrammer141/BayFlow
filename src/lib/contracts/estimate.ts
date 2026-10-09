import { z } from "zod";
import { EstimateItemTypeEnum, IdSchema } from "./common";

export const EstimateItemInputSchema = z.object({
  type: EstimateItemTypeEnum,
  partId: z.string().nullable().optional(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.number().int().nonnegative("Unit cost must be non-negative PKR"),
});
export type EstimateItemInput = z.infer<typeof EstimateItemInputSchema>;

export const SaveEstimateRequestSchema = z.object({
  items: z.array(EstimateItemInputSchema).min(1, "At least one item is required"),
});
export type SaveEstimateRequest = z.infer<typeof SaveEstimateRequestSchema>;

export const EstimateItemSchema = z.object({
  id: IdSchema,
  estimateId: IdSchema,
  type: EstimateItemTypeEnum,
  partId: z.string().nullable().optional(),
  name: z.string(),
  quantity: z.number().int(),
  unitCost: z.number().int(),
});
export type EstimateItem = z.infer<typeof EstimateItemSchema>;

export const EstimateSchema = z.object({
  id: IdSchema,
  bookingId: IdSchema,
  revision: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  sentAt: z.string().datetime().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  rejectedAt: z.string().datetime().nullable().optional(),
  items: z.array(EstimateItemSchema),
});
export type Estimate = z.infer<typeof EstimateSchema>;
