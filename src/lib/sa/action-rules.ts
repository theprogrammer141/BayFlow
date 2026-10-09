import type { BookingStatus } from "@/lib/contracts/common";

export type SaActionType =
  | "CONFIRM"
  | "ASSIGN_TECHNICIAN"
  | "EDIT_ESTIMATE"
  | "SEND_ESTIMATE"
  | "REVISE_ESTIMATE"
  | "ASSIGN_PARTS"
  | "NOTIFY_READY"
  | "COMPLETE"
  | "CANCEL";

/**
 * Returns available Service Advisor actions for a given booking status.
 * State machine owns permissions; the UI uses this to show relevant controls.
 */
export function getAvailableSaActions(status: BookingStatus): SaActionType[] {
  switch (status) {
    case "PENDING":
      return ["CONFIRM", "CANCEL"];
    case "CONFIRMED":
      return ["ASSIGN_TECHNICIAN", "CANCEL"];
    case "ASSIGNED":
    case "INSPECTING":
      return ["CANCEL"];
    case "ESTIMATE_REVIEW":
      return ["EDIT_ESTIMATE", "SEND_ESTIMATE", "CANCEL"];
    case "AWAITING_CUSTOMER":
      return ["CANCEL"];
    case "ESTIMATE_APPROVED":
      return ["ASSIGN_PARTS", "CANCEL"];
    case "ESTIMATE_REJECTED":
      return ["REVISE_ESTIMATE", "CANCEL"];
    case "PARTS_PENDING":
    case "PARTS_ORDERED":
    case "PARTS_READY":
      return ["CANCEL"];
    case "READY_FOR_PICKUP":
      return ["NOTIFY_READY", "COMPLETE"];
    case "IN_REPAIR":
    case "QC_PENDING":
    case "QC_IN_PROGRESS":
    case "COMPLETED":
    case "CANCELLED":
    default:
      return [];
  }
}

export function canSaCancel(status: BookingStatus): boolean {
  return getAvailableSaActions(status).includes("CANCEL");
}
