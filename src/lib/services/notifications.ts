import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TransitionDefinition } from "@/lib/state/transitions";
import type { AuthUser } from "@/lib/auth/types";

export interface CreateNotificationsParams {
  booking: {
    id: string;
    shopId: string;
    customerId: string;
    technicianId: string | null;
    partsPersonId: string | null;
    qcInspectorId: string | null;
  };
  transition: TransitionDefinition;
  actor: AuthUser;
}

export async function createNotifications(
  tx: Prisma.TransactionClient,
  { booking, transition, actor }: CreateNotificationsParams
): Promise<void> {
  if (!transition.notify || transition.notify.length === 0) {
    return;
  }

  const recipientUserIds = new Set<string>();

  for (const target of transition.notify) {
    switch (target) {
      case "CUSTOMER": {
        if (booking.customerId !== actor.id) {
          recipientUserIds.add(booking.customerId);
        }
        break;
      }
      case "COUNTERPARTY": {
        if (actor.id === booking.customerId) {
          // Actor is customer; notify shop Service Advisors
          const saMemberships = await tx.membership.findMany({
            where: {
              shopId: booking.shopId,
              role: { in: ["SERVICE_ADVISOR", "OWNER"] },
              isActive: true,
            },
            select: { userId: true },
          });
          for (const m of saMemberships) {
            recipientUserIds.add(m.userId);
          }
        } else {
          // Actor is staff/owner; notify customer
          recipientUserIds.add(booking.customerId);
        }
        break;
      }
      case "TECHNICIAN": {
        if (booking.technicianId && booking.technicianId !== actor.id) {
          recipientUserIds.add(booking.technicianId);
        }
        break;
      }
      case "SERVICE_ADVISOR": {
        const saMemberships = await tx.membership.findMany({
          where: {
            shopId: booking.shopId,
            role: { in: ["SERVICE_ADVISOR", "OWNER"] },
            isActive: true,
          },
          select: { userId: true },
        });
        for (const m of saMemberships) {
          if (m.userId !== actor.id) {
            recipientUserIds.add(m.userId);
          }
        }
        break;
      }
      case "PARTS_PERSON": {
        if (booking.partsPersonId && booking.partsPersonId !== actor.id) {
          recipientUserIds.add(booking.partsPersonId);
        } else {
          const partsMemberships = await tx.membership.findMany({
            where: {
              shopId: booking.shopId,
              role: "PARTS_PERSON",
              isActive: true,
            },
            select: { userId: true },
          });
          for (const m of partsMemberships) {
            if (m.userId !== actor.id) {
              recipientUserIds.add(m.userId);
            }
          }
        }
        break;
      }
      case "QC_QUEUE": {
        const qcMemberships = await tx.membership.findMany({
          where: {
            shopId: booking.shopId,
            role: "QC_INSPECTOR",
            isActive: true,
          },
          select: { userId: true },
        });
        for (const m of qcMemberships) {
          if (m.userId !== actor.id) {
            recipientUserIds.add(m.userId);
          }
        }
        break;
      }
    }
  }

  if (recipientUserIds.size === 0) return;

  const message = `Booking status changed to ${transition.to}`;
  const notificationsData = Array.from(recipientUserIds).map((userId) => ({
    userId,
    shopId: booking.shopId,
    bookingId: booking.id,
    type: `STATUS_${transition.to}`,
    message,
  }));

  await tx.notification.createMany({
    data: notificationsData,
  });
}

export async function getNotifications(userId: string, shopId?: string) {
  return db.notification.findMany({
    where: {
      userId,
      ...(shopId ? { shopId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  return db.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function markAllAsRead(userId: string, shopId?: string) {
  return db.notification.updateMany({
    where: {
      userId,
      ...(shopId ? { shopId } : {}),
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}
