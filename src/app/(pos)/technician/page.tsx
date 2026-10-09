"use client";

import * as React from "react";
import { Wrench, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MOCK_TECHNICIAN_JOBS } from "@/mocks/shopfloor";
import type { BookingSummary } from "@/lib/contracts/booking";

export default function TechnicianDashboardPage() {
  const columns: Column<BookingSummary>[] = [
    {
      key: "id",
      header: "Job ID",
      cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
    },
    {
      key: "vehicle",
      header: "Vehicle Details",
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground text-xs">
            {row.vehicle?.make} {row.vehicle?.model} ({row.vehicle?.year})
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.vehicle?.regNo}</p>
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
      header: "Reported Issues",
      cell: (row) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-sm">
          {row.customerNotes ?? "General diagnostic"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <Button size="xs" className="gap-1 text-[11px]">
          {row.status === "INSPECTING" ? "Build Estimate" : "View Job"}
          <ArrowRight className="size-3" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wrench className="size-4 text-primary" />
          My Assigned Jobs ({MOCK_TECHNICIAN_JOBS.length})
        </h3>
      </div>

      <DataTable
        columns={columns}
        data={MOCK_TECHNICIAN_JOBS}
        keyExtractor={(row) => row.id}
        emptyTitle="No jobs currently assigned"
        emptyDescription="When a Service Advisor assigns an inspection or repair, it will appear here."
      />
    </div>
  );
}
