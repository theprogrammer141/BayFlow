"use client";

import * as React from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { FullBookingDetail } from "@/components/sa/booking-detail-modal";

interface RepairQcModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string;
  onSuccess: () => void;
}

export function RepairQcModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  onSuccess,
}: RepairQcModalProps) {
  const [booking, setBooking] = React.useState<FullBookingDetail | null>(null);
  const [repairNote, setRepairNote] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !shopId || !bookingId) return;

    let mounted = true;

    async function loadBooking() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient<FullBookingDetail>(
          `/api/shops/${shopId}/bookings/${bookingId}`
        );
        if (mounted) {
          setBooking(data);
          setRepairNote("Repairs executed. Rectified reported QC issue and ready for re-inspection.");
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load repair details"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadBooking();

    return () => {
      mounted = false;
    };
  }, [isOpen, shopId, bookingId]);

  const handleSendToQc = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "QC_PENDING",
          note: repairNote.trim() || "Vehicle repair completed. Sent to QC queue.",
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to transition booking to QC queue"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const qcIssues = booking?.qcIssues ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <DialogHeader>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Wrench className="size-4 text-primary" />
                Repair & QC Inspection Control
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Manage active repair job, review returned QC defects, and submit for re-inspection.
              </DialogDescription>
            </div>
            {booking && <StatusBadge status={booking.status} />}
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 space-y-3">
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : booking ? (
          <div className="space-y-4 text-xs">
            {/* Vehicle & Customer Summary */}
            <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Car className="size-4.5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {booking.vehicle?.make} {booking.vehicle?.model} ({booking.vehicle?.year})
                  </p>
                  <p className="font-mono text-muted-foreground text-[11px]">
                    Reg: {booking.vehicle?.regNo}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Job #{booking.id.slice(-6)}
                </span>
                <p className="font-medium text-foreground">{booking.customer?.name}</p>
              </div>
            </div>

            {/* Returned QC Issues Section */}
            {qcIssues.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="size-4" />
                  <span>Returned QC Issues ({qcIssues.length})</span>
                </div>

                <div className="space-y-2">
                  {qcIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs">
                          {issue.title}
                        </h4>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(issue.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 dark:text-rose-300">
                        {issue.description}
                      </p>
                      {issue.raisedBy && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                          <User className="size-3" />
                          <span>Reported by QC Inspector: {issue.raisedBy.name}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>No active QC defects logged for this repair.</span>
              </div>
            )}

            {/* Customer Reported Notes */}
            <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Customer Problem Description
              </span>
              <p className="text-foreground">
                {booking.customerNotes || "Standard maintenance and inspection request."}
              </p>
            </div>

            {/* Ready for QC input and submission */}
            {booking.status === "IN_REPAIR" && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground text-xs">
                    Technician Handover Notes (Sent to QC Inspector)
                  </label>
                  <Input
                    type="text"
                    value={repairNote}
                    onChange={(e) => setRepairNote(e.target.value)}
                    placeholder="Describe fixes applied (e.g. disc machined, pads torqued, test driven)"
                    className="text-xs bg-background"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Submitting moves this job to <span className="font-mono font-bold text-foreground">QC_PENDING</span>.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSendToQc}
                    disabled={isSubmitting}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <Send className="size-3.5" />
                    {isSubmitting ? "Submitting..." : "Send to QC Inspector"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
