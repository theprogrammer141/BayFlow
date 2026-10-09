"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  AlertCircle,
  Plus,
  Car,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  ExternalLink,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { MOCK_CUSTOMER_BOOKINGS } from "@/mocks/customer";
import type { BookingStatus } from "@/lib/contracts/common";

interface CustomerBookingSummary {
  id: string;
  shopId: string;
  customerId: string;
  vehicleId: string;
  slotId: string;
  status: BookingStatus;
  customerNotes?: string | null;
  technicianId?: string | null;
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
  };
  shop?: {
    name: string;
    city: string;
    address: string;
  };
  slot?: {
    startsAt: string;
  };
  estimate?: {
    id: string;
    revision: number;
    total: number;
    sentAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    items?: Array<{
      id: string;
      type: "PART" | "LABOUR";
      name: string;
      quantity: number;
      unitCost: number;
    }>;
  } | null;
}

export default function CustomerDashboardPage() {
  const [bookings, setBookings] = React.useState<CustomerBookingSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUnauthorized, setIsUnauthorized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Quick login state for unauthorized view
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Transition in-progress state
  const [actionBookingId, setActionBookingId] = React.useState<string | null>(null);

  const [refreshIndex, setRefreshIndex] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      setIsUnauthorized(false);
      try {
        const data = await apiClient<CustomerBookingSummary[]>("/api/me/bookings");
        if (isMounted) {
          setBookings(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiClientError && err.status === 401) {
            setIsUnauthorized(true);
            setBookings([]);
          } else {
            const message = err instanceof ApiClientError ? err.message : "Failed to load bookings";
            setError(message);
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
  }, [refreshIndex]);

  const fetchBookings = () => {
    setRefreshIndex((i) => i + 1);
  };

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setIsUnauthorized(false);
      await fetchBookings();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLoginError(err.message);
      } else {
        setLoginError("Login failed. Check your credentials.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTransition = async (bookingId: string, to: BookingStatus, note?: string) => {
    setActionBookingId(bookingId);
    try {
      await apiClient(`/api/me/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({ to, note }),
      });
      await fetchBookings();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setActionBookingId(null);
    }
  };

  const loadDemoBookings = () => {
    setBookings(MOCK_CUSTOMER_BOOKINGS as unknown as CustomerBookingSummary[]);
    setIsUnauthorized(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            My Vehicle Services
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time workshop bay progress, timeline tracking, and transparent estimate approvals.
          </p>
        </div>

        <Link href="/book" className={buttonVariants({ size: "sm", className: "gap-1.5 shrink-0" })}>
          <Plus className="size-4" />
          Book New Service
        </Link>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 space-y-4 border-border">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      )}

      {/* Unauthorized State */}
      {!isLoading && isUnauthorized && (
        <div className="mx-auto max-w-md space-y-6">
          <Card className="border-border shadow-md text-center p-6 space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Customer Authentication Required</h2>
              <p className="text-xs text-muted-foreground">
                Sign in to view your live vehicle tracking and approve itemized quotes.
              </p>
            </div>

            {loginError && (
              <p className="text-xs font-medium text-destructive bg-destructive/10 p-2.5 rounded-lg">
                {loginError}
              </p>
            )}

            <form onSubmit={handleQuickLogin} className="space-y-3 text-left">
              <FormField id="dashEmail" label="Email Address" required>
                <Input
                  id="dashEmail"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </FormField>

              <FormField id="dashPass" label="Password" required>
                <Input
                  id="dashPass"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </FormField>

              <Button type="submit" size="sm" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing In..." : "Sign In to My Vehicles"}
              </Button>
            </form>

            <div className="border-t border-border pt-4 flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={loadDemoBookings}>
                View Demo Bookings (Preview Mode)
              </Button>
              <Link href="/book" className="text-xs text-primary hover:underline">
                Don&apos;t have a booking? Book an appointment now →
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* Error State */}
      {!isLoading && !isUnauthorized && error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
          <AlertCircle className="size-6 text-destructive mx-auto" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchBookings}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isUnauthorized && !error && bookings.length === 0 && (
        <Card className="border-dashed border-border p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Car className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">No active service appointments</h2>
            <p className="text-xs text-muted-foreground">
              You don&apos;t have any vehicles checked in or booked at our partner workshops.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/book" className={buttonVariants({ size: "sm" })}>
              Schedule a Service Bay
            </Link>
            <Button size="sm" variant="outline" onClick={loadDemoBookings}>
              Load Demo Bookings
            </Button>
          </div>
        </Card>
      )}

      {/* Bookings List */}
      {!isLoading && !isUnauthorized && !error && bookings.length > 0 && (
        <div className="space-y-6">
          {bookings.map((booking) => {
            const isActing = actionBookingId === booking.id;

            return (
              <Card
                key={booking.id}
                className="overflow-hidden border-border bg-card shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Booking Header */}
                <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                          {booking.vehicle?.regNo || "VEHICLE"}
                        </span>
                        <CardTitle className="text-lg font-bold">
                          {booking.vehicle?.make} {booking.vehicle?.model}{" "}
                          {booking.vehicle?.year ? `(${booking.vehicle.year})` : ""}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Booking #{booking.id} • {booking.shop?.name || "Workshop"}{" "}
                        {booking.shop?.city ? `(${booking.shop.city})` : ""}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={booking.status} />
                      <Link
                        href={`/customer/bookings/${booking.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "gap-1 text-xs hidden sm:inline-flex",
                        })}
                      >
                        Details
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Contextual Action Banner 1: Awaiting Customer Estimate Approval */}
                  {booking.status === "AWAITING_CUSTOMER" && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                            Detailed Repair Estimate Ready for Approval
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            The technician has inspected your vehicle. Estimated total:{" "}
                            <span className="font-mono font-bold">
                              PKR {booking.estimate?.total?.toLocaleString() ?? "N/A"}
                            </span>
                            .
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          onClick={() => {
                            const note =
                              prompt("Please specify reasons or items you decline:") || undefined;
                            handleTransition(booking.id, "ESTIMATE_REJECTED", note);
                          }}
                          className="w-full sm:w-auto text-xs gap-1 text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="size-3.5" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          disabled={isActing}
                          onClick={() => handleTransition(booking.id, "ESTIMATE_APPROVED")}
                          className="w-full sm:w-auto text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Approve Quote
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Contextual Action Banner 2: Ready for Pickup */}
                  {booking.status === "READY_FOR_PICKUP" && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                            Vehicle Ready for Collection!
                          </p>
                          <p className="text-xs text-emerald-800 dark:text-emerald-300">
                            All mechanical repairs and road test quality checks have passed. You may
                            pick up your car at the workshop.
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        disabled={isActing}
                        onClick={() => handleTransition(booking.id, "COMPLETED")}
                        className="w-full sm:w-auto text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark as Picked Up
                      </Button>
                    </div>
                  )}

                  {/* Contextual Action Banner 3: Booking Pending Confirmation */}
                  {booking.status === "PENDING" && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-4 shrink-0" />
                        <span>
                          Booking is pending confirmation by the shop Service Advisor. You can
                          cancel if needed.
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isActing}
                        onClick={() => {
                          if (confirm("Are you sure you want to cancel this booking?")) {
                            handleTransition(booking.id, "CANCELLED", "Customer cancelled appointment");
                          }
                        }}
                        className="text-destructive hover:bg-destructive/10 text-xs gap-1 shrink-0 h-7"
                      >
                        <Ban className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Status Timeline */}
                  <div className="rounded-xl border border-border/70 bg-background/50 p-4 sm:p-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Live Workshop Bay Progress
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

                  {/* Mobile link to details */}
                  <div className="pt-1 flex sm:hidden justify-end">
                    <Link
                      href={`/customer/bookings/${booking.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm", className: "w-full text-xs" })}
                    >
                      View Detailed Quote & History
                      <ExternalLink className="size-3 ml-1" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
