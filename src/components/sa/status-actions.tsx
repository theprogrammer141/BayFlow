"use client";

import * as React from "react";
import {
  CheckCircle2,
  Wrench,
  FileEdit,
  Send,
  RotateCcw,
  Package,
  BellRing,
  Flag,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/lib/contracts/common";
import { getAvailableSaActions, type SaActionType } from "@/lib/sa/action-rules";

interface StatusActionsProps {
  status: BookingStatus;
  readyNotifiedAt?: string | null;
  onAction: (action: SaActionType) => void;
  isLoading?: boolean;
  className?: string;
}

export function StatusActions({
  status,
  readyNotifiedAt,
  onAction,
  isLoading = false,
  className = "",
}: StatusActionsProps) {
  const actions = getAvailableSaActions(status);

  if (actions.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">
        {status === "COMPLETED"
          ? "Booking complete"
          : status === "CANCELLED"
          ? "Booking cancelled"
          : "Work in progress (assigned to team)"}
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {actions.includes("CONFIRM") && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("CONFIRM")}
        >
          <CheckCircle2 className="size-3.5" />
          Confirm Booking
        </Button>
      )}

      {actions.includes("ASSIGN_TECHNICIAN") && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("ASSIGN_TECHNICIAN")}
        >
          <Wrench className="size-3.5" />
          Assign Technician
        </Button>
      )}

      {actions.includes("EDIT_ESTIMATE") && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("EDIT_ESTIMATE")}
        >
          <FileEdit className="size-3.5" />
          Edit Estimate
        </Button>
      )}

      {actions.includes("SEND_ESTIMATE") && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("SEND_ESTIMATE")}
        >
          <Send className="size-3.5" />
          Send to Customer
        </Button>
      )}

      {actions.includes("REVISE_ESTIMATE") && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("REVISE_ESTIMATE")}
        >
          <RotateCcw className="size-3.5" />
          Revise with Tech
        </Button>
      )}

      {actions.includes("ASSIGN_PARTS") && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("ASSIGN_PARTS")}
        >
          <Package className="size-3.5" />
          Assign Parts Staff
        </Button>
      )}

      {actions.includes("NOTIFY_READY") && (
        <Button
          size="sm"
          variant={readyNotifiedAt ? "outline" : "default"}
          className={`gap-1.5 text-xs active:scale-[0.98] transition-transform ${
            readyNotifiedAt
              ? "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300"
              : "bg-sky-600 hover:bg-sky-700"
          }`}
          disabled={isLoading}
          onClick={() => onAction("NOTIFY_READY")}
        >
          <BellRing className="size-3.5" />
          {readyNotifiedAt ? "Re-notify Customer" : "Notify Customer Ready"}
        </Button>
      )}

      {actions.includes("COMPLETE") && (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("COMPLETE")}
        >
          <Flag className="size-3.5" />
          Complete & Handover
        </Button>
      )}

      {actions.includes("CANCEL") && (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-[0.98] transition-transform"
          disabled={isLoading}
          onClick={() => onAction("CANCEL")}
        >
          <Ban className="size-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}
