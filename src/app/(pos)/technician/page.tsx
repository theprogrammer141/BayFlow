"use client";

import * as React from "react";
import {
  Wrench,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building2,
  Play,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { EstimateBuilderModal } from "@/components/technician/estimate-builder-modal";
import { RepairQcModal } from "@/components/technician/repair-qc-modal";
import type { FullBookingDetail } from "@/components/sa/booking-detail-modal";

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

export default function TechnicianDashboardPage() {
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
  const [loginEmail, setLoginEmail] = React.useState("tech@bayflow.demo");
  const [loginPassword, setLoginPassword] = React.useState("password123");
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Action feedback toast
  const [toastMessage, setToastMessage] = React.useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Modal states
  const [estimateModalProps, setEstimateModalProps] = React.useState<{
    isOpen: boolean;
    bookingId: string;
    vehicleSummary: string;
    isReadOnly: boolean;
  }>({
    isOpen: false,
    bookingId: "",
    vehicleSummary: "",
    isReadOnly: false,
  });

  const [repairModalProps, setRepairModalProps] = React.useState<{
    isOpen: boolean;
    bookingId: string;
  }>({
    isOpen: false,
    bookingId: "",
  });

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // 1. Fetch authenticated user profile & memberships
  React.useEffect(() => {
    let mounted = true;

    async function initUser() {
      try {
        const data = await apiClient<MeResponse>("/api/auth/me");
        if (mounted) {
          setUser(data.user);
          const eligible = data.user.memberships.filter(
            (m) => (m.role === "TECHNICIAN" || m.role === "OWNER") && m.isActive
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

  // 2. Fetch assigned jobs for technician
  React.useEffect(() => {
    if (!activeShopId) return;

    let mounted = true;

    async function loadAssignedJobs() {
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
          setError(err instanceof ApiClientError ? err.message : "Failed to load assigned jobs");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadAssignedJobs();

    return () => {
      mounted = false;
    };
  }, [activeShopId, selectedStatus, refreshIndex]);

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setRefreshIndex((i) => i + 1);
  };

  // Quick Technician Login
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
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

  // Start Inspection handler (ASSIGNED -> INSPECTING)
  const handleStartInspection = async (booking: FullBookingDetail) => {
    if (!activeShopId) return;

    try {
      await apiClient(`/api/shops/${activeShopId}/bookings/${booking.id}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "INSPECTING",
          note: "Technician began diagnostic vehicle inspection on lift.",
        }),
      });

      showToast(`Started diagnostic inspection on #${booking.id.slice(-6)}!`);
      triggerRefresh();
      // Directly open estimate builder for convenience
      setEstimateModalProps({
        isOpen: true,
        bookingId: booking.id,
        vehicleSummary: `${booking.vehicle?.make} ${booking.vehicle?.model} (${booking.vehicle?.regNo})`,
        isReadOnly: false,
      });
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to start inspection", true);
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
      const notes = b.customerNotes?.toLowerCase() ?? "";
      const id = b.id.toLowerCase();
      return (
        reg.includes(q) ||
        make.includes(q) ||
        model.includes(q) ||
        customer.includes(q) ||
        notes.includes(q) ||
        id.includes(q)
      );
    });
  }, [bookings, searchQuery]);

  // Unauthenticated Technician Portal
  if (!user && !isLoading) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5">
        <div className="text-center space-y-1.5">
          <div className="flex size-12 mx-auto items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wrench className="size-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Technician Workbench Sign-In
          </h2>
          <p className="text-xs text-muted-foreground">
            Sign in with authorized technician credentials to view assigned repair jobs, conduct inspections, and prepare estimates.
          </p>
        </div>

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
            {isLoggingIn ? "Signing in..." : "Sign in as Technician"}
          </Button>

          <div className="pt-2 border-t border-border/60 text-center">
            <p className="text-[11px] text-muted-foreground">
              Demo credentials: <span className="font-mono text-foreground">tech@bayflow.demo</span> /{" "}
              <span className="font-mono text-foreground">password123</span>
            </p>
          </div>
        </form>
      </div>
    );
  }

  // Status Filter Tabs
  const statusTabs: Array<{ id: string; label: string }> = [
    { id: "ALL", label: "All Assigned" },
    { id: "ASSIGNED", label: "Awaiting Inspection" },
    { id: "INSPECTING", label: "Inspecting & Estimate" },
    { id: "ESTIMATE_REVIEW", label: "In SA Review" },
    { id: "IN_REPAIR", label: "Active Repairs" },
    { id: "QC_PENDING", label: "QC Queue" },
    { id: "COMPLETED", label: "Completed" },
  ];

  // Table Columns Definition
  const columns: Column<FullBookingDetail>[] = [
    {
      key: "id",
      header: "Job ID",
      cell: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-primary">
            #{row.id.slice(-6)}
          </span>
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
      key: "notes",
      header: "Customer Problem Description",
      cell: (row) => (
        <div className="max-w-xs space-y-1">
          <p className="text-xs text-foreground line-clamp-2">
            {row.customerNotes ?? "Periodic diagnostic inspection requested."}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">
            Customer: {row.customer?.name}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Job Status",
      cell: (row) => {
        const hasQcIssue = row.status === "IN_REPAIR" && (row.qcIssues?.length ?? 0) > 0;
        return (
          <div className="space-y-1">
            <StatusBadge status={row.status} />
            {hasQcIssue && (
              <span className="inline-flex items-center gap-1 font-bold text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="size-3" />
                QC Defect
              </span>
            )}
          </div>
        );
      },
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
                Rev #{row.estimate.revision}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Draft pending</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => {
        const hasQcIssue = row.status === "IN_REPAIR" && (row.qcIssues?.length ?? 0) > 0;

        return (
          <div className="flex items-center gap-1.5">
            {row.status === "ASSIGNED" && (
              <Button
                size="xs"
                onClick={() => handleStartInspection(row)}
                className="text-[11px] gap-1 bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
              >
                <Play className="size-3 fill-current" />
                Start Inspection
              </Button>
            )}

            {row.status === "INSPECTING" && (
              <Button
                size="xs"
                onClick={() =>
                  setEstimateModalProps({
                    isOpen: true,
                    bookingId: row.id,
                    vehicleSummary: `${row.vehicle?.make} ${row.vehicle?.model} (${row.vehicle?.regNo})`,
                    isReadOnly: false,
                  })
                }
                className="text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold active:scale-[0.98] transition-transform"
              >
                <FileText className="size-3" />
                Build Estimate
              </Button>
            )}

            {row.status === "IN_REPAIR" && (
              <Button
                size="xs"
                onClick={() =>
                  setRepairModalProps({
                    isOpen: true,
                    bookingId: row.id,
                  })
                }
                className={`text-[11px] gap-1 font-semibold active:scale-[0.98] transition-transform ${
                  hasQcIssue
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {hasQcIssue ? (
                  <>
                    <AlertTriangle className="size-3" />
                    Review QC Issue
                  </>
                ) : (
                  <>
                    <Wrench className="size-3" />
                    Repair & QC
                  </>
                )}
              </Button>
            )}

            {/* Read-only Estimate / Job Details */}
            {row.status !== "ASSIGNED" && row.status !== "INSPECTING" && row.status !== "IN_REPAIR" && (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  setEstimateModalProps({
                    isOpen: true,
                    bookingId: row.id,
                    vehicleSummary: `${row.vehicle?.make} ${row.vehicle?.model} (${row.vehicle?.regNo})`,
                    isReadOnly: true,
                  })
                }
                className="text-[11px] gap-1 active:scale-[0.98] transition-transform"
              >
                <FileText className="size-3" />
                View Estimate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Feedback Banner */}
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

      {/* Workshop Switcher & Technician Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Technician Job Queue
            </h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              Floor Station
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diagnose vehicles, build part & labour estimates, perform approved repairs, and submit for QC inspection.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Technician KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Assigned to Me
          </p>
          <p className="font-mono text-2xl font-bold text-foreground mt-1">
            {statusCounts.ALL ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            Ready to Inspect
          </p>
          <p className="font-mono text-2xl font-bold text-blue-800 dark:text-blue-300 mt-1">
            {statusCounts.ASSIGNED ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Inspecting
          </p>
          <p className="font-mono text-2xl font-bold text-amber-800 dark:text-amber-300 mt-1">
            {statusCounts.INSPECTING ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
          <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            In Repair
          </p>
          <p className="font-mono text-2xl font-bold text-indigo-800 dark:text-indigo-300 mt-1">
            {statusCounts.IN_REPAIR ?? 0}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
            QC Queue
          </p>
          <p className="font-mono text-2xl font-bold text-purple-800 dark:text-purple-300 mt-1">
            {statusCounts.QC_PENDING ?? 0}
          </p>
        </div>
      </div>

      {/* Status Filter Tabs & Search */}
      <div className="space-y-3">
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

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reg #, car, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>

          <p className="text-xs text-muted-foreground self-start sm:self-center">
            Showing <span className="font-mono font-semibold text-foreground">{filteredBookings.length}</span>{" "}
            assigned jobs
          </p>
        </div>
      </div>

      {/* Main Jobs Table */}
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
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title="No jobs assigned"
          description={
            searchQuery
              ? `No assigned jobs match search term "${searchQuery}".`
              : `You currently have no jobs in ${selectedStatus} status.`
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
      <EstimateBuilderModal
        isOpen={estimateModalProps.isOpen}
        onClose={() => setEstimateModalProps((prev) => ({ ...prev, isOpen: false }))}
        shopId={activeShopId ?? ""}
        bookingId={estimateModalProps.bookingId}
        vehicleSummary={estimateModalProps.vehicleSummary}
        isReadOnly={estimateModalProps.isReadOnly}
        onSuccess={() => {
          showToast("Estimate updated successfully!");
          triggerRefresh();
        }}
      />

      <RepairQcModal
        isOpen={repairModalProps.isOpen}
        onClose={() => setRepairModalProps((prev) => ({ ...prev, isOpen: false }))}
        shopId={activeShopId ?? ""}
        bookingId={repairModalProps.bookingId}
        onSuccess={() => {
          showToast("Job sent to QC Inspector queue!");
          triggerRefresh();
        }}
      />
    </div>
  );
}
