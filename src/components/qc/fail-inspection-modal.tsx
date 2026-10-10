"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface FailInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  vehicleModel: string;
  vehicleRegNo: string;
  technicianName: string;
  onConfirmFail: (title: string, description: string) => Promise<void>;
}

export function FailInspectionModal({
  isOpen,
  onClose,
  bookingId,
  vehicleModel,
  vehicleRegNo,
  technicianName,
  onConfirmFail,
}: FailInspectionModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClose = React.useCallback(() => {
    setTitle("");
    setDescription("");
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      setError("Please provide an issue title describing the defect.");
      return;
    }
    if (!cleanDesc) {
      setError("Please provide detailed findings and corrective action notes.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirmFail(cleanTitle, cleanDesc);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record QC defect");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600">
            <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 dark:bg-rose-500/20">
              <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Fail QC Inspection & Return Job
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Booking <span className="font-mono font-medium text-foreground">{bookingId}</span> ({vehicleModel} • {vehicleRegNo})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Notice of Re-work Routing</p>
            <p className="mt-0.5 text-muted-foreground">
              This job will be moved back to <span className="font-mono font-semibold text-foreground">IN_REPAIR</span> and reassigned to{" "}
              <span className="font-semibold text-foreground">{technicianName}</span> with your inspection findings.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qc-issue-title" className="text-xs font-semibold">
              Issue Summary / Defect Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="qc-issue-title"
              placeholder="e.g. Brake pedal spongy during road test"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              A concise summary of what failed quality standards.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-issue-desc" className="text-xs font-semibold">
              Detailed Findings & Defect Description <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="qc-issue-desc"
              rows={4}
              placeholder="e.g. Bleeding was incomplete; air bubbles detected in rear brake lines. Caliper torque on passenger front is under spec (torqued to 45 Nm instead of 85 Nm)."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Provide actionable guidance for the mechanic on what needs to be dismantled or re-torqued.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Recording Defect...
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5" />
                  Confirm Defect & Return to Tech
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
