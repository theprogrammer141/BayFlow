import { z } from "zod";
import { BookingStatusEnum, IdSchema } from "./common";

export const CreateBookingCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type CreateBookingCustomer = z.infer<typeof CreateBookingCustomerSchema>;

export const CreateBookingVehicleSchema = z.object({
  regNo: z.string().min(1, "Registration number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().int().min(1900).max(2100),
  color: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
});
export type CreateBookingVehicle = z.infer<typeof CreateBookingVehicleSchema>;

export const CreateBookingRequestSchema = z.object({
  shopId: IdSchema,
  slotId: IdSchema,
  serviceIds: z.array(IdSchema).min(1, "At least one service must be selected"),
  customerNotes: z.string().optional(),
  customer: CreateBookingCustomerSchema,
  vehicle: CreateBookingVehicleSchema,
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const TransitionBookingRequestSchema = z.object({
  to: BookingStatusEnum,
  note: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type TransitionBookingRequest = z.infer<typeof TransitionBookingRequestSchema>;

export const BookingFilterQuerySchema = z.object({
  status: BookingStatusEnum.optional(),
});
export type BookingFilterQuery = z.infer<typeof BookingFilterQuerySchema>;

export const BookingSummarySchema = z.object({
  id: IdSchema,
  shopId: IdSchema,
  customerId: IdSchema,
  vehicleId: IdSchema,
  slotId: IdSchema,
  status: BookingStatusEnum,
  customerNotes: z.string().nullable().optional(),
  technicianId: z.string().nullable().optional(),
  partsPersonId: z.string().nullable().optional(),
  qcInspectorId: z.string().nullable().optional(),
  readyNotifiedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  vehicle: z
    .object({
      id: IdSchema,
      regNo: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      color: z.string().nullable().optional(),
    })
    .optional(),
  customer: z
    .object({
      id: IdSchema,
      name: z.string(),
      email: z.string(),
      phone: z.string().nullable().optional(),
    })
    .optional(),
});
export type BookingSummary = z.infer<typeof BookingSummarySchema>;
