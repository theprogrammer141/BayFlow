"use client";

import * as React from "react";
import { Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MOCK_CUSTOMER_BOOKINGS } from "@/mocks/customer";
import type { BookingSummary } from "@/lib/contracts/booking";

export default function SaDashboardPage() {
  const columns: Column<BookingSummary>[] = [
    {
      key: "id",
      header: "Booking #",
      cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground text-xs">
            {row.vehicle?.make} {row.vehicle?.model}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.vehicle?.regNo}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="text-xs font-medium text-foreground">{row.customer?.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.customer?.phone}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "notes",
      header: "Notes",
      cell: (row) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
          {row.customerNotes ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: () => (
        <Button size="xs" variant="outline" className="text-[11px]">
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Filter className="size-3.5" />
            All Statuses
          </Button>
        </div>
        <Button size="sm" className="gap-1.5 text-xs">
          <Plus className="size-3.5" />
          New Walk-in Check-In
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={MOCK_CUSTOMER_BOOKINGS}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}
