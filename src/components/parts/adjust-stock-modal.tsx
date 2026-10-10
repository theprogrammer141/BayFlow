"use client";

import * as React from "react";
import { Sliders, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { Part } from "@/lib/contracts/inventory";

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  part: Part | null;
  onSuccess: (updatedPart: Part) => void;
}

function AdjustStockForm({
  shopId,
  part,
  onClose,
  onSuccess,
}: {
  shopId: string;
  part: Part;
  onClose: () => void;
  onSuccess: (updatedPart: Part) => void;
}) {
  const [quantity, setQuantity] = React.useState(part.quantity.toString());
  const [reorderLevel, setReorderLevel] = React.useState(part.reorderLevel.toString());
  const [cost, setCost] = React.useState(part.cost.toString());
  const [name, setName] = React.useState(part.name);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const qtyNum = parseInt(quantity, 10);
    const reorderNum = parseInt(reorderLevel, 10);
    const costNum = parseInt(cost, 10);

    if (isNaN(qtyNum) || qtyNum < 0) {
      setError("Quantity cannot be negative");
      return;
    }
    if (isNaN(reorderNum) || reorderNum < 0) {
      setError("Reorder level cannot be negative");
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      setError("Cost must be a non-negative PKR amount");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiClient<Part>(
        `/api/shops/${shopId}/parts/${part.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            quantity: qtyNum,
            reorderLevel: reorderNum,
            cost: costNum,
          }),
        }
      );

      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to adjust inventory item");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="adj-name" className="text-xs font-medium">
          Part Description
        </Label>
        <Input
          id="adj-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-xs"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adj-quantity" className="text-xs font-medium">
            Current On Hand Qty
          </Label>
          <Input
            id="adj-quantity"
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="text-xs font-semibold"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adj-reorder" className="text-xs font-medium">
            Reorder Threshold
          </Label>
          <Input
            id="adj-reorder"
            type="number"
            min="0"
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
            className="text-xs"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj-cost" className="text-xs font-medium">
          Unit Cost (PKR)
        </Label>
        <Input
          id="adj-cost"
          type="number"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="font-mono text-xs"
          required
        />
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdjustStockModal({
  isOpen,
  onClose,
  shopId,
  part,
  onSuccess,
}: AdjustStockModalProps) {
  if (!part) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sliders className="size-5 text-primary" />
            Adjust Inventory — {part.sku}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update quantity on hand, reorder thresholds, or cost for this SKU.
          </DialogDescription>
        </DialogHeader>

        <AdjustStockForm
          key={part.id}
          shopId={shopId}
          part={part}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
