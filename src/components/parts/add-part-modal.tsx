"use client";

import * as React from "react";
import { Package, AlertCircle } from "lucide-react";
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

interface AddPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  onSuccess: (newPart: Part) => void;
}

function AddPartForm({
  shopId,
  onClose,
  onSuccess,
}: {
  shopId: string;
  onClose: () => void;
  onSuccess: (newPart: Part) => void;
}) {
  const [sku, setSku] = React.useState("");
  const [name, setName] = React.useState("");
  const [quantity, setQuantity] = React.useState("0");
  const [reorderLevel, setReorderLevel] = React.useState("2");
  const [cost, setCost] = React.useState("1000");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      setError("SKU and Part Name are required");
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    const reorderNum = parseInt(reorderLevel, 10);
    const costNum = parseInt(cost, 10);

    if (isNaN(qtyNum) || qtyNum < 0) {
      setError("Quantity must be a non-negative number");
      return;
    }
    if (isNaN(reorderNum) || reorderNum < 0) {
      setError("Reorder level must be a non-negative number");
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      setError("Unit cost must be a non-negative PKR amount");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const created = await apiClient<Part>(`/api/shops/${shopId}/parts`, {
        method: "POST",
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          quantity: qtyNum,
          reorderLevel: reorderNum,
          cost: costNum,
        }),
      });

      onSuccess(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to create part catalog entry");
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
        <Label htmlFor="sku" className="text-xs font-medium">
          SKU (Stock Keeping Unit)
        </Label>
        <Input
          id="sku"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="e.g. BRK-PAD-003"
          className="font-mono text-xs uppercase"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-medium">
          Part Description / Name
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Premium Ceramic Brake Pads (Front)"
          className="text-xs"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantity" className="text-xs font-medium">
            Initial Stock Qty
          </Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="text-xs"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reorderLevel" className="text-xs font-medium">
            Reorder Threshold
          </Label>
          <Input
            id="reorderLevel"
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
        <Label htmlFor="cost" className="text-xs font-medium">
          Unit Cost (PKR)
        </Label>
        <Input
          id="cost"
          type="number"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="e.g. 4500"
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
          {isSubmitting ? "Adding..." : "Save Part"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddPartModal({
  isOpen,
  onClose,
  shopId,
  onSuccess,
}: AddPartModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Package className="size-5 text-primary" />
            Add Part to Shop Catalog
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Register a new tracked inventory item for this workshop.
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <AddPartForm
            shopId={shopId}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
