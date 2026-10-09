import { z } from "zod";
import { IdSchema, RoleEnum, BookingStatusEnum } from "./common";

export const ShopSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  name: z.string().min(1, "Shop name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  phone: z.string().min(1, "Phone is required"),
  logoUrl: z.string().nullable().optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/, "workStart must be in HH:MM format"),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/, "workEnd must be in HH:MM format"),
  slotMinutes: z.number().int().positive("Slot minutes must be positive"),
  slotCapacity: z.number().int().positive("Slot capacity must be positive"),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});
export type Shop = z.infer<typeof ShopSchema>;

export const CreateShopRequestSchema = z.object({
  name: z.string().min(1, "Shop name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  phone: z.string().min(1, "Phone is required"),
  logoUrl: z.string().nullable().optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/, "workStart must be in HH:MM format").default("09:00"),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/, "workEnd must be in HH:MM format").default("18:00"),
  slotMinutes: z.number().int().positive("Slot minutes must be positive").default(60),
  slotCapacity: z.number().int().positive("Slot capacity must be positive").default(2),
});
export type CreateShopRequest = z.infer<typeof CreateShopRequestSchema>;

export const UpdateShopRequestSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/, "workStart must be in HH:MM format").optional(),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/, "workEnd must be in HH:MM format").optional(),
  slotMinutes: z.number().int().positive().optional(),
  slotCapacity: z.number().int().positive().optional(),
});
export type UpdateShopRequest = z.infer<typeof UpdateShopRequestSchema>;

export const TeamMemberUserSchema = z.object({
  id: IdSchema,
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  isActive: z.boolean(),
});
export type TeamMemberUser = z.infer<typeof TeamMemberUserSchema>;

export const TeamMemberSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  shopId: IdSchema,
  role: RoleEnum,
  isActive: z.boolean(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  user: TeamMemberUserSchema,
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const AddTeamMemberRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  role: RoleEnum,
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type AddTeamMemberRequest = z.infer<typeof AddTeamMemberRequestSchema>;

export const UpdateTeamMemberRequestSchema = z.object({
  role: RoleEnum.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTeamMemberRequest = z.infer<typeof UpdateTeamMemberRequestSchema>;

export const ServiceItemSchema = z.object({
  id: IdSchema,
  shopId: IdSchema,
  name: z.string().min(1, "Service name is required"),
  description: z.string().nullable().optional(),
  estMinutes: z.number().int().positive("Estimated minutes must be positive"),
  basePrice: z.number().int().nonnegative("Base price must be non-negative PKR").nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});
export type ServiceItem = z.infer<typeof ServiceItemSchema>;

export const CreateServiceRequestSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional().nullable(),
  estMinutes: z.number().int().positive("Estimated minutes must be positive"),
  basePrice: z.number().int().nonnegative("Base price must be non-negative PKR").optional().nullable(),
});
export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;

export const UpdateServiceRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  estMinutes: z.number().int().positive().optional(),
  basePrice: z.number().int().nonnegative().optional().nullable(),
});
export type UpdateServiceRequest = z.infer<typeof UpdateServiceRequestSchema>;

export const ShopOverviewSchema = z.object({
  shop: ShopSchema,
  countsByStatus: z.record(BookingStatusEnum, z.number().int()),
  teamCount: z.number().int(),
  inventorySummary: z.object({
    totalParts: z.number().int(),
    lowStockCount: z.number().int(),
  }),
});
export type ShopOverview = z.infer<typeof ShopOverviewSchema>;
