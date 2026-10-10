"use client";

import * as React from "react";
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { PartsCheckResponse } from "@/lib/contracts/inventory";
import type { PreloadedPOItem } from "./create-po-modal";

interface ShortageCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string | null;
  bookingStatus?: string;
  onOpenCreatePO: (items: PreloadedPOItem[], bookingId: string) => void;
  onSuccess: () => void;
}

export function ShortageCheckModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  bookingStatus,
  onOpenCreatePO,
  onSuccess,
}: ShortageCheckModalProps) {
  const [data, setData] = React.useState<PartsCheckResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !shopId || !bookingId) return;

    let mounted = true;

    async function loadShortageCheck() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await apiClient<PartsCheckResponse>(
          `/api/shops/${shopId}/bookings/${bookingId}/parts-check`
        );
        if (mounted) {
          setData(res);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiClientError) {
            setError(err.message);
          } else {
            setError("Failed to load inventory shortage check");
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadShortageCheck();

    return () => {
      mounted = false;
    };
  }, [isOpen, shopId, bookingId]);

  async function handleMarkReady() {
    if (!bookingId) return;
    try {
      setIsTransitioning(true);
      setError(null);

      await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "PARTS_READY",
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to mark parts ready");
      }
    } finally {
      setIsTransitioning(false);
    }
  }

  async function handleAllocateAndStartRepair() {
    if (!bookingId) return;
    try {
      setIsTransitioning(true);
      setError(null);

      await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "IN_REPAIR",
          note: "Parts allocated from shop inventory to technician",
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to allocate parts and start repair");
      }
    } finally {
      setIsTransitioning(false);
    }
  }

  function handleCreatePOFromShortages() {
    if (!data || !bookingId) return;
    const shortages = data.items
      .filter((i) => i.shortage > 0)
      .map((i) => ({
        partId: i.partId,
        name: i.name,
        sku: i.sku,
        cost: 0,
        qtyOrdered: i.shortage,
      }));

    onClose();
    onOpenCreatePO(shortages, bookingId);
  }

  if (!bookingId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Boxes className="size-5 text-primary" />
            Inventory Shortage Check — Booking #{bookingId.slice(-6).toUpperCase()}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Compare required estimate line items against live shop shelf stock.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Checking live shelf quantities...
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              No Tracked Catalog Parts Required
            </p>
            <p>
              This booking contains labour services or custom one-off parts only.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-muted/30">
              <div className="flex items-center gap-2">
                {data.hasShortage ? (
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="text-xs font-semibold text-foreground">
                  {data.hasShortage
                    ? "Shortage Identified: Supplier PO Required"
                    : "All Required Parts In Stock"}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  data.hasShortage
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {data.hasShortage ? "Needs Procurement" : "Ready to Allocate"}
              </span>
            </div>

            <div className="rounded-lg border border-border/80 overflow-hidden divide-y divide-border/60">
              {data.items.map((item) => (
                <div
                  key={item.partId}
                  className="p-3 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      SKU: {item.sku}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] shrink-0 text-right">
                    <div>
                      <p className="text-muted-foreground">Required</p>
                      <p className="font-bold text-foreground">{item.requiredQty}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">In Stock</p>
                      <p className="font-bold text-foreground">{item.availableQty}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Shortage</p>
                      <p
                        className={`font-bold ${
                          item.shortage > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.shortage}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isTransitioning}
          >
            Close
          </Button>

          {data && data.hasShortage && (
            <Button
              type="button"
              size="sm"
              onClick={handleCreatePOFromShortages}
              disabled={isTransitioning}
              className="gap-1.5"
            >
              <ShoppingCart className="size-3.5" />
              Create Purchase Order ({data.items.filter((i) => i.shortage > 0).length})
            </Button>
          )}

          {data && !data.hasShortage && bookingStatus === "PARTS_PENDING" && (
            <Button
              type="button"
              size="sm"
              onClick={handleMarkReady}
              disabled={isTransitioning}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="size-3.5" />
              {isTransitioning ? "Advancing..." : "Mark Parts Ready"}
            </Button>
          )}

          {bookingStatus === "PARTS_READY" && (
            <Button
              type="button"
              size="sm"
              onClick={handleAllocateAndStartRepair}
              disabled={isTransitioning}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Wrench className="size-3.5" />
              {isTransitioning ? "Allocating..." : "Allocate & Send to Repair"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
