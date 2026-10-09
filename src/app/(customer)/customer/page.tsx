"use client";

import * as React from "react";
import { FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { MOCK_CUSTOMER_BOOKINGS } from "@/mocks/customer";

export default function CustomerDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          My Active Vehicle Service
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time updates, timeline diagnostics, and estimate approvals.
        </p>
      </div>

      <div className="space-y-6">
        {MOCK_CUSTOMER_BOOKINGS.map((booking) => (
          <Card key={booking.id} className="overflow-hidden border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {booking.vehicle?.regNo}
                    </span>
                    <CardTitle className="text-lg font-bold">
                      {booking.vehicle?.make} {booking.vehicle?.model} ({booking.vehicle?.year})
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Booking #{booking.id} • Registered to {booking.customer?.name}
                  </CardDescription>
                </div>
                <div>
                  <StatusBadge status={booking.status} />
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Action Banner for Awaiting Customer */}
              {booking.status === "AWAITING_CUSTOMER" && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Detailed Estimate Ready for Review
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        The workshop has inspected your vehicle and composed an itemized quote.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto text-xs">
                      Decline
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto text-xs">
                      View & Approve
                    </Button>
                  </div>
                </div>
              )}

              {/* Status Timeline */}
              <div className="rounded-xl border border-border/70 bg-background/50 p-4 sm:p-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Live Service Progress
                </h4>
                <StatusTimeline currentStatus={booking.status} />
              </div>

              {/* Customer Notes */}
              {booking.customerNotes && (
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
                  <FileText className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Reported Concerns: </span>
                    {booking.customerNotes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
