import { z } from "zod";

// ID Schema (cuid format or non-empty string)
export const IdSchema = z.string().min(1, "ID cannot be empty");

// Mirrored Prisma Enums
export const RoleEnum = z.enum([
  "OWNER",
  "SERVICE_ADVISOR",
  "TECHNICIAN",
  "QC_INSPECTOR",
  "PARTS_PERSON",
]);
export type Role = z.infer<typeof RoleEnum>;

export const ActorRoleEnum = z.enum([
  "OWNER",
  "SERVICE_ADVISOR",
  "TECHNICIAN",
  "QC_INSPECTOR",
  "PARTS_PERSON",
  "CUSTOMER",
]);
export type ActorRole = z.infer<typeof ActorRoleEnum>;

export const BookingStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "ASSIGNED",
  "INSPECTING",
  "ESTIMATE_REVIEW",
  "AWAITING_CUSTOMER",
  "ESTIMATE_APPROVED",
  "ESTIMATE_REJECTED",
  "PARTS_PENDING",
  "PARTS_ORDERED",
  "PARTS_READY",
  "IN_REPAIR",
  "QC_PENDING",
  "QC_IN_PROGRESS",
  "READY_FOR_PICKUP",
  "COMPLETED",
]);
export type BookingStatus = z.infer<typeof BookingStatusEnum>;

export const EstimateItemTypeEnum = z.enum(["PART", "LABOUR"]);
export type EstimateItemType = z.infer<typeof EstimateItemTypeEnum>;

export const POStatusEnum = z.enum([
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);
export type POStatus = z.infer<typeof POStatusEnum>;

// Standard Error Shape
export const ApiErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorPayloadSchema,
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// Standard Success Envelope Helper
export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
  });
}
