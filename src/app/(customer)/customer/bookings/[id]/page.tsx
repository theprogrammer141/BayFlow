"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Car,
  Store,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { BookingStatus } from "@/lib/contracts/common";

interface BookingDetail {
  id: string;
  shopId: string;
  customerId: string;
  vehicleId: string;
  slotId: string;
  status: BookingStatus;
  customerNotes?: string | null;
  readyNotifiedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    regNo: string;
    make: string;
    model: string;
    year: number;
    color?: string | null;
    mileage?: number | null;
  };
  shop?: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
  };
  slot?: {
    startsAt: string;
  };
  services?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    service: {
      name: string;
    };
  }>;
  estimate?: {
    id: string;
    revision: number;
    total: number;
    sentAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    items: Array<{
      id: string;
      type: "PART" | "LABOUR";
      name: string;
      quantity: number;
      unitCost: number;
    }>;
  } | null;
  history?: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: BookingStatus;
    note?: string | null;
    createdAt: string;
  }>;
}

function CustomerBookingDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = React.useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isActing, setIsActing] = React.useState(false);

  const [refreshIndex, setRefreshIndex] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient<BookingDetail>(`/api/me/bookings/${bookingId}`);
        if (isMounted) {
          setBooking(data);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiClientError) {
            if (err.status === 401) {
              setError("You must be signed in to view this booking.");
            } else if (err.status === 403) {
              setError("You do not have permission to view this booking.");
            } else {
              setError(err.message);
            }
          } else {
            setError("Failed to load booking details.");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [bookingId, refreshIndex]);

  const fetchBooking = () => {
    setRefreshIndex((i) => i + 1);
  };

  const handleTransition = async (to: BookingStatus, note?: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await apiClient(`/api/me/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({ to, note }),
      });
      await fetchBooking();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to update booking status.");
      }
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="size-8 text-destructive mx-auto" />
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground">Booking Inaccessible</h2>
          <p className="text-xs text-muted-foreground">{error || "Booking not found"}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button size="sm" variant="outline" onClick={() => router.push("/customer")}>
            Return to Dashboard
          </Button>
          <Button size="sm" onClick={fetchBooking}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const partsItems = booking.estimate?.items.filter((i) => i.type === "PART") || [];
  const labourItems = booking.estimate?.items.filter((i) => i.type === "LABOUR") || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/customer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Bookings
        </Link>
        <StatusBadge status={booking.status} />
      </div>

      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>{actionError}</span>
          <Button size="sm" variant="ghost" onClick={() => setActionError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
              {booking.vehicle?.regNo}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              {booking.vehicle?.make} {booking.vehicle?.model} ({booking.vehicle?.year})
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Booking #{booking.id} • Registered at {new Date(booking.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Quick Cancel for PENDING status */}
        {booking.status === "PENDING" && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            disabled={isActing}
            onClick={() => {
              if (confirm("Are you sure you want to cancel this booking appointment?")) {
                handleTransition("CANCELLED", "Customer cancelled appointment");
              }
            }}
          >
            <Ban className="size-3.5" />
            Cancel Appointment
          </Button>
        )}
      </div>

      {/* Contextual Action Banners */}
      {/* 1. Awaiting Customer Estimate Approval */}
      {booking.status === "AWAITING_CUSTOMER" && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Itemized Estimate Revision {booking.estimate?.revision || 1} Ready for Your Approval
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                The technician completed inspection. Total estimated cost is{" "}
                <span className="font-bold font-mono">
                  PKR {booking.estimate?.total.toLocaleString()}
                </span>
                . Please review the itemized breakdown below and approve or decline.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              size="sm"
              disabled={isActing}
              onClick={() => handleTransition("ESTIMATE_APPROVED")}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="size-4" />
              Approve Estimate (PKR {booking.estimate?.total.toLocaleString()})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isActing}
              onClick={() => {
                const note = prompt("Please provide a reason or modification request:") || undefined;
                handleTransition("ESTIMATE_REJECTED", note);
              }}
              className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <XCircle className="size-4" />
              Decline / Request Revision
            </Button>
          </div>
        </div>
      )}

      {/* 2. Ready For Pickup Banner */}
      {booking.status === "READY_FOR_PICKUP" && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                Your Vehicle is Ready for Collection!
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                All repairs and quality-control safety inspections have been passed. You may pick
                up your vehicle at {booking.shop?.name}.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            disabled={isActing}
            onClick={() => handleTransition("COMPLETED")}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <CheckCircle2 className="size-4" />
            Confirm Vehicle Collected
          </Button>
        </div>
      )}

      {/* Live Status Timeline */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Live Service Lifecycle
          </CardTitle>
          <CardDescription className="text-xs">
            Stages update in real time as your vehicle progresses through the workshop bays.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusTimeline currentStatus={booking.status} />
        </CardContent>
      </Card>

      {/* Itemized Estimate Section */}
      {booking.estimate && (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Itemized Repair Estimate (Revision {booking.estimate.revision})
              </CardTitle>
              <CardDescription className="text-xs">
                Transparent cost breakdown for required spare parts and mechanical labour.
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Total Estimate</span>
              <p className="font-mono text-lg font-black text-foreground">
                PKR {booking.estimate.total.toLocaleString()}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Parts Table */}
            {partsItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Spare Parts ({partsItems.length})
                </h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Item Name</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {partsItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium text-foreground">{item.name}</td>
                          <td className="py-2 px-3 text-center text-muted-foreground">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            PKR {item.unitCost.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                            PKR {(item.quantity * item.unitCost).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Labour Table */}
            {labourItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Mechanical Labour ({labourItems.length})
                </h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Operation Name</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {labourItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium text-foreground">{item.name}</td>
                          <td className="py-2 px-3 text-center text-muted-foreground">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            PKR {item.unitCost.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                            PKR {(item.quantity * item.unitCost).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workshop, Vehicle & Audit Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workshop Information */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Store className="size-4 text-primary" />
              Servicing Workshop
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="font-bold text-sm text-foreground">{booking.shop?.name}</p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {booking.shop?.address}, {booking.shop?.city}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" />
              {booking.shop?.phone}
            </p>
            {booking.slot?.startsAt && (
              <p className="text-primary font-medium flex items-center gap-1.5 pt-1">
                <Calendar className="size-3.5 shrink-0" />
                Bay Time: {new Date(booking.slot.startsAt).toUTCString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Information */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Car className="size-4 text-primary" />
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p className="font-bold text-sm text-foreground">
              {booking.vehicle?.make} {booking.vehicle?.model}
            </p>
            <p className="font-mono font-semibold text-muted-foreground">
              Reg: {booking.vehicle?.regNo} • Year: {booking.vehicle?.year}
            </p>
            {booking.vehicle?.color && (
              <p className="text-muted-foreground">Color: {booking.vehicle.color}</p>
            )}
            {booking.customerNotes && (
              <div className="pt-2 border-t border-border/50">
                <span className="font-semibold text-foreground">Reported Concerns: </span>
                <span className="text-muted-foreground">{booking.customerNotes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit History Log */}
      {booking.history && booking.history.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Audit Trail & Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {booking.history.map((h) => (
                <div key={h.id} className="flex items-start justify-between text-xs border-b border-border/40 pb-2.5">
                  <div>
                    <span className="font-semibold text-foreground">Status: {h.toStatus}</span>
                    {h.note && <p className="text-muted-foreground mt-0.5">{h.note}</p>}
                  </div>
                  <span className="text-muted-foreground shrink-0 font-mono">
                    {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CustomerBookingDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <CustomerBookingDetailPageContent />
    </React.Suspense>
  );
}

