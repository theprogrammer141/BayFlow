"use client";

import * as React from "react";
import {
  Users,
  Search,
  RefreshCw,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { StatusActions } from "@/components/sa/status-actions";
import { BookingDetailModal, type FullBookingDetail } from "@/components/sa/booking-detail-modal";
import { AssignStaffModal } from "@/components/sa/assign-staff-modal";
import { EstimateEditorModal } from "@/components/sa/estimate-editor-modal";
import { CancelBookingModal } from "@/components/sa/cancel-booking-modal";
import type { SaActionType } from "@/lib/sa/action-rules";

interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    isCustomer: boolean;
    memberships: Array<{
      id: string;
      shopId: string;
      role: string;
      isActive: boolean;
      shop?: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface ShopBookingsResponse {
  bookings: FullBookingDetail[];
  counts: Record<string, number>;
}

export default function SaDashboardPage() {
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);
  const [activeShopId, setActiveShopId] = React.useState<string | null>(null);
  const [activeShopName, setActiveShopName] = React.useState<string>("");
  const [shopsList, setShopsList] = React.useState<Array<{ id: string; name: string }>>([]);

  // Data states
  const [bookings, setBookings] = React.useState<FullBookingDetail[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<Record<string, number>>({});
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const [authVersion, setAuthVersion] = React.useState(0);

  // Auth login fallback states
  const [loginEmail, setLoginEmail] = React.useState("sa@bayflow.demo");
  const [loginPassword, setLoginPassword] = React.useState("password123");
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Modal states
  const [selectedBookingId, setSelectedBookingId] = React.useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = React.useState(false);

  const [staffModalProps, setStaffModalProps] = React.useState<{
    isOpen: boolean;
    bookingId: string;
    role: "TECHNICIAN" | "PARTS_PERSON";
  }>({
    isOpen: false,
    bookingId: "",
    role: "TECHNICIAN",
  });

  const [estimateModalProps, setEstimateModalProps] = React.useState<{
    isOpen: boolean;
    bookingId: string;
    isLocked: boolean;
  }>({
    isOpen: false,
    bookingId: "",
    isLocked: false,
  });

  const [cancelModalProps, setCancelModalProps] = React.useState<{
    isOpen: boolean;
    bookingId: string;
    status: string;
  }>({
    isOpen: false,
    bookingId: "",
    status: "",
  });

  // Action toast / feedback message
  const [toastMessage, setToastMessage] = React.useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // 1. Fetch current user profile
  React.useEffect(() => {
    let mounted = true;

    async function initUser() {
      try {
        const data = await apiClient<MeResponse>("/api/auth/me");
        if (mounted) {
          setUser(data.user);
          const eligible = data.user.memberships.filter(
            (m) => (m.role === "SERVICE_ADVISOR" || m.role === "OWNER") && m.isActive
          );
          if (eligible.length > 0) {
            setShopsList(
              eligible.map((m) => ({
                id: m.shopId,
                name: m.shop?.name ?? `Shop ${m.shopId.slice(-6)}`,
              }))
            );
            setActiveShopId((prev) => prev ?? eligible[0].shopId);
            setActiveShopName(
              (prev) => prev || (eligible[0].shop?.name ?? `Shop ${eligible[0].shopId.slice(-6)}`)
            );
          } else {
            setActiveShopId(null);
            setActiveShopName("");
            setShopsList([]);
            setIsLoading(false);
          }
        }
      } catch {
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    void initUser();

    return () => {
      mounted = false;
    };
  }, [authVersion]);

  // 2. Fetch shop bookings
  React.useEffect(() => {
    if (!activeShopId) return;

    let mounted = true;

    async function loadBookings() {
      try {
        const queryParam = selectedStatus !== "ALL" ? `?status=${selectedStatus}` : "";
        const data = await apiClient<ShopBookingsResponse>(
          `/api/shops/${activeShopId}/bookings${queryParam}`
        );
        if (mounted) {
          setBookings(data.bookings || []);
          setStatusCounts(data.counts || {});
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load bookings");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadBookings();

    return () => {
      mounted = false;
    };
  }, [activeShopId, selectedStatus, refreshIndex]);

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setRefreshIndex((i) => i + 1);
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await apiClient("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setActiveShopId(null);
      setBookings([]);
      setAuthVersion((v) => v + 1);
    }
  };

  // Quick Staff Login handler
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      try {
        await apiClient("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore logout error
      }

      await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      setAuthVersion((v) => v + 1);
    } catch (err) {
      setLoginError(err instanceof ApiClientError ? err.message : "Invalid credentials");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Direct action executor
  const handleActionTrigger = async (
    action: SaActionType,
    booking: FullBookingDetail
  ) => {
    if (!activeShopId) return;

    switch (action) {
      case "CONFIRM": {
        try {
          await apiClient(`/api/shops/${activeShopId}/bookings/${booking.id}/transition`, {
            method: "POST",
            body: JSON.stringify({
              to: "CONFIRMED",
              note: "Booking confirmed by Service Advisor",
            }),
          });
          showToast(`Booking #${booking.id.slice(-6)} confirmed successfully!`);
          triggerRefresh();
        } catch (err) {
          showToast(err instanceof ApiClientError ? err.message : "Confirmation failed", true);
        }
        break;
      }

      case "ASSIGN_TECHNICIAN": {
        setStaffModalProps({
          isOpen: true,
          bookingId: booking.id,
          role: "TECHNICIAN",
        });
        break;
      }

      case "EDIT_ESTIMATE": {
        setEstimateModalProps({
          isOpen: true,
          bookingId: booking.id,
          isLocked: Boolean(booking.estimate?.sentAt),
        });
        break;
      }

      case "SEND_ESTIMATE": {
        try {
          await apiClient(`/api/shops/${activeShopId}/bookings/${booking.id}/transition`, {
            method: "POST",
            body: JSON.stringify({
              to: "AWAITING_CUSTOMER",
              note: "Estimate sent to customer for approval",
            }),
          });
          showToast(`Estimate for #${booking.id.slice(-6)} sent to customer and locked!`);
          triggerRefresh();
        } catch (err) {
          showToast(err instanceof ApiClientError ? err.message : "Failed to send estimate", true);
        }
        break;
      }

      case "REVISE_ESTIMATE": {
        try {
          await apiClient(`/api/shops/${activeShopId}/bookings/${booking.id}/transition`, {
            method: "POST",
            body: JSON.stringify({
              to: "ESTIMATE_REVIEW",
              note: "Returned to technician for price / scope revision",
            }),
          });
          showToast(`Booking #${booking.id.slice(-6)} returned to Estimate Review (revision bumped)!`);
          triggerRefresh();
        } catch (err) {
          showToast(err instanceof ApiClientError ? err.message : "Revision trigger failed", true);
        }
        break;
      }

      case "ASSIGN_PARTS": {
        setStaffModalProps({
          isOpen: true,
          bookingId: booking.id,
          role: "PARTS_PERSON",
        });
        break;
      }

      case "NOTIFY_READY": {
        try {
          await apiClient(`/api/shops/${activeShopId}/bookings/${booking.id}/notify-ready`, {
            method: "POST",
          });
          showToast(`Customer notified vehicle is ready for pickup!`);
          triggerRefresh();
        } catch (err) {
          showToast(err instanceof ApiClientError ? err.message : "Notification failed", true);
        }
        break;
      }

      case "COMPLETE": {
        try {
          await apiClient(`/api/shops/${activeShopId}/bookings/${booking.id}/transition`, {
            method: "POST",
            body: JSON.stringify({
              to: "COMPLETED",
              note: "Vehicle successfully handed over to customer",
            }),
          });
          showToast(`Booking #${booking.id.slice(-6)} completed & archived!`);
          triggerRefresh();
        } catch (err) {
          showToast(err instanceof ApiClientError ? err.message : "Completion failed", true);
        }
        break;
      }

      case "CANCEL": {
        setCancelModalProps({
          isOpen: true,
          bookingId: booking.id,
          status: booking.status,
        });
        break;
      }
    }
  };

  // Client-side search filtering
  const filteredBookings = React.useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b) => {
      const reg = b.vehicle?.regNo?.toLowerCase() ?? "";
      const make = b.vehicle?.make?.toLowerCase() ?? "";
      const model = b.vehicle?.model?.toLowerCase() ?? "";
      const customer = b.customer?.name?.toLowerCase() ?? "";
      const phone = b.customer?.phone?.toLowerCase() ?? "";
      const id = b.id.toLowerCase();
      return (
        reg.includes(q) ||
        make.includes(q) ||
        model.includes(q) ||
        customer.includes(q) ||
        phone.includes(q) ||
        id.includes(q)
      );
    });
  }, [bookings, searchQuery]);

  // Gate: Unauthenticated OR non-SA user
  const hasSaRole = Boolean(
    user?.memberships.some((m) => (m.role === "SERVICE_ADVISOR" || m.role === "OWNER") && m.isActive)
  );

  if ((!user || !hasSaRole) && !isLoading) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5">
        <div className="text-center space-y-1.5">
          <div className="flex size-12 mx-auto items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Service Advisor Portal
          </h2>
          <p className="text-xs text-muted-foreground">
            Sign in with authorized workshop credentials to manage customer bookings and repair intake.
          </p>
        </div>

        {user && !hasSaRole && (
          <div className="flex items-center gap-2 p-3 text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              Signed in as <strong>{user.name}</strong> ({user.email}). A Service Advisor or Owner role is required.
            </span>
          </div>
        )}

        {loginError && (
          <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
            <AlertCircle className="size-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleQuickLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Email</label>
            <Input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Password</label>
            <Input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="text-xs"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full text-xs font-semibold gap-1.5 active:scale-[0.98] transition-transform"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Signing in..." : "Sign in as Service Advisor"}
          </Button>

          <div className="pt-2 border-t border-border/60 text-center">
            <p className="text-[11px] text-muted-foreground">
              Demo credentials: <span className="font-mono text-foreground">sa@bayflow.demo</span> /{" "}
              <span className="font-mono text-foreground">password123</span>
            </p>
          </div>
        </form>
      </div>
    );
  }

  // Status Filter Tabs
  const statusTabs: Array<{ id: string; label: string }> = [
    { id: "ALL", label: "All Bookings" },
    { id: "PENDING", label: "Intake Queue" },
    { id: "CONFIRMED", label: "Confirmed" },
    { id: "ASSIGNED", label: "Assigned" },
    { id: "ESTIMATE_REVIEW", label: "Estimate Review" },
    { id: "AWAITING_CUSTOMER", label: "Awaiting Customer" },
    { id: "ESTIMATE_APPROVED", label: "Approved" },
    { id: "ESTIMATE_REJECTED", label: "Rejected" },
    { id: "PARTS_PENDING", label: "Parts Pending" },
    { id: "PARTS_READY", label: "Parts Ready" },
    { id: "READY_FOR_PICKUP", label: "Ready for Pickup" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  // Table Columns Definition
  const columns: Column<FullBookingDetail>[] = [
    {
      key: "id",
      header: "Booking #",
      cell: (row) => (
        <div>
          <button
            type="button"
            onClick={() => {
              setSelectedBookingId(row.id);
              setShowDetailModal(true);
            }}
            className="font-mono text-xs font-bold text-primary hover:underline"
          >
            #{row.id.slice(-6)}
          </button>
          <p className="text-[10px] text-muted-foreground font-mono">
            {new Date(row.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle Details",
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground text-xs">
            {row.vehicle?.make} {row.vehicle?.model}{" "}
            <span className="text-muted-foreground font-normal">({row.vehicle?.year})</span>
          </p>
          <span className="inline-block font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground border border-border mt-0.5">
            {row.vehicle?.regNo}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="text-xs font-medium text-foreground">{row.customer?.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.customer?.phone ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "estimate",
      header: "Estimate",
      cell: (row) => (
        <div>
          {row.estimate ? (
            <div>
              <p className="font-mono text-xs font-semibold text-foreground">
                PKR {row.estimate.total.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Rev #{row.estimate.revision}{" "}
                {row.estimate.sentAt && <span className="text-amber-600 font-medium">(Locked)</span>}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
        </div>
      ),
    },
    {
      key: "staff",
      header: "Assigned Staff",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          {row.technician && (
            <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
              <Wrench className="size-3" />
              <span>{row.technician.name}</span>
            </div>
          )}
          {row.partsPerson && (
            <div className="flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400">
              <span>Parts: {row.partsPerson.name}</span>
            </div>
          )}
          {!row.technician && !row.partsPerson && (
            <span className="text-muted-foreground text-[11px] italic">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Workflow Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <StatusActions
            status={row.status}
            readyNotifiedAt={row.readyNotifiedAt}
            onAction={(act) => handleActionTrigger(act, row)}
            isLoading={isRefreshing}
          />
          <Button
            size="xs"
            variant="outline"
            className="text-[11px] active:scale-[0.98] transition-transform"
            onClick={() => {
              setSelectedBookingId(row.id);
              setShowDetailModal(true);
            }}
          >
            Manage
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 p-3.5 rounded-xl shadow-lg border text-xs font-semibold transition-all ${
            toastMessage.isError
              ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
          }`}
        >
          {toastMessage.isError ? (
            <AlertCircle className="size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Workshop Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Service Advisor Dashboard
            </h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              Shop POS
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Intake control, estimate revisions, technician dispatching, customer communication &
            handover.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs">
              <Users className="size-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{user.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono">({user.email})</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-foreground active:scale-[0.98] transition-transform"
          >
            Sign Out
          </Button>

          {shopsList.length > 1 ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
              <Building2 className="size-4 text-muted-foreground" />
              <select
                value={activeShopId ?? ""}
                onChange={(e) => {
                  setActiveShopId(e.target.value);
                  const selected = shopsList.find((s) => s.id === e.target.value);
                  if (selected) setActiveShopName(selected.name);
                }}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {shopsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
              <Building2 className="size-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{activeShopName || "My Workshop"}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={triggerRefresh}
            disabled={isRefreshing}
            className="text-xs gap-1.5 active:scale-[0.98] transition-transform"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cockpit Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Bookings
          </p>
          <p className="font-mono text-2xl font-bold text-foreground mt-1">
            {statusCounts.ALL ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Intake Queue
          </p>
          <p className="font-mono text-2xl font-bold text-amber-800 dark:text-amber-300 mt-1">
            {statusCounts.PENDING ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
            Estimate Review
          </p>
          <p className="font-mono text-2xl font-bold text-purple-800 dark:text-purple-300 mt-1">
            {statusCounts.ESTIMATE_REVIEW ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5">
          <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
            Ready for Pickup
          </p>
          <p className="font-mono text-2xl font-bold text-sky-800 dark:text-sky-300 mt-1">
            {statusCounts.READY_FOR_PICKUP ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Completed
          </p>
          <p className="font-mono text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
            {statusCounts.COMPLETED ?? 0}
          </p>
        </div>
      </div>

      {/* Status Filter Pills & Search */}
      <div className="space-y-3">
        {/* Horizontal scrollable status pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusTabs.map((tab) => {
            const count =
              tab.id === "ALL" ? statusCounts.ALL ?? 0 : statusCounts[tab.id] ?? 0;
            const isSelected = selectedStatus === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reg #, customer, car..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>

          <p className="text-xs text-muted-foreground self-start sm:self-center">
            Showing <span className="font-mono font-semibold text-foreground">{filteredBookings.length}</span>{" "}
            records
          </p>
        </div>
      </div>

      {/* Main Bookings Data Table */}
      {error ? (
        <div className="p-8 text-center rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 space-y-2">
          <AlertCircle className="size-6 text-rose-600 mx-auto" />
          <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">{error}</p>
          <Button size="xs" variant="outline" onClick={triggerRefresh}>
            Try Again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          <div className="h-12 bg-muted animate-pulse rounded-lg" />
          <div className="h-12 bg-muted animate-pulse rounded-lg" />
          <div className="h-12 bg-muted animate-pulse rounded-lg" />
          <div className="h-12 bg-muted animate-pulse rounded-lg" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title="No bookings match current filters"
          description={
            searchQuery
              ? `No bookings match search term "${searchQuery}".`
              : `There are currently no bookings in ${selectedStatus} status.`
          }
          action={
            searchQuery ? (
              <Button size="xs" variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredBookings}
          keyExtractor={(row) => row.id}
        />
      )}

      {/* Modals */}
      {selectedBookingId && (
        <BookingDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBookingId(null);
          }}
          shopId={activeShopId!}
          bookingId={selectedBookingId}
          onTriggerAction={(act, booking) => {
            setShowDetailModal(false);
            void handleActionTrigger(act, booking);
          }}
          onRefresh={triggerRefresh}
        />
      )}

      <AssignStaffModal
        isOpen={staffModalProps.isOpen}
        onClose={() => setStaffModalProps((prev) => ({ ...prev, isOpen: false }))}
        shopId={activeShopId ?? ""}
        bookingId={staffModalProps.bookingId}
        role={staffModalProps.role}
        onSuccess={() => {
          showToast(
            `${staffModalProps.role === "TECHNICIAN" ? "Technician" : "Parts specialist"} assigned successfully!`
          );
          triggerRefresh();
        }}
      />

      <EstimateEditorModal
        isOpen={estimateModalProps.isOpen}
        onClose={() => setEstimateModalProps((prev) => ({ ...prev, isOpen: false }))}
        shopId={activeShopId ?? ""}
        bookingId={estimateModalProps.bookingId}
        isLocked={estimateModalProps.isLocked}
        onSuccess={() => {
          triggerRefresh();
        }}
      />

      <CancelBookingModal
        isOpen={cancelModalProps.isOpen}
        onClose={() => setCancelModalProps((prev) => ({ ...prev, isOpen: false }))}
        shopId={activeShopId ?? ""}
        bookingId={cancelModalProps.bookingId}
        currentStatus={cancelModalProps.status}
        onSuccess={() => {
          showToast(`Booking cancelled and inventory allocations restored.`);
          triggerRefresh();
        }}
      />
    </div>
  );
}
