"use client";

import * as React from "react";
import { ShieldCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MOCK_QC_QUEUE } from "@/mocks/shopfloor";
import type { QcQueueItem } from "@/lib/contracts/qc";

export default function QcDashboardPage() {
  const columns: Column<QcQueueItem>[] = [
    {
      key: "bookingId",
      header: "Booking ID",
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.bookingId}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle Tested",
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground text-xs">{row.vehicleModel}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.vehicleRegNo}</p>
        </div>
      ),
    },
    {
      key: "technician",
      header: "Repairing Technician",
      cell: (row) => <span className="text-xs text-foreground font-medium">{row.technicianName}</span>,
    },
    {
      key: "enteredQcAt",
      header: "Entered Queue",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.enteredQcAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: () => (
        <Button size="xs" className="gap-1 text-[11px] bg-violet-600 hover:bg-violet-700 text-white">
          <Play className="size-3 fill-current" />
          Pick Inspection
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="size-4 text-violet-600" />
          Shared QC Queue — Pending Inspection ({MOCK_QC_QUEUE.length})
        </h3>
      </div>

      <DataTable
        columns={columns}
        data={MOCK_QC_QUEUE}
        keyExtractor={(row) => row.bookingId}
        emptyTitle="QC Queue Empty"
        emptyDescription="No vehicles currently awaiting quality control testing."
      />
    </div>
  );
}
