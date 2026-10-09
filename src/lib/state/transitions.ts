import type { BookingStatus, ActorRole } from "@/lib/contracts/common";

export type NotificationTarget =
  | "CUSTOMER"
  | "COUNTERPARTY"
  | "TECHNICIAN"
  | "SERVICE_ADVISOR"
  | "PARTS_PERSON"
  | "QC_QUEUE";

export interface TransitionDefinition {
  row: string;
  from: BookingStatus;
  to: BookingStatus;
  roles: readonly ActorRole[];
  guardKey?: string;
  sideEffectDescription?: string;
  notify?: readonly NotificationTarget[];
}

/**
 * State machine transitions defined strictly per project-doc.md §4.1.
 * This file is data-only. Transition engine logic lives in services.
 */
export const TRANSITIONS: readonly TransitionDefinition[] = [
  {
    row: "1",
    from: "PENDING",
    to: "CONFIRMED",
    roles: ["SERVICE_ADVISOR", "OWNER"],
    notify: ["CUSTOMER"],
  },
  {
    row: "1b",
    from: "PENDING",
    to: "CANCELLED",
    roles: ["SERVICE_ADVISOR", "OWNER", "CUSTOMER"],
    notify: ["COUNTERPARTY"],
  },
  {
    row: "2",
    from: "CONFIRMED",
    to: "ASSIGNED",
    roles: ["SERVICE_ADVISOR", "OWNER"],
    guardKey: "TARGET_HAS_TECHNICIAN_MEMBERSHIP",
    sideEffectDescription: "Set technicianId",
    notify: ["TECHNICIAN"],
  },
  {
    row: "3",
    from: "ASSIGNED",
    to: "INSPECTING",
    roles: ["TECHNICIAN"],
    guardKey: "ASSIGNED_TECHNICIAN_ONLY",
  },
  {
    row: "4",
    from: "INSPECTING",
    to: "ESTIMATE_REVIEW",
    roles: ["TECHNICIAN"],
    guardKey: "ASSIGNED_TECHNICIAN_AND_MIN_ONE_ESTIMATE_LINE",
    sideEffectDescription: "Create Estimate (revision 1)",
    notify: ["SERVICE_ADVISOR"],
  },
  {
    row: "5",
    from: "ESTIMATE_REVIEW",
    to: "AWAITING_CUSTOMER",
    roles: ["SERVICE_ADVISOR", "OWNER"],
    guardKey: "ESTIMATE_HAS_LINES_TOTAL_RECOMPUTED",
    sideEffectDescription: "Lock estimate version",
    notify: ["CUSTOMER"],
  },
  {
    row: "6a",
    from: "AWAITING_CUSTOMER",
    to: "ESTIMATE_APPROVED",
    roles: ["CUSTOMER"],
    guardKey: "BOOKING_CUSTOMER_ONLY",
    sideEffectDescription: "Store approvedAt",
    notify: ["SERVICE_ADVISOR"],
  },
  {
    row: "6b",
    from: "AWAITING_CUSTOMER",
    to: "ESTIMATE_REJECTED",
    roles: ["CUSTOMER"],
    guardKey: "BOOKING_CUSTOMER_ONLY",
    sideEffectDescription: "Store rejectedAt",
    notify: ["SERVICE_ADVISOR"],
  },
  {
    row: "6c",
    from: "ESTIMATE_REJECTED",
    to: "ESTIMATE_REVIEW",
    roles: ["SERVICE_ADVISOR", "OWNER"],
    guardKey: "REVISE_WITH_TECHNICIAN",
    sideEffectDescription: "estimate.revision += 1",
    notify: ["TECHNICIAN"],
  },
  {
    row: "6d",
    from: "ESTIMATE_REJECTED",
    to: "CANCELLED",
    roles: ["SERVICE_ADVISOR", "OWNER"],
    notify: ["CUSTOMER"],
  },
  {
    row: "7",
    from: "ESTIMATE_APPROVED",
    to: "PARTS_PENDING",
    roles: ["SERVICE_ADVISOR", "OWNER"],
    guardKey: "TARGET_HAS_PARTS_MEMBERSHIP",
    sideEffectDescription: "Set partsPersonId",
    notify: ["PARTS_PERSON"],
  },
  {
    row: "8a",
    from: "PARTS_PENDING",
    to: "PARTS_ORDERED",
    roles: ["PARTS_PERSON"],
    guardKey: "HAS_PARTS_SHORTAGE_AND_PO_CREATED",
    sideEffectDescription: "Create PO",
  },
  {
    row: "8b",
    from: "PARTS_PENDING",
    to: "PARTS_READY",
    roles: ["PARTS_PERSON"],
    guardKey: "EVERY_REQUIRED_PART_IN_STOCK",
    notify: ["TECHNICIAN"],
  },
  {
    row: "9",
    from: "PARTS_ORDERED",
    to: "PARTS_READY",
    roles: ["PARTS_PERSON"],
    guardKey: "ALL_PO_ITEMS_FULLY_RECEIVED",
    sideEffectDescription: "Stock increases on each receipt",
    notify: ["TECHNICIAN"],
  },
  {
    row: "10",
    from: "PARTS_READY",
    to: "IN_REPAIR",
    roles: ["PARTS_PERSON"],
    guardKey: "STOCK_SUFFICIENT",
    sideEffectDescription: "Allocate: deduct stock, create Allocation rows",
    notify: ["TECHNICIAN"],
  },
  {
    row: "11",
    from: "IN_REPAIR",
    to: "QC_PENDING",
    roles: ["TECHNICIAN"],
    guardKey: "ASSIGNED_TECHNICIAN_ONLY",
    notify: ["QC_QUEUE"],
  },
  {
    row: "12",
    from: "QC_PENDING",
    to: "QC_IN_PROGRESS",
    roles: ["QC_INSPECTOR"],
    guardKey: "ATOMIC_FIRST_PICKER_ONLY",
    sideEffectDescription: "Set qcInspectorId",
  },
  {
    row: "13a",
    from: "QC_IN_PROGRESS",
    to: "READY_FOR_PICKUP",
    roles: ["QC_INSPECTOR"],
    guardKey: "ASSIGNED_QC_INSPECTOR_ONLY",
    notify: ["SERVICE_ADVISOR"],
  },
  {
    row: "13b",
    from: "QC_IN_PROGRESS",
    to: "IN_REPAIR",
    roles: ["QC_INSPECTOR"],
    guardKey: "ASSIGNED_QC_AND_QC_ISSUE_REQUIRED",
    sideEffectDescription: "Clear qcInspectorId",
    notify: ["TECHNICIAN"],
  },
  {
    row: "14",
    from: "READY_FOR_PICKUP",
    to: "COMPLETED",
    roles: ["SERVICE_ADVISOR", "OWNER", "CUSTOMER"],
    sideEffectDescription: "Set completedAt",
  },
] as const;

export function findTransition(
  from: BookingStatus,
  to: BookingStatus
): TransitionDefinition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}
