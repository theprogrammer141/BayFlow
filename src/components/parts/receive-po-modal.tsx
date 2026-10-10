"use client";

import * as React from "react";
import { Truck, CheckCircle2, AlertCircle } from "lucide-react";
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
import type { ShopPurchaseOrderWithDetails } from "@/lib/services/purchase-orders";

interface ReceivePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  purchaseOrder: ShopPurchaseOrderWithDetails | null;
  onSuccess: () => void;
}

function ReceivePOForm({
  shopId,
  purchaseOrder,
  onClose,
  onSuccess,
}: {
  shopId: string;
  purchaseOrder: ShopPurchaseOrderWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [receiveInputs, setReceiveInputs] = React.useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const item of purchaseOrder.items) {
      initial[item.id] = Math.max(0, item.qtyOrdered - item.qtyReceived);
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null);

  function handleReceiveAll() {
    const allRemaining: Record<string, number> = {};
    for (const item of purchaseOrder.items) {
      allRemaining[item.id] = Math.max(0, item.qtyOrdered - item.qtyReceived);
    }
    setReceiveInputs(allRemaining);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const itemsToReceive: Array<{ itemId: string; qty: number }> = [];
    for (const [itemId, qty] of Object.entries(receiveInputs)) {
      if (qty > 0) {
        itemsToReceive.push({ itemId, qty });
      }
    }

    if (itemsToReceive.length === 0) {
      setError("Please specify a quantity greater than zero for at least one item to receive");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiClient<ShopPurchaseOrderWithDetails>(
        `/api/shops/${shopId}/purchase-orders/${purchaseOrder.id}/receive`,
        {
          method: "POST",
          body: JSON.stringify({
            items: itemsToReceive,
          }),
        }
      );

      setSuccessNotice(
        updated.status === "RECEIVED"
          ? "Purchase order fully received! Stock updated and any waiting jobs advanced to PARTS_READY."
          : "Partial shipment received and stock updated. Purchase order remains open."
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to record delivery receipt");
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

      {successNotice && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          Incoming Line Items
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleReceiveAll}
          className="text-[11px] h-7"
        >
          Fill All Remaining
        </Button>
      </div>

      <div className="rounded-lg border border-border/80 overflow-hidden divide-y divide-border/60">
        {purchaseOrder.items.map((item) => {
          const remaining = Math.max(0, item.qtyOrdered - item.qtyReceived);
          const isFulfilled = remaining === 0;

          return (
            <div
              key={item.id}
              className={`p-3 flex items-center justify-between text-xs ${
                isFulfilled ? "bg-muted/30 opacity-70" : "bg-card"
              }`}
            >
              <div className="min-w-0 pr-3">
                <p className="font-semibold text-foreground truncate">
                  {item.part.name}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  SKU: {item.part.sku} • In Stock Now: {item.part.quantity}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px]">
                  <span className="text-muted-foreground">
                    Ordered: <strong>{item.qtyOrdered}</strong>
                  </span>
                  <span>•</span>
                  <span className="text-muted-foreground">
                    Prev Received: <strong>{item.qtyReceived}</strong>
                  </span>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Remaining: {remaining}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">
                  Receiving:
                </span>
                <Input
                  type="number"
                  min="0"
                  max={remaining}
                  disabled={isFulfilled || isSubmitting}
                  value={receiveInputs[item.id] ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setReceiveInputs((prev) => ({
                      ...prev,
                      [item.id]: isNaN(val) ? 0 : Math.max(0, Math.min(val, remaining)),
                    }));
                  }}
                  className="w-20 h-8 text-center font-semibold text-xs"
                />
              </div>
            </div>
          );
        })}
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
          disabled={isSubmitting || !!successNotice}
        >
          {isSubmitting ? "Receiving Delivery..." : "Confirm & Update Inventory"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReceivePOModal({
  isOpen,
  onClose,
  shopId,
  purchaseOrder,
  onSuccess,
}: ReceivePOModalProps) {
  if (!purchaseOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Truck className="size-5 text-primary" />
            Receive Supplier Delivery — PO #{purchaseOrder.id.slice(-6).toUpperCase()}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Verify shipment quantities and intake inventory into the shop catalog.
          </DialogDescription>
        </DialogHeader>

        <ReceivePOForm
          key={purchaseOrder.id}
          shopId={shopId}
          purchaseOrder={purchaseOrder}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
