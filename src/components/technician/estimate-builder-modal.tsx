"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Trash2,
  Send,
  Save,
  AlertCircle,
  CheckCircle2,
  Package,
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
import type { Estimate } from "@/lib/contracts/estimate";
import type { ShopPartItem } from "@/lib/services/parts";

interface EstimateBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string;
  vehicleSummary?: string;
  isReadOnly?: boolean;
  onSuccess: () => void;
}

interface EditableLineItem {
  id?: string;
  type: "PART" | "LABOUR";
  partId?: string | null;
  name: string;
  quantity: number;
  unitCost: number;
}

export function EstimateBuilderModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  vehicleSummary,
  isReadOnly = false,
  onSuccess,
}: EstimateBuilderModalProps) {
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [lines, setLines] = React.useState<EditableLineItem[]>([]);
  const [catalogParts, setCatalogParts] = React.useState<ShopPartItem[]>([]);
  const [selectedCatalogPartId, setSelectedCatalogPartId] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // 1. Fetch estimate data and parts catalog
  React.useEffect(() => {
    if (!isOpen || !shopId || !bookingId) return;

    let mounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch catalog parts for picker integration
        try {
          const parts = await apiClient<ShopPartItem[]>(`/api/shops/${shopId}/parts`);
          if (mounted) setCatalogParts(parts || []);
        } catch {
          // Gracefully continue even if parts catalog is empty
          if (mounted) setCatalogParts([]);
        }

        // Fetch existing estimate if available
        try {
          const estData = await apiClient<Estimate>(
            `/api/shops/${shopId}/bookings/${bookingId}/estimate`
          );
          if (mounted) {
            setEstimate(estData);
            if (estData?.items && estData.items.length > 0) {
              setLines(
                estData.items.map((item) => ({
                  id: item.id,
                  type: item.type,
                  partId: item.partId ?? null,
                  name: item.name,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                }))
              );
            } else {
              setLines([]);
            }
          }
        } catch {
          if (mounted) {
            setEstimate(null);
            // Default with 1 diagnostic labour line if no estimate exists yet
            setLines([
              {
                type: "LABOUR",
                name: "Diagnostic Inspection & Assessment",
                quantity: 1,
                unitCost: 3500,
              },
            ]);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load estimate builder"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, [isOpen, shopId, bookingId]);

  // Add custom line
  const addLine = (type: "PART" | "LABOUR") => {
    setLines((prev) => [
      ...prev,
      {
        type,
        name: type === "PART" ? "" : "Labour - ",
        quantity: 1,
        unitCost: 0,
        partId: null,
      },
    ]);
  };

  // Add from catalog picker
  const handleAddCatalogPart = () => {
    if (!selectedCatalogPartId) return;
    const part = catalogParts.find((p) => p.id === selectedCatalogPartId);
    if (!part) return;

    setLines((prev) => [
      ...prev,
      {
        type: "PART",
        partId: part.id,
        name: part.name,
        quantity: 1,
        unitCost: part.cost,
      },
    ]);
    setSelectedCatalogPartId("");
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<EditableLineItem>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...updates } : line))
    );
  };

  // Client-side subtotal computation (preview)
  const partsSubtotal = React.useMemo(() => {
    return lines
      .filter((l) => l.type === "PART")
      .reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  }, [lines]);

  const labourSubtotal = React.useMemo(() => {
    return lines
      .filter((l) => l.type === "LABOUR")
      .reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  }, [lines]);

  const grandTotal = partsSubtotal + labourSubtotal;

  const validateLines = (): string | null => {
    if (lines.length === 0) {
      return "An estimate must contain at least one line item before saving or submitting.";
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.name.trim()) {
        return `Line #${i + 1} requires a valid description or part name.`;
      }
      if (line.quantity <= 0) {
        return `Line #${i + 1} quantity must be at least 1.`;
      }
      if (line.unitCost < 0) {
        return `Line #${i + 1} unit cost cannot be negative.`;
      }
    }
    return null;
  };

  // Save Draft (PUT /api/shops/:shopId/bookings/:id/estimate)
  const handleSaveDraft = async () => {
    const validationErr = validateLines();
    if (validationErr) {
      setError(validationErr);
      return false;
    }

    try {
      setIsSaving(true);
      setError(null);

      const payload = {
        items: lines.map((l) => ({
          type: l.type,
          name: l.name.trim(),
          partId: l.partId ?? null,
          quantity: Math.max(1, Math.floor(Number(l.quantity))),
          unitCost: Math.max(0, Math.floor(Number(l.unitCost))),
        })),
      };

      const saved = await apiClient<Estimate>(
        `/api/shops/${shopId}/bookings/${bookingId}/estimate`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      setEstimate(saved);
      setSuccessMsg("Estimate draft saved successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save estimate");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Submit to SA for Review (POST transition to ESTIMATE_REVIEW)
  const handleSubmitReview = async () => {
    const validationErr = validateLines();
    if (validationErr) {
      setError(validationErr);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. Ensure estimate is saved first
      const saveOk = await handleSaveDraft();
      if (!saveOk) return;

      // 2. Transition booking from INSPECTING to ESTIMATE_REVIEW
      await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "ESTIMATE_REVIEW",
          note: "Technician finished inspection and submitted repair estimate for SA review.",
          payload: {
            items: lines.map((l) => ({
              type: l.type,
              name: l.name.trim(),
              partId: l.partId ?? null,
              quantity: Math.max(1, Math.floor(Number(l.quantity))),
              unitCost: Math.max(0, Math.floor(Number(l.unitCost))),
            })),
          },
        }),
      });

      setSuccessMsg("Estimate successfully submitted to Service Advisor for review!");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to submit estimate for review"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Technician Estimate Builder
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Build itemized repair estimate with parts and labour lines for booking{" "}
                <span className="font-mono font-bold text-foreground">
                  #{bookingId.slice(-6)}
                </span>
                {vehicleSummary && (
                  <span className="ml-2 font-medium text-foreground">({vehicleSummary})</span>
                )}
              </DialogDescription>
            </div>
            {estimate?.revision && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
                Rev #{estimate.revision}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Feedback alerts */}
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

        {isLoading ? (
          <div className="py-12 space-y-3">
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Catalog Part Picker Quick Bar */}
            {!isReadOnly && catalogParts.length > 0 && (
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center gap-3 justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Package className="size-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">Catalog Parts:</span>
                  <select
                    value={selectedCatalogPartId}
                    onChange={(e) => setSelectedCatalogPartId(e.target.value)}
                    className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">-- Select from parts inventory --</option>
                    {catalogParts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — PKR {p.cost.toLocaleString()} (Stock: {p.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleAddCatalogPart}
                  disabled={!selectedCatalogPartId}
                  className="text-xs gap-1.5 shrink-0"
                >
                  <Plus className="size-3.5" />
                  Add Catalog Part
                </Button>
              </div>
            )}

            {/* Line items table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Estimate Line Items ({lines.length})
                </h4>
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => addLine("PART")}
                      className="text-[11px] gap-1"
                    >
                      <Plus className="size-3" />
                      Add Custom Part
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => addLine("LABOUR")}
                      className="text-[11px] gap-1"
                    >
                      <Plus className="size-3" />
                      Add Labour
                    </Button>
                  </div>
                )}
              </div>

              {lines.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/10 space-y-2">
                  <FileText className="size-6 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    No estimate lines added yet. Add catalog parts or custom labour items above.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="p-2.5 w-24">Type</th>
                        <th className="p-2.5">Item / Description</th>
                        <th className="p-2.5 w-20 text-center">Qty</th>
                        <th className="p-2.5 w-28 text-right">Unit Cost (PKR)</th>
                        <th className="p-2.5 w-28 text-right">Line Total</th>
                        {!isReadOnly && <th className="p-2.5 w-10 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {lines.map((line, idx) => {
                        const lineTotal =
                          (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);

                        return (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            {/* Line Type */}
                            <td className="p-2">
                              {isReadOnly ? (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground">
                                  {line.type}
                                </span>
                              ) : (
                                <select
                                  value={line.type}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      type: e.target.value as "PART" | "LABOUR",
                                    })
                                  }
                                  className="h-7 w-full rounded border border-border bg-background px-1 text-[11px] font-semibold text-foreground focus:outline-none"
                                >
                                  <option value="PART">PART</option>
                                  <option value="LABOUR">LABOUR</option>
                                </select>
                              )}
                            </td>

                            {/* Name / Description */}
                            <td className="p-2">
                              {isReadOnly ? (
                                <div className="space-y-0.5">
                                  <span className="font-medium text-foreground">{line.name}</span>
                                  {line.partId && (
                                    <span className="block text-[10px] font-mono text-muted-foreground">
                                      Catalog Ref: #{line.partId.slice(-6)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Input
                                  type="text"
                                  placeholder="Part name or repair description"
                                  value={line.name}
                                  onChange={(e) => updateLine(idx, { name: e.target.value })}
                                  className="h-7 text-xs bg-background"
                                  required
                                />
                              )}
                            </td>

                            {/* Quantity */}
                            <td className="p-2">
                              {isReadOnly ? (
                                <span className="font-mono text-center block text-foreground">
                                  {line.quantity}
                                </span>
                              ) : (
                                <Input
                                  type="number"
                                  min={1}
                                  value={line.quantity}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      quantity: parseInt(e.target.value, 10) || 1,
                                    })
                                  }
                                  className="h-7 text-xs text-center font-mono bg-background"
                                />
                              )}
                            </td>

                            {/* Unit Cost */}
                            <td className="p-2">
                              {isReadOnly ? (
                                <span className="font-mono text-right block text-foreground">
                                  {line.unitCost.toLocaleString()}
                                </span>
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  step={50}
                                  value={line.unitCost}
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      unitCost: parseInt(e.target.value, 10) || 0,
                                    })
                                  }
                                  className="h-7 text-xs text-right font-mono bg-background"
                                />
                              )}
                            </td>

                            {/* Line Total */}
                            <td className="p-2 text-right font-mono font-bold text-foreground">
                              PKR {lineTotal.toLocaleString()}
                            </td>

                            {/* Delete Action */}
                            {!isReadOnly && (
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="text-muted-foreground hover:text-rose-600 transition-colors p-1 rounded"
                                  title="Remove item"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Live Subtotals & Totals Card */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-muted-foreground">Parts Subtotal:</span>
                  <p className="font-mono font-bold text-foreground">
                    PKR {partsSubtotal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Labour Subtotal:</span>
                  <p className="font-mono font-bold text-foreground">
                    PKR {labourSubtotal.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Live Total Preview
                </span>
                <p className="font-mono text-xl font-black text-primary">
                  PKR {grandTotal.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-border pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isSubmitting || lines.length === 0}
                className="text-xs gap-1.5"
              >
                <Save className="size-3.5" />
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSubmitReview}
                disabled={isSaving || isSubmitting || lines.length === 0}
                className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Send className="size-3.5" />
                {isSubmitting ? "Submitting..." : "Submit to SA for Review"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
