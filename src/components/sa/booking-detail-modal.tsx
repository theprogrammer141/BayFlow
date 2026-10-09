"use client";

import * as React from "react";
import {
  User,
  Car,
  Wrench,
  FileText,
  AlertCircle,
  History,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { StatusActions } from "@/components/sa/status-actions";
import type { BookingStatus } from "@/lib/contracts/common";
import type { SaActionType } from "@/lib/sa/action-rules";

export interface FullBookingDetail {
  id: string;
  shopId: string;
  customerId: string;
  vehicleId: string;
  slotId: string;
  status: BookingStatus;
  customerNotes?: string | null;
  technicianId?: string | null;
  partsPersonId?: string | null;
  qcInspectorId?: string | null;
  readyNotifiedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  vehicle?: {
    id: string;
    regNo: string;
    make: string;
    model: string;
    year: number;
    color?: string | null;
    mileage?: number | null;
  };
  slot?: {
    id: string;
    startsAt: string;
  };
  services?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    service: {
      id: string;
      name: string;
      description?: string | null;
      estMinutes: number;
    };
  }>;
  estimate?: {
    id: string;
    revision: number;
    total: number;
    sentAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    items?: Array<{
      id: string;
      type: "PART" | "LABOUR";
      name: string;
      quantity: number;
      unitCost: number;
    }>;
  } | null;
  technician?: { id: string; name: string; email: string } | null;
  partsPerson?: { id: string; name: string; email: string } | null;
  history?: Array<{
    id: string;
    fromStatus?: BookingStatus | null;
    toStatus: BookingStatus;
    note?: string | null;
    createdAt: string;
    actor?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
}

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string;
  onTriggerAction: (action: SaActionType, booking: FullBookingDetail) => void;
  onRefresh?: () => void;
}

export function BookingDetailModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  onTriggerAction,
  onRefresh,
}: BookingDetailModalProps) {
  const [booking, setBooking] = React.useState<FullBookingDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !bookingId || !shopId) return;

    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient<FullBookingDetail>(
          `/api/shops/${shopId}/bookings/${bookingId}`
        );
        if (mounted) {
          setBooking(data);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load booking details"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [isOpen, shopId, bookingId]);

  const handleClose = () => {
    if (onRefresh) onRefresh();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <DialogTitle className="text-lg font-bold font-mono">
                  Booking #{bookingId.slice(-8)}
                </DialogTitle>
                {booking && <StatusBadge status={booking.status} />}
              </div>
              <DialogDescription className="text-xs">
                Created on{" "}
                <span className="font-mono text-foreground font-medium">
                  {booking ? new Date(booking.createdAt).toLocaleString() : "..."}
                </span>
              </DialogDescription>
            </div>

            {booking && (
              <div className="flex items-center gap-2">
                <StatusActions
                  status={booking.status}
                  readyNotifiedAt={booking.readyNotifiedAt}
                  onAction={(act) => onTriggerAction(act, booking)}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-28 bg-muted animate-pulse rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-44 bg-muted animate-pulse rounded-xl" />
                <div className="h-44 bg-muted animate-pulse rounded-xl" />
              </div>
            </div>
          ) : booking ? (
            <>
              {/* Lifecycle Progress Banner */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Lifecycle Progress
                </p>
                <StatusTimeline currentStatus={booking.status} />
              </div>

              {/* Customer & Vehicle Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vehicle Card */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs pb-2 border-b border-border">
                    <Car className="size-4 text-primary" />
                    <span>Vehicle Information</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registration:</span>
                      <span className="font-mono font-bold text-foreground">
                        {booking.vehicle?.regNo}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Make & Model:</span>
                      <span className="font-medium text-foreground">
                        {booking.vehicle?.make} {booking.vehicle?.model} ({booking.vehicle?.year})
                      </span>
                    </div>
                    {booking.vehicle?.color && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Color:</span>
                        <span className="text-foreground">{booking.vehicle.color}</span>
                      </div>
                    )}
                    {booking.vehicle?.mileage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Odometer:</span>
                        <span className="font-mono text-foreground">
                          {booking.vehicle.mileage.toLocaleString()} km
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Card */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs pb-2 border-b border-border">
                    <User className="size-4 text-primary" />
                    <span>Customer Details</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium text-foreground">{booking.customer?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-mono text-foreground">{booking.customer?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-mono text-foreground">
                        {booking.customer?.phone ?? "—"}
                      </span>
                    </div>
                    {booking.technician && (
                      <div className="flex justify-between pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">Assigned Tech:</span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {booking.technician.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Requested Services & Customer Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs pb-2 border-b border-border">
                    <Wrench className="size-4 text-primary" />
                    <span>Requested Services</span>
                  </div>
                  {booking.services && booking.services.length > 0 ? (
                    <div className="space-y-2">
                      {booking.services.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30"
                        >
                          <div>
                            <p className="font-medium text-foreground">{s.service.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Est. {s.service.estMinutes} mins
                            </p>
                          </div>
                          <span className="font-mono text-foreground">
                            PKR {s.unitPrice.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No standard services selected</p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs pb-2 border-b border-border">
                    <FileText className="size-4 text-primary" />
                    <span>Customer Notes</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-xs min-h-20">
                    {booking.customerNotes ? (
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {booking.customerNotes}
                      </p>
                    ) : (
                      <p className="text-muted-foreground italic">No notes left by customer</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Estimate Summary */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                    <FileText className="size-4 text-purple-600" />
                    <span>Itemized Estimate</span>
                  </div>
                  {booking.estimate && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium">
                        Rev #{booking.estimate.revision}
                      </span>
                      {booking.estimate.sentAt && (
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          (Locked / Sent)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {booking.estimate && booking.estimate.items && booking.estimate.items.length > 0 ? (
                  <div className="space-y-3">
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden text-xs">
                      {booking.estimate.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                item.type === "PART"
                                  ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                                  : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                              }`}
                            >
                              {item.type}
                            </span>
                            <span className="font-medium text-foreground">{item.name}</span>
                            <span className="text-muted-foreground font-mono">x{item.quantity}</span>
                          </div>
                          <span className="font-mono font-medium text-foreground">
                            PKR {(item.quantity * item.unitCost).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                        Total Amount (Server Authorized)
                      </span>
                      <span className="font-mono text-base font-bold text-purple-900 dark:text-purple-200">
                        PKR {booking.estimate.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Estimate not yet prepared by technician.
                  </p>
                )}
              </div>

              {/* Booking History Audit Timeline */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs pb-2 border-b border-border">
                  <History className="size-4 text-primary" />
                  <span>Audit Timeline (BookingHistory)</span>
                </div>

                {booking.history && booking.history.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {booking.history.map((h) => (
                      <div key={h.id} className="relative text-xs space-y-1">
                        <div className="absolute -left-6 top-1 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground font-mono">
                            {h.fromStatus ? `${h.fromStatus} → ` : ""}
                            {h.toStatus}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {new Date(h.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {h.note && (
                          <p className="text-muted-foreground bg-muted/30 p-2 rounded-md text-[11px]">
                            {h.note}
                          </p>
                        )}
                        {h.actor && (
                          <p className="text-[11px] text-muted-foreground">
                            By:{" "}
                            <span className="font-medium text-foreground">
                              {h.actor.name} ({h.actor.email})
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No history logged yet</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
