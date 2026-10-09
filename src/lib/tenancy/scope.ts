import { db } from "@/lib/db";
import type { Role } from "@/lib/contracts/common";
import type { AuthUser, MembershipInfo } from "@/lib/auth/types";
import { requireMembership } from "./membership";
import type { Prisma } from "@/generated/prisma/client";

export function withShopScope(
  shopId: string,
  actor?: AuthUser,
  allowedRoles?: readonly Role[]
) {
  let actorMembership: MembershipInfo | undefined;
  if (actor) {
    actorMembership = requireMembership(actor, shopId, allowedRoles);
  }

  return {
    shopId,
    actorMembership,
    where: <T extends Record<string, unknown>>(conditions?: T) => ({
      ...conditions,
      shopId,
    }),
    booking: {
      findUnique: (args: { where: { id: string }; include?: Prisma.BookingInclude }) =>
        db.booking.findFirst({
          where: { id: args.where.id, shopId },
          include: args.include,
        }),
      findFirst: (args?: Prisma.BookingFindFirstArgs) =>
        db.booking.findFirst({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
      findMany: (args?: Prisma.BookingFindManyArgs) =>
        db.booking.findMany({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
    },
    part: {
      findFirst: (args?: Prisma.PartFindFirstArgs) =>
        db.part.findFirst({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
      findMany: (args?: Prisma.PartFindManyArgs) =>
        db.part.findMany({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
    },
    slot: {
      findFirst: (args?: Prisma.SlotFindFirstArgs) =>
        db.slot.findFirst({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
      findMany: (args?: Prisma.SlotFindManyArgs) =>
        db.slot.findMany({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
    },
    service: {
      findFirst: (args?: Prisma.ServiceFindFirstArgs) =>
        db.service.findFirst({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
      findMany: (args?: Prisma.ServiceFindManyArgs) =>
        db.service.findMany({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
    },
    purchaseOrder: {
      findFirst: (args?: Prisma.PurchaseOrderFindFirstArgs) =>
        db.purchaseOrder.findFirst({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
      findMany: (args?: Prisma.PurchaseOrderFindManyArgs) =>
        db.purchaseOrder.findMany({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
    },
    memberships: {
      findFirst: (args?: Prisma.MembershipFindFirstArgs) =>
        db.membership.findFirst({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
      findMany: (args?: Prisma.MembershipFindManyArgs) =>
        db.membership.findMany({
          ...args,
          where: { ...(args?.where || {}), shopId },
        }),
    },
  };
}
