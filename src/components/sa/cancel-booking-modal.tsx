"use client";

import * as React from "react";
import { Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient, ApiClientError } from "@/lib/api-client";

interface CancelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string;
  currentStatus: string;
  onSuccess: () => void;
}

export function CancelBookingModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  currentStatus,
  onSuccess,
}: CancelBookingModalProps) {
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClose = () => {
    setNote("");
    setError(null);
    onClose();
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError("Please provide a cancellation reason or note.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "CANCELLED",
          note: note.trim(),
        }),
      });

      setNote("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to cancel booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40">
              <Ban className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-rose-700 dark:text-rose-400">
                Cancel Booking #{bookingId.slice(-6)}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Current status: <span className="font-semibold text-foreground">{currentStatus}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleCancel} className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-1">State Machine Policy Notice:</p>
            <p className="text-[11px] leading-relaxed">
              Cancellation is permitted before repair begins. Any parts currently reserved or allocated for
              this booking will be automatically restored to workshop stock in this transaction.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-note" className="text-xs font-semibold">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="cancel-note"
              placeholder="e.g. Customer requested postponement; vehicle parts obsolete; diagnostic declined..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs min-h-20"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Keep Booking
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting || !note.trim()}
              className="text-xs gap-1.5"
            >
              {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
