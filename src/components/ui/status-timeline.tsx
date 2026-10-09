import * as React from "react";
import { cn } from "cn";
import {
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  Package,
  Wrench,
  ShieldCheck,
  Car,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { BookingStatus } from "@/lib/contracts/common";

interface StatusTimelineProps {
  currentStatus: BookingStatus;
  className?: string;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  matches: (status: BookingStatus) => "completed" | "current" | "upcoming" | "failed";
}

const STEPS: Step[] = [
  {
    id: "booking",
    title: "Booked",
    description: "Appointment requested",
    icon: CalendarCheck,
    matches: (status) => {
      if (status === "CANCELLED") return "failed";
      if (status === "PENDING") return "current";
      return "completed";
    },
  },
  {
    id: "inspection",
    title: "Inspection",
    description: "Diagnostic & estimate",
    icon: ClipboardList,
    matches: (status) => {
      if (status === "CANCELLED") return "upcoming";
      if (status === "PENDING") return "upcoming";
      if (status === "CONFIRMED" || status === "ASSIGNED" || status === "INSPECTING")
        return "current";
      return "completed";
    },
  },
  {
    id: "estimate",
    title: "Estimate",
    description: "Pricing & approval",
    icon: FileCheck2,
    matches: (status) => {
      if (status === "ESTIMATE_REJECTED") return "failed";
      if (
        status === "PENDING" ||
        status === "CONFIRMED" ||
        status === "ASSIGNED" ||
        status === "INSPECTING"
      )
        return "upcoming";
      if (status === "ESTIMATE_REVIEW" || status === "AWAITING_CUSTOMER") return "current";
      return "completed";
    },
  },
  {
    id: "parts",
    title: "Parts",
    description: "Sourcing & allocation",
    icon: Package,
    matches: (status) => {
      if (
        [
          "PENDING",
          "CONFIRMED",
          "ASSIGNED",
          "INSPECTING",
          "ESTIMATE_REVIEW",
          "AWAITING_CUSTOMER",
          "ESTIMATE_REJECTED",
        ].includes(status)
      )
        return "upcoming";
      if (
        status === "ESTIMATE_APPROVED" ||
        status === "PARTS_PENDING" ||
        status === "PARTS_ORDERED" ||
        status === "PARTS_READY"
      )
        return "current";
      return "completed";
    },
  },
  {
    id: "repair",
    title: "Repair",
    description: "Active mechanical repair",
    icon: Wrench,
    matches: (status) => {
      if (
        [
          "PENDING",
          "CONFIRMED",
          "ASSIGNED",
          "INSPECTING",
          "ESTIMATE_REVIEW",
          "AWAITING_CUSTOMER",
          "ESTIMATE_REJECTED",
          "ESTIMATE_APPROVED",
          "PARTS_PENDING",
          "PARTS_ORDERED",
          "PARTS_READY",
        ].includes(status)
      )
        return "upcoming";
      if (status === "IN_REPAIR") return "current";
      return "completed";
    },
  },
  {
    id: "qc",
    title: "Quality Check",
    description: "Safety road test",
    icon: ShieldCheck,
    matches: (status) => {
      if (
        [
          "PENDING",
          "CONFIRMED",
          "ASSIGNED",
          "INSPECTING",
          "ESTIMATE_REVIEW",
          "AWAITING_CUSTOMER",
          "ESTIMATE_REJECTED",
          "ESTIMATE_APPROVED",
          "PARTS_PENDING",
          "PARTS_ORDERED",
          "PARTS_READY",
          "IN_REPAIR",
        ].includes(status)
      )
        return "upcoming";
      if (status === "QC_PENDING" || status === "QC_IN_PROGRESS") return "current";
      return "completed";
    },
  },
  {
    id: "ready",
    title: "Ready",
    description: "Vehicle pickup",
    icon: Car,
    matches: (status) => {
      if (status === "READY_FOR_PICKUP") return "current";
      if (status === "COMPLETED") return "completed";
      return "upcoming";
    },
  },
  {
    id: "completed",
    title: "Complete",
    description: "Job closed",
    icon: CheckCircle2,
    matches: (status) => {
      if (status === "COMPLETED") return "completed";
      return "upcoming";
    },
  },
];

export function StatusTimeline({ currentStatus, className }: StatusTimelineProps) {
  if (currentStatus === "CANCELLED") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive",
          className
        )}
      >
        <XCircle className="size-6 shrink-0" />
        <div>
          <p className="font-semibold text-sm">Booking Cancelled</p>
          <p className="text-xs text-muted-foreground">
            This booking has been cancelled and will not progress further.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full py-4", className)}>
      <ol className="relative flex flex-col md:flex-row md:justify-between gap-4 md:gap-2">
        {STEPS.map((step, index) => {
          const state = step.matches(currentStatus);
          const Icon = step.icon;

          return (
            <li
              key={step.id}
              className="flex items-start md:flex-col md:items-center flex-1 relative gap-3 md:gap-2"
            >
              {/* Connector line on desktop */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "hidden md:block absolute top-4 left-1/2 w-full h-0.5 -z-10 transition-colors",
                    state === "completed" ? "bg-primary" : "bg-muted"
                  )}
                />
              )}

              {/* Icon badge */}
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-sm",
                  state === "completed" &&
                    "border-primary bg-primary text-primary-foreground",
                  state === "current" &&
                    "border-primary bg-background text-primary ring-4 ring-primary/20 animate-pulse",
                  state === "upcoming" &&
                    "border-muted bg-muted/40 text-muted-foreground",
                  state === "failed" &&
                    "border-destructive bg-destructive/10 text-destructive"
                )}
              >
                <Icon className="size-4" />
              </div>

              {/* Text metadata */}
              <div className="md:text-center">
                <p
                  className={cn(
                    "text-xs font-semibold tracking-tight",
                    state === "completed" || state === "current"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
