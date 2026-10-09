import * as React from "react";
import { cn } from "cn";
import type { BookingStatus } from "@/lib/contracts/common";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: BookingStatus;
}

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  PENDING: {
    label: "Pending Confirmation",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Booking Confirmed",
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  ASSIGNED: {
    label: "Technician Assigned",
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-700 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  INSPECTING: {
    label: "Vehicle Inspecting",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  ESTIMATE_REVIEW: {
    label: "Estimate Review",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  AWAITING_CUSTOMER: {
    label: "Awaiting Customer Approval",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
  },
  ESTIMATE_APPROVED: {
    label: "Estimate Approved",
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    text: "text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  ESTIMATE_REJECTED: {
    label: "Estimate Rejected",
    bg: "bg-red-500/10 dark:bg-red-500/20",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
  PARTS_PENDING: {
    label: "Parts Pending",
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  PARTS_ORDERED: {
    label: "Parts Ordered",
    bg: "bg-yellow-500/10 dark:bg-yellow-500/20",
    text: "text-yellow-800 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  PARTS_READY: {
    label: "Parts Ready",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  IN_REPAIR: {
    label: "In Active Repair",
    bg: "bg-blue-600/10 dark:bg-blue-600/20",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-600 animate-pulse",
  },
  QC_PENDING: {
    label: "QC Queue",
    bg: "bg-violet-500/10 dark:bg-violet-500/20",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  QC_IN_PROGRESS: {
    label: "QC In Progress",
    bg: "bg-violet-600/10 dark:bg-violet-600/20",
    text: "text-violet-800 dark:text-violet-300",
    dot: "bg-violet-600 animate-pulse",
  },
  READY_FOR_PICKUP: {
    label: "Ready for Pickup",
    bg: "bg-emerald-500/15 dark:bg-emerald-500/25",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500 animate-ping",
  },
  COMPLETED: {
    label: "Job Completed",
    bg: "bg-zinc-500/10 dark:bg-zinc-500/20",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-500",
  },
};

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        config.bg,
        config.text,
        className
      )}
      {...props}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
