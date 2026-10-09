import { z } from "zod";
import { IdSchema } from "./common";

export const QcQueueItemSchema = z.object({
  bookingId: IdSchema,
  shopId: IdSchema,
  vehicleRegNo: z.string(),
  vehicleModel: z.string(),
  technicianName: z.string(),
  enteredQcAt: z.string().datetime(),
});
export type QcQueueItem = z.infer<typeof QcQueueItemSchema>;

export const QcFailRequestSchema = z.object({
  title: z.string().min(1, "Issue title is required"),
  description: z.string().min(1, "Issue description is required"),
});
export type QcFailRequest = z.infer<typeof QcFailRequestSchema>;

export const QcIssueSchema = z.object({
  id: IdSchema,
  bookingId: IdSchema,
  raisedById: IdSchema,
  title: z.string(),
  description: z.string(),
  createdAt: z.string().datetime(),
  raisedByName: z.string().optional(),
});
export type QcIssue = z.infer<typeof QcIssueSchema>;
