import { z } from "zod";
import { IdSchema, POStatusEnum } from "./common";

export const CreatePartRequestSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  quantity: z.number().int().nonnegative("Quantity cannot be negative").default(0),
  reorderLevel: z.number().int().nonnegative().default(0),
  cost: z.number().int().nonnegative("Cost must be non-negative PKR"),
});
export type CreatePartRequest = z.infer<typeof CreatePartRequestSchema>;

export const UpdatePartRequestSchema = CreatePartRequestSchema.partial();
export type UpdatePartRequest = z.infer<typeof UpdatePartRequestSchema>;

export const PartSchema = z.object({
  id: IdSchema,
  shopId: IdSchema,
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  reorderLevel: z.number().int(),
  cost: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Part = z.infer<typeof PartSchema>;

export const CreatePOItemSchema = z.object({
  partId: IdSchema,
  bookingId: z.string().nullable().optional(),
  qtyOrdered: z.number().int().positive("Ordered quantity must be positive"),
});
export type CreatePOItem = z.infer<typeof CreatePOItemSchema>;

export const CreatePurchaseOrderRequestSchema = z.object({
  items: z.array(CreatePOItemSchema).min(1, "PO must contain at least one item"),
});
export type CreatePurchaseOrderRequest = z.infer<typeof CreatePurchaseOrderRequestSchema>;

export const ReceivePOItemInputSchema = z.object({
  itemId: IdSchema,
  qty: z.number().int().positive("Received quantity must be positive"),
});

export const ReceivePurchaseOrderRequestSchema = z.object({
  items: z.array(ReceivePOItemInputSchema).min(1, "Must receive at least one item"),
});
export type ReceivePurchaseOrderRequest = z.infer<typeof ReceivePurchaseOrderRequestSchema>;

export const PurchaseOrderItemSchema = z.object({
  id: IdSchema,
  purchaseOrderId: IdSchema,
  partId: IdSchema,
  bookingId: z.string().nullable().optional(),
  qtyOrdered: z.number().int(),
  qtyReceived: z.number().int(),
  part: z.object({
    id: IdSchema,
    name: z.string(),
    sku: z.string(),
  }).optional(),
});
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>;

export const PurchaseOrderSchema = z.object({
  id: IdSchema,
  shopId: IdSchema,
  status: POStatusEnum,
  createdById: IdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(PurchaseOrderItemSchema),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

export const PartsCheckItemSchema = z.object({
  partId: IdSchema,
  name: z.string(),
  sku: z.string(),
  requiredQty: z.number().int(),
  availableQty: z.number().int(),
  shortage: z.number().int().nonnegative(),
});
export type PartsCheckItem = z.infer<typeof PartsCheckItemSchema>;

export const PartsCheckResponseSchema = z.object({
  bookingId: IdSchema,
  hasShortage: z.boolean(),
  items: z.array(PartsCheckItemSchema),
});
export type PartsCheckResponse = z.infer<typeof PartsCheckResponseSchema>;
