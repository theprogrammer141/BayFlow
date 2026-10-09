"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Trash2,
  Lock,
  Send,
  Save,
  AlertCircle,
  CheckCircle2,
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
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { Estimate, SaveEstimateRequest } from "@/lib/contracts/estimate";

interface EstimateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string;
  isLocked?: boolean;
  onSuccess: () => void;
}

interface EditableLineItem {
  id?: string;
  type: "PART" | "LABOUR";
  name: string;
  quantity: number;
  unitCost: number;
}

export function EstimateEditorModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  isLocked = false,
  onSuccess,
}: EstimateEditorModalProps) {
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [lines, setLines] = React.useState<EditableLineItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !shopId || !bookingId) return;

    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient<Estimate>(
          `/api/shops/${shopId}/bookings/${bookingId}/estimate`
        );
        if (mounted) {
          setEstimate(data);
          if (data?.items && data.items.length > 0) {
            setLines(
              data.items.map((item) => ({
                id: item.id,
                type: item.type,
                name: item.name,
                quantity: item.quantity,
                unitCost: item.unitCost,
              }))
            );
          } else {
            setLines([
              {
                type: "LABOUR",
                name: "Standard Diagnostics & Inspection",
                quantity: 1,
                unitCost: 4000,
              },
            ]);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load booking estimate"
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

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { type: "PART", name: "", quantity: 1, unitCost: 0 },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<EditableLineItem>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...updates } : line))
    );
  };

  const clientTotal = React.useMemo(() => {
    return lines.reduce(
      (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
      0
    );
  }, [lines]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lines.length === 0) {
      setError("At least one estimate line item is required.");
      return null;
    }

    for (const line of lines) {
      if (!line.name.trim()) {
        setError("All line items must have a description or part name.");
        return null;
      }
      if (line.quantity < 1) {
        setError("Quantity must be at least 1.");
        return null;
      }
      if (line.unitCost < 0) {
        setError("Unit cost cannot be negative.");
        return null;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: SaveEstimateRequest = {
        items: lines.map((l) => ({
          type: l.type,
          name: l.name.trim(),
          quantity: Math.floor(Number(l.quantity)),
          unitCost: Math.floor(Number(l.unitCost)),
        })),
      };

      const updated = await apiClient<Estimate>(
        `/api/shops/${shopId}/bookings/${bookingId}/estimate`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      setEstimate(updated);
      setSuccessMsg(
        `Estimate revision ${updated.revision} saved with server-recalculated total: PKR ${updated.total.toLocaleString()}`
      );
      onSuccess();
      return updated;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save estimate");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (!locked) {
      const saved = await handleSave();
      if (!saved) return;
    }

    setIsSending(true);
    setError(null);

    try {
      await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "AWAITING_CUSTOMER",
          note: "Estimate sent to customer for online approval",
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to dispatch estimate to customer"
      );
    } finally {
      setIsSending(false);
    }
  };

  const locked = isLocked || Boolean(estimate?.sentAt);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40">
                <FileText className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Estimate Review & Revision
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Review parts and labour line items. Totals are calculated server-side in integer PKR.
                </DialogDescription>
              </div>
            </div>
            {estimate && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold">
                Revision #{estimate.revision}
              </span>
            )}
          </div>
        </DialogHeader>

        {locked && (
          <div className="flex items-center gap-2 p-3 text-xs bg-muted/60 rounded-lg border border-border text-muted-foreground">
            <Lock className="size-4 shrink-0 text-amber-500" />
            <span>
              This estimate was sent to the customer on{" "}
              <span className="font-mono font-medium text-foreground">
                {estimate?.sentAt ? new Date(estimate.sentAt).toLocaleDateString() : "earlier"}
              </span>{" "}
              and is currently locked. It becomes editable only if rejected by the customer and revised.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-10 bg-muted animate-pulse rounded-md" />
              <div className="h-10 bg-muted animate-pulse rounded-md" />
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 text-left w-24">Type</th>
                      <th className="py-2.5 px-3 text-left">Description</th>
                      <th className="py-2.5 px-3 text-center w-20">Qty</th>
                      <th className="py-2.5 px-3 text-right w-28">Unit (PKR)</th>
                      <th className="py-2.5 px-3 text-right w-28">Total (PKR)</th>
                      {!locked && <th className="py-2.5 px-2 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2">
                          {locked ? (
                            <span className="font-semibold text-foreground">{line.type}</span>
                          ) : (
                            <select
                              value={line.type}
                              onChange={(e) =>
                                updateLine(idx, { type: e.target.value as "PART" | "LABOUR" })
                              }
                              className="w-full text-xs rounded border border-border bg-background p-1 font-medium"
                            >
                              <option value="PART">PART</option>
                              <option value="LABOUR">LABOUR</option>
                            </select>
                          )}
                        </td>
                        <td className="p-2">
                          {locked ? (
                            <span className="text-foreground">{line.name}</span>
                          ) : (
                            <Input
                              value={line.name}
                              onChange={(e) => updateLine(idx, { name: e.target.value })}
                              placeholder="e.g. Engine Oil Synthetic 5W-30"
                              className="h-8 text-xs"
                            />
                          )}
                        </td>
                        <td className="p-2">
                          {locked ? (
                            <span className="font-mono text-center block">{line.quantity}</span>
                          ) : (
                            <Input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(idx, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="h-8 text-xs text-center font-mono"
                            />
                          )}
                        </td>
                        <td className="p-2">
                          {locked ? (
                            <span className="font-mono text-right block">
                              {line.unitCost.toLocaleString()}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              value={line.unitCost}
                              onChange={(e) =>
                                updateLine(idx, {
                                  unitCost: Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              className="h-8 text-xs text-right font-mono"
                            />
                          )}
                        </td>
                        <td className="p-2 text-right font-mono font-medium text-foreground">
                          {((line.quantity || 0) * (line.unitCost || 0)).toLocaleString()}
                        </td>
                        {!locked && (
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="text-muted-foreground hover:text-rose-600 transition-colors p-1"
                              title="Remove item"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!locked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  className="gap-1.5 text-xs w-full border-dashed"
                >
                  <Plus className="size-3.5" />
                  Add Estimate Line Item
                </Button>
              )}

              {/* Subtotal & Server Total Box */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Computed Estimated Total</p>
                  <p className="text-[11px] text-muted-foreground italic">
                    (Recalculated on server upon save)
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-bold text-foreground">
                    PKR {clientTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border flex justify-between sm:justify-between items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Close
          </Button>

          {!locked && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSave()}
                disabled={isSubmitting || isLoading}
                className="text-xs gap-1.5"
              >
                <Save className="size-3.5" />
                {isSubmitting ? "Saving..." : "Save Revision Draft"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSendToCustomer}
                disabled={isSending || isSubmitting || isLoading}
                className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700"
              >
                <Send className="size-3.5" />
                {isSending ? "Dispatching..." : "Send to Customer"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
