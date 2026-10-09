"use client";

import * as React from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MOCK_PARTS } from "@/mocks/shopfloor";
import type { Part } from "@/lib/contracts/inventory";

export default function PartsDashboardPage() {
  const columns: Column<Part>[] = [
    {
      key: "sku",
      header: "SKU",
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.sku}</span>,
    },
    {
      key: "name",
      header: "Part Description",
      cell: (row) => <span className="font-medium text-xs text-foreground">{row.name}</span>,
    },
    {
      key: "quantity",
      header: "On Hand",
      cell: (row) => (
        <span
          className={`font-semibold text-xs ${
            row.quantity <= row.reorderLevel
              ? "text-rose-600 dark:text-rose-400"
              : "text-foreground"
          }`}
        >
          {row.quantity} units
        </span>
      ),
    },
    {
      key: "reorderLevel",
      header: "Reorder Threshold",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.reorderLevel} units</span>,
    },
    {
      key: "cost",
      header: "Unit Cost",
      cell: (row) => (
        <span className="font-mono text-xs text-foreground">
          PKR {row.cost.toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Stock Status",
      cell: (row) => {
        if (row.quantity === 0) {
          return (
            <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              Out of Stock
            </span>
          );
        }
        if (row.quantity <= row.reorderLevel) {
          return (
            <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Low Stock
            </span>
          );
        }
        return (
          <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            In Stock
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <Button size="xs" variant="outline" className="text-[11px]">
          {row.quantity <= row.reorderLevel ? "Order Stock" : "Adjust"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package className="size-4 text-primary" />
          Shop Parts Inventory ({MOCK_PARTS.length})
        </h3>
        <Button size="sm" className="gap-1.5 text-xs">
          <Plus className="size-3.5" />
          Add Part to Catalog
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={MOCK_PARTS}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}
