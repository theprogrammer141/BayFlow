import { describe, it, expect } from "vitest";
import { getAvailableSaActions, canSaCancel } from "@/lib/sa/action-rules";
import { BookingStatusEnum } from "@/lib/contracts/common";

describe("Component Tests: Service Advisor Status-to-Action Mapping", () => {
  it("maps PENDING status to confirm and cancel actions", () => {
    const actions = getAvailableSaActions("PENDING");
    expect(actions).toEqual(["CONFIRM", "CANCEL"]);
    expect(canSaCancel("PENDING")).toBe(true);
  });

  it("maps CONFIRMED status to technician assignment and cancel actions", () => {
    const actions = getAvailableSaActions("CONFIRMED");
    expect(actions).toEqual(["ASSIGN_TECHNICIAN", "CANCEL"]);
    expect(canSaCancel("CONFIRMED")).toBe(true);
  });

  it("maps ASSIGNED and INSPECTING statuses to cancel only (waiting for technician)", () => {
    expect(getAvailableSaActions("ASSIGNED")).toEqual(["CANCEL"]);
    expect(getAvailableSaActions("INSPECTING")).toEqual(["CANCEL"]);
    expect(canSaCancel("ASSIGNED")).toBe(true);
    expect(canSaCancel("INSPECTING")).toBe(true);
  });

  it("maps ESTIMATE_REVIEW to estimate editing, sending to customer, and cancel", () => {
    const actions = getAvailableSaActions("ESTIMATE_REVIEW");
    expect(actions).toEqual(["EDIT_ESTIMATE", "SEND_ESTIMATE", "CANCEL"]);
    expect(canSaCancel("ESTIMATE_REVIEW")).toBe(true);
  });

  it("maps AWAITING_CUSTOMER to cancel (customer owns approval/rejection)", () => {
    expect(getAvailableSaActions("AWAITING_CUSTOMER")).toEqual(["CANCEL"]);
    expect(canSaCancel("AWAITING_CUSTOMER")).toBe(true);
  });

  it("maps ESTIMATE_APPROVED to parts person assignment and cancel", () => {
    const actions = getAvailableSaActions("ESTIMATE_APPROVED");
    expect(actions).toEqual(["ASSIGN_PARTS", "CANCEL"]);
    expect(canSaCancel("ESTIMATE_APPROVED")).toBe(true);
  });

  it("maps ESTIMATE_REJECTED to revise with tech and cancel", () => {
    const actions = getAvailableSaActions("ESTIMATE_REJECTED");
    expect(actions).toEqual(["REVISE_ESTIMATE", "CANCEL"]);
    expect(canSaCancel("ESTIMATE_REJECTED")).toBe(true);
  });

  it("maps PARTS statuses before IN_REPAIR to cancel only", () => {
    expect(getAvailableSaActions("PARTS_PENDING")).toEqual(["CANCEL"]);
    expect(getAvailableSaActions("PARTS_ORDERED")).toEqual(["CANCEL"]);
    expect(getAvailableSaActions("PARTS_READY")).toEqual(["CANCEL"]);
    expect(canSaCancel("PARTS_PENDING")).toBe(true);
    expect(canSaCancel("PARTS_ORDERED")).toBe(true);
    expect(canSaCancel("PARTS_READY")).toBe(true);
  });

  it("disallows cancellation and SA actions during IN_REPAIR and QC phases", () => {
    expect(getAvailableSaActions("IN_REPAIR")).toEqual([]);
    expect(canSaCancel("IN_REPAIR")).toBe(false);

    expect(getAvailableSaActions("QC_PENDING")).toEqual([]);
    expect(canSaCancel("QC_PENDING")).toBe(false);

    expect(getAvailableSaActions("QC_IN_PROGRESS")).toEqual([]);
    expect(canSaCancel("QC_IN_PROGRESS")).toBe(false);
  });

  it("maps READY_FOR_PICKUP to ready notification and completion", () => {
    const actions = getAvailableSaActions("READY_FOR_PICKUP");
    expect(actions).toEqual(["NOTIFY_READY", "COMPLETE"]);
    expect(canSaCancel("READY_FOR_PICKUP")).toBe(false);
  });

  it("maps terminal statuses (COMPLETED, CANCELLED) to empty actions", () => {
    expect(getAvailableSaActions("COMPLETED")).toEqual([]);
    expect(canSaCancel("COMPLETED")).toBe(false);

    expect(getAvailableSaActions("CANCELLED")).toEqual([]);
    expect(canSaCancel("CANCELLED")).toBe(false);
  });

  it("covers every defined BookingStatus enum value deterministically", () => {
    for (const status of BookingStatusEnum.options) {
      const actions = getAvailableSaActions(status);
      expect(Array.isArray(actions)).toBe(true);
    }
  });
});
