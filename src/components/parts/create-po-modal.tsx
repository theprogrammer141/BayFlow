"use client";

import * as React from "react";
import { ShoppingCart, Plus, Trash2, AlertCircle } from "lucide-react";
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
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { Part } from "@/lib/contracts/inventory";

export interface PreloadedPOItem {
  partId: string;
  name: string;
  sku: string;
  cost: number;
  qtyOrdered: number;
}

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  partsCatalog: Part[];
  linkedBookingId?: string | null;
  initialItems?: PreloadedPOItem[];
  onSuccess: () => void;
}

function CreatePOForm({
  shopId,
  partsCatalog,
  linkedBookingId,
  initialItems,
  onClose,
  onSuccess,
}: {
  shopId: string;
  partsCatalog: Part[];
  linkedBookingId?: string | null;
  initialItems?: PreloadedPOItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [items, setItems] = React.useState<
    Array<{ partId: string; qtyOrdered: number }>
  >(() =>
    initialItems && initialItems.length > 0
      ? initialItems.map((item) => ({
          partId: item.partId,
          qtyOrdered: item.qtyOrdered,
        }))
      : []
  );

  const [selectedPartId, setSelectedPartId] = React.useState(
    partsCatalog[0]?.id || ""
  );
  const [selectedQty, setSelectedQty] = React.useState("1");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleAddItem() {
    if (!selectedPartId) return;
    const qty = parseInt(selectedQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setError("Ordered quantity must be a positive integer");
      return;
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.partId === selectedPartId);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex].qtyOrdered += qty;
        return copy;
      }
      return [...prev, { partId: selectedPartId, qtyOrdered: qty }];
    });

    setSelectedQty("1");
    setError(null);
  }

  function handleRemoveItem(partId: string) {
    setItems((prev) => prev.filter((i) => i.partId !== partId));
  }

  function handleUpdateItemQty(partId: string, newQty: number) {
    if (newQty <= 0) return;
    setItems((prev) =>
      prev.map((i) => (i.partId === partId ? { ...i, qtyOrdered: newQty } : i))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      setError("Please add at least one item to the purchase order");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. Create Purchase Order
      const po = await apiClient<{ id: string }>(
        `/api/shops/${shopId}/purchase-orders`,
        {
          method: "POST",
          body: JSON.stringify({
            items: items.map((i) => ({
              partId: i.partId,
              bookingId: linkedBookingId || null,
              qtyOrdered: i.qtyOrdered,
            })),
          }),
        }
      );

      // 2. If linked to a booking in PARTS_PENDING, advance it to PARTS_ORDERED
      if (linkedBookingId) {
        try {
          await apiClient(
            `/api/shops/${shopId}/bookings/${linkedBookingId}/transition`,
            {
              method: "POST",
              body: JSON.stringify({
                to: "PARTS_ORDERED",
                payload: {
                  purchaseOrderId: po.id,
                },
              }),
            }
          );
        } catch {
          // If transition cannot be completed or booking was already ordered, continue
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to create purchase order");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const catalogMap = new Map(partsCatalog.map((p) => [p.id, p]));
  const totalCost = items.reduce((acc, item) => {
    const part = catalogMap.get(item.partId);
    return acc + (part ? part.cost * item.qtyOrdered : 0);
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add item section */}
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
        <span className="text-xs font-semibold text-foreground">
          Add Catalog Part to Order
        </span>
        <div className="flex gap-2">
          <select
            value={selectedPartId}
            onChange={(e) => setSelectedPartId(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            {partsCatalog.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name} ({part.sku}) — Stock: {part.quantity}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min="1"
            value={selectedQty}
            onChange={(e) => setSelectedQty(e.target.value)}
            className="w-20 text-xs"
            placeholder="Qty"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddItem}
            className="gap-1 shrink-0 text-xs"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Order Line Items ({items.length})
          </span>
          <span className="font-mono text-xs font-semibold text-foreground">
            Est. Total: PKR {totalCost.toLocaleString()}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No items added yet. Select a part above to add to this purchase order.
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto space-y-1.5 divide-y divide-border/40">
            {items.map((item) => {
              const part = catalogMap.get(item.partId);
              const lineTotal = (part?.cost || 0) * item.qtyOrdered;
              return (
                <div
                  key={item.partId}
                  className="flex items-center justify-between pt-1.5 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-foreground truncate">
                      {part?.name || "Catalog Part"}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {part?.sku} • PKR {part?.cost.toLocaleString()} each
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min="1"
                      value={item.qtyOrdered}
                      onChange={(e) =>
                        handleUpdateItemQty(
                          item.partId,
                          parseInt(e.target.value, 10) || 1
                        )
                      }
                      className="w-16 h-7 text-xs text-center font-semibold"
                    />
                    <span className="font-mono text-[11px] text-foreground w-20 text-right">
                      PKR {lineTotal.toLocaleString()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.partId)}
                      className="size-7 text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || items.length === 0}
        >
          {isSubmitting ? "Placing Order..." : "Submit Purchase Order"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreatePOModal({
  isOpen,
  onClose,
  shopId,
  partsCatalog,
  linkedBookingId,
  initialItems,
  onSuccess,
}: CreatePOModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ShoppingCart className="size-5 text-primary" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {linkedBookingId
              ? `Procure missing parts for booking #${linkedBookingId.slice(-6)}`
              : "Generate a supplier purchase order for shop stock replenishment."}
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <CreatePOForm
            key={`${linkedBookingId || "standalone"}-${initialItems?.length || 0}`}
            shopId={shopId}
            partsCatalog={partsCatalog}
            linkedBookingId={linkedBookingId}
            initialItems={initialItems}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
