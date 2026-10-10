"use client";

import * as React from "react";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  Truck,
  Boxes,
  Wrench,
  AlertTriangle,
  Building2,
  Sliders,
  CheckCircle2,
  Clock,
  Car,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { Part } from "@/lib/contracts/inventory";
import type { ShopPurchaseOrderWithDetails } from "@/lib/services/purchase-orders";
import type { FullBookingDetail } from "@/components/sa/booking-detail-modal";
import { AddPartModal } from "@/components/parts/add-part-modal";
import { AdjustStockModal } from "@/components/parts/adjust-stock-modal";
import { CreatePOModal, type PreloadedPOItem } from "@/components/parts/create-po-modal";
import { ReceivePOModal } from "@/components/parts/receive-po-modal";
import { ShortageCheckModal } from "@/components/parts/shortage-check-modal";

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

export default function PartsDashboardPage() {
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);
  const [activeShopId, setActiveShopId] = React.useState<string | null>(null);
  const [activeShopName, setActiveShopName] = React.useState<string>("");
  const [shopsList, setShopsList] = React.useState<Array<{ id: string; name: string }>>([]);

  // Active view tab
  const [activeTab, setActiveTab] = React.useState<"jobs" | "catalog" | "orders">("jobs");

  // Data states
  const [parts, setParts] = React.useState<Part[]>([]);
  const [purchaseOrders, setPurchaseOrders] = React.useState<ShopPurchaseOrderWithDetails[]>([]);
  const [partsBookings, setPartsBookings] = React.useState<FullBookingDetail[]>([]);

  // Search & filter states
  const [catalogSearch, setCatalogSearch] = React.useState("");
  const [catalogFilter, setCatalogFilter] = React.useState<"all" | "low" | "out">("all");
  const [jobFilter, setJobFilter] = React.useState<"ALL" | "PARTS_PENDING" | "PARTS_ORDERED" | "PARTS_READY">("ALL");
  const [poFilter, setPoFilter] = React.useState<"ALL" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED">("ALL");

  // Loading & error
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = React.useState<string | null>(null);

  // Quick login fallback states
  const [loginEmail, setLoginEmail] = React.useState("parts@bayflow.demo");
  const [loginPassword, setLoginPassword] = React.useState("password123");
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Modals
  const [isAddPartOpen, setIsAddPartOpen] = React.useState(false);
  const [adjustPart, setAdjustPart] = React.useState<Part | null>(null);
  const [isCreatePOOpen, setIsCreatePOOpen] = React.useState(false);
  const [createPOLinkedBookingId, setCreatePOLinkedBookingId] = React.useState<string | null>(null);
  const [createPOPreloadedItems, setCreatePOPreloadedItems] = React.useState<PreloadedPOItem[]>([]);
  const [receiveTargetPO, setReceiveTargetPO] = React.useState<ShopPurchaseOrderWithDetails | null>(null);
  const [shortageBooking, setShortageBooking] = React.useState<{ id: string; status: string } | null>(null);

  // 1. Initial auth & shop resolution
  React.useEffect(() => {
    let mounted = true;

    async function initUser() {
      try {
        setIsLoading(true);
        const meData = await apiClient<MeResponse>("/api/auth/me");
        if (!mounted) return;

        setUser(meData.user);

        const activeMemberships = meData.user.memberships.filter((m) => m.isActive);
        const list = activeMemberships.map((m) => ({
          id: m.shopId,
          name: m.shop?.name || `Shop #${m.shopId.slice(-4)}`,
        }));
        setShopsList(list);

        if (list.length > 0) {
          const firstShop = list[0];
          setActiveShopId(firstShop.id);
          setActiveShopName(firstShop.name);
        }
      } catch (err) {
        if (!mounted) return;
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError("Failed to load user session");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initUser();

    return () => {
      mounted = false;
    };
  }, []);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const triggerRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    setRefreshTrigger((c) => c + 1);
  }, []);

  // 2. Fetch shop parts, bookings, and purchase orders
  React.useEffect(() => {
    if (!activeShopId) return;
    let mounted = true;

    async function loadShopData() {
      try {
        setError(null);
        const [partsRes, bookingsRes, posRes] = await Promise.all([
          apiClient<Part[]>(`/api/shops/${activeShopId}/parts`),
          apiClient<ShopBookingsResponse>(`/api/shops/${activeShopId}/bookings`),
          apiClient<ShopPurchaseOrderWithDetails[]>(`/api/shops/${activeShopId}/purchase-orders`),
        ]);

        if (mounted) {
          setParts(partsRes);
          const relevant = (bookingsRes.bookings || []).filter((b) =>
            ["PARTS_PENDING", "PARTS_ORDERED", "PARTS_READY"].includes(b.status)
          );
          setPartsBookings(relevant);
          setPurchaseOrders(posRes || []);
          setIsLoading(false);
          setIsRefreshing(false);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiClientError) {
            setError(err.message);
          } else {
            setError("Failed to load shop inventory data");
          }
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadShopData();

    return () => {
      mounted = false;
    };
  }, [activeShopId, refreshTrigger]);

  // Handle direct stock allocation from dashboard
  async function handleDirectAllocation(bookingId: string) {
    if (!activeShopId) return;
    try {
      setIsRefreshing(true);
      await apiClient(`/api/shops/${activeShopId}/bookings/${bookingId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to: "IN_REPAIR",
          note: "Parts allocated from inventory; repair authorized",
        }),
      });

      setFeedbackNotice(`Stock allocated successfully for booking #${bookingId.slice(-6).toUpperCase()}`);
      setTimeout(() => setFeedbackNotice(null), 4000);
      triggerRefresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to allocate parts");
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  // Quick Login Handler
  async function handleQuickLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const meData = await apiClient<MeResponse>("/api/auth/me");
      setUser(meData.user);
      const activeMemberships = meData.user.memberships.filter((m) => m.isActive);
      const list = activeMemberships.map((m) => ({
        id: m.shopId,
        name: m.shop?.name || `Shop #${m.shopId.slice(-4)}`,
      }));
      setShopsList(list);
      if (list.length > 0) {
        setActiveShopId(list[0].id);
        setActiveShopName(list[0].name);
      }
      triggerRefresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLoginError(err.message);
      } else {
        setLoginError("Invalid credentials");
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Filtered Parts Catalog
  const filteredParts = React.useMemo(() => {
    return parts.filter((part) => {
      const matchesSearch =
        part.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        part.sku.toLowerCase().includes(catalogSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (catalogFilter === "out") return part.quantity === 0;
      if (catalogFilter === "low") return part.quantity > 0 && part.quantity <= part.reorderLevel;
      return true;
    });
  }, [parts, catalogSearch, catalogFilter]);

  // Filtered Jobs
  const filteredBookings = React.useMemo(() => {
    if (jobFilter === "ALL") return partsBookings;
    return partsBookings.filter((b) => b.status === jobFilter);
  }, [partsBookings, jobFilter]);

  // Filtered Purchase Orders
  const filteredPOs = React.useMemo(() => {
    if (poFilter === "ALL") return purchaseOrders;
    return purchaseOrders.filter((po) => po.status === poFilter);
  }, [purchaseOrders, poFilter]);

  // Counts
  const lowStockCount = parts.filter((p) => p.quantity > 0 && p.quantity <= p.reorderLevel).length;
  const outOfStockCount = parts.filter((p) => p.quantity === 0).length;
  const openPOCount = purchaseOrders.filter((po) => ["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)).length;

  // Catalog columns
  const catalogColumns: Column<Part>[] = [
    {
      key: "sku",
      header: "SKU",
      cell: (row) => <span className="font-mono text-xs font-semibold text-foreground">{row.sku}</span>,
    },
    {
      key: "name",
      header: "Part Description",
      cell: (row) => <span className="font-medium text-xs text-foreground">{row.name}</span>,
    },
    {
      key: "quantity",
      header: "On Hand",
      cell: (row) => {
        const isOut = row.quantity === 0;
        const isLow = row.quantity <= row.reorderLevel;
        return (
          <span
            className={`font-semibold text-xs ${
              isOut
                ? "text-rose-600 dark:text-rose-400"
                : isLow
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground"
            }`}
          >
            {row.quantity} units
          </span>
        );
      },
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
            <span className="inline-flex rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
              Out of Stock
            </span>
          );
        }
        if (row.quantity <= row.reorderLevel) {
          return (
            <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Low Stock
            </span>
          );
        }
        return (
          <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            In Stock
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <Button
          size="xs"
          variant="outline"
          onClick={() => setAdjustPart(row)}
          className="text-[11px] gap-1"
        >
          <Sliders className="size-3" />
          Adjust
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading parts inventory and work orders...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md my-12 p-6 rounded-2xl border border-border/80 bg-card shadow-xs space-y-5">
        <div className="text-center space-y-1">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md mb-2">
            <Package className="size-6" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Parts Person Sign In
          </h2>
          <p className="text-xs text-muted-foreground">
            Sign in to access shop inventory, purchase orders, and allocation.
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
            className="w-full text-xs font-semibold gap-1.5"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Signing in..." : "Sign in to Parts Dashboard"}
          </Button>

          <div className="pt-2 border-t border-border/60 text-center">
            <p className="text-[11px] text-muted-foreground">
              Demo credentials: <span className="font-mono text-foreground">parts@bayflow.demo</span> /{" "}
              <span className="font-mono text-foreground">password123</span>
            </p>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Package className="size-5 text-primary" />
              Parts & Inventory Dashboard
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Shop Floor POS
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeShopName ? `${activeShopName} • ` : ""}Manage catalog stock, identify estimate shortages, issue POs, and allocate repair parts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden md:inline-block text-xs text-muted-foreground font-medium">
              Signed in as {user.name}
            </span>
          )}
          {shopsList.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground">
              <Building2 className="size-3.5 text-muted-foreground" />
              <select
                value={activeShopId || ""}
                onChange={(e) => {
                  const s = shopsList.find((shop) => shop.id === e.target.value);
                  if (s) {
                    setActiveShopId(s.id);
                    setActiveShopName(s.name);
                  }
                }}
                className="bg-transparent font-medium focus:outline-hidden"
              >
                {shopsList.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={triggerRefresh}
            disabled={isRefreshing}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddPartOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Part
          </Button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedbackNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Catalog SKUs</span>
            <Boxes className="size-4 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {parts.length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Shop active catalog items
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Attention Required</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {lowStockCount + outOfStockCount}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
            {outOfStockCount} out of stock • {lowStockCount} low
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Jobs Needing Parts</span>
            <Wrench className="size-4 text-blue-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {partsBookings.length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Awaiting order, delivery, or allocation
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Supplier POs</span>
            <ShoppingCart className="size-4 text-purple-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {openPOCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Orders pending supplier delivery
          </p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border/80">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex items-center gap-2 pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === "jobs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wrench className="size-4" />
          Jobs Awaiting Parts ({partsBookings.length})
        </button>

        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === "catalog"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="size-4" />
          Parts Catalog & Shelf Stock ({parts.length})
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === "orders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="size-4" />
          Purchase Orders ({purchaseOrders.length})
        </button>
      </div>

      {/* Tab 1: Jobs Awaiting Parts & Allocation */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(["ALL", "PARTS_PENDING", "PARTS_ORDERED", "PARTS_READY"] as const).map(
                (status) => (
                  <Button
                    key={status}
                    size="xs"
                    variant={jobFilter === status ? "default" : "outline"}
                    onClick={() => setJobFilter(status)}
                    className="text-[11px]"
                  >
                    {status === "ALL" ? "All Queue Jobs" : status.replace("_", " ")}
                  </Button>
                )
              )}
            </div>

            <span className="text-xs text-muted-foreground">
              Showing {filteredBookings.length} work orders
            </span>
          </div>

          {filteredBookings.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No jobs awaiting parts in this view"
              description="All repair bookings have required parts in place, or no active work orders require parts attention."
            />
          ) : (
            <div className="grid gap-3">
              {filteredBookings.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-foreground">
                        #{job.id.slice(-6).toUpperCase()}
                      </span>
                      <StatusBadge status={job.status} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Car className="size-3.5 text-muted-foreground" />
                        {job.vehicle ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}` : "Vehicle"}
                      </span>
                      {job.vehicle?.regNo && (
                        <span className="font-mono text-[11px] rounded bg-muted px-1.5 py-0.5 text-foreground font-semibold">
                          {job.vehicle.regNo}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        • Customer: {job.customer?.name || "Customer"}
                      </span>
                    </div>

                    {job.customerNotes && (
                      <p className="text-[11px] text-muted-foreground italic truncate max-w-xl">
                        &ldquo;{job.customerNotes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setShortageBooking({
                          id: job.id,
                          status: job.status,
                        })
                      }
                      className="text-xs gap-1.5"
                    >
                      <Boxes className="size-3.5" />
                      Check Shortages
                    </Button>

                    {job.status === "PARTS_PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCreatePOLinkedBookingId(job.id);
                          setCreatePOPreloadedItems([]);
                          setIsCreatePOOpen(true);
                        }}
                        className="text-xs gap-1.5"
                      >
                        <ShoppingCart className="size-3.5" />
                        Create PO
                      </Button>
                    )}

                    {job.status === "PARTS_READY" && (
                      <Button
                        size="sm"
                        onClick={() => handleDirectAllocation(job.id)}
                        className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Wrench className="size-3.5" />
                        Allocate & Send to Repair
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Parts Catalog & Inventory */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search SKU or description..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant={catalogFilter === "all" ? "default" : "outline"}
                onClick={() => setCatalogFilter("all")}
                className="text-[11px]"
              >
                All ({parts.length})
              </Button>
              <Button
                size="xs"
                variant={catalogFilter === "low" ? "default" : "outline"}
                onClick={() => setCatalogFilter("low")}
                className="text-[11px]"
              >
                Low Stock ({lowStockCount})
              </Button>
              <Button
                size="xs"
                variant={catalogFilter === "out" ? "default" : "outline"}
                onClick={() => setCatalogFilter("out")}
                className="text-[11px]"
              >
                Out of Stock ({outOfStockCount})
              </Button>
            </div>
          </div>

          <DataTable
            columns={catalogColumns}
            data={filteredParts}
            keyExtractor={(row) => row.id}
          />
        </div>
      )}

      {/* Tab 3: Purchase Orders */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(["ALL", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"] as const).map(
                (status) => (
                  <Button
                    key={status}
                    size="xs"
                    variant={poFilter === status ? "default" : "outline"}
                    onClick={() => setPoFilter(status)}
                    className="text-[11px]"
                  >
                    {status === "ALL" ? "All Orders" : status.replace("_", " ")}
                  </Button>
                )
              )}
            </div>

            <Button
              size="sm"
              onClick={() => {
                setCreatePOLinkedBookingId(null);
                setCreatePOPreloadedItems([]);
                setIsCreatePOOpen(true);
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="size-3.5" />
              New Purchase Order
            </Button>
          </div>

          {filteredPOs.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders found"
              description="Create a purchase order to replenish parts from vendors."
            />
          ) : (
            <div className="grid gap-3">
              {filteredPOs.map((po) => {
                const totalItems = po.items.length;
                const totalOrdered = po.items.reduce((acc, i) => acc + i.qtyOrdered, 0);
                const totalReceived = po.items.reduce((acc, i) => acc + i.qtyReceived, 0);
                const isCompleted = po.status === "RECEIVED";

                return (
                  <div
                    key={po.id}
                    className="rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-foreground">
                          PO #{po.id.slice(-6).toUpperCase()}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            po.status === "RECEIVED"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : po.status === "PARTIALLY_RECEIVED"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {po.status.replace("_", " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(po.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Lines: <strong>{totalItems}</strong></span>
                        <span>•</span>
                        <span>Ordered: <strong>{totalOrdered}</strong></span>
                        <span>•</span>
                        <span className={totalReceived === totalOrdered ? "text-emerald-600 font-semibold" : ""}>
                          Received: <strong>{totalReceived} / {totalOrdered}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {po.items.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-mono text-foreground"
                          >
                            {item.part.name} ({item.qtyReceived}/{item.qtyOrdered})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isCompleted && (
                        <Button
                          size="sm"
                          onClick={() => setReceiveTargetPO(po)}
                          className="text-xs gap-1.5"
                        >
                          <Truck className="size-3.5" />
                          Receive Delivery
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {activeShopId && (
        <>
          <AddPartModal
            isOpen={isAddPartOpen}
            onClose={() => setIsAddPartOpen(false)}
            shopId={activeShopId}
            onSuccess={() => {
              setFeedbackNotice("New catalog part added successfully!");
              setTimeout(() => setFeedbackNotice(null), 3000);
              triggerRefresh();
            }}
          />

          <AdjustStockModal
            isOpen={!!adjustPart}
            onClose={() => setAdjustPart(null)}
            shopId={activeShopId}
            part={adjustPart}
            onSuccess={() => {
              setFeedbackNotice("Inventory stock adjusted successfully!");
              setTimeout(() => setFeedbackNotice(null), 3000);
              triggerRefresh();
            }}
          />

          <CreatePOModal
            isOpen={isCreatePOOpen}
            onClose={() => {
              setIsCreatePOOpen(false);
              setCreatePOLinkedBookingId(null);
              setCreatePOPreloadedItems([]);
            }}
            shopId={activeShopId}
            partsCatalog={parts}
            linkedBookingId={createPOLinkedBookingId}
            initialItems={createPOPreloadedItems}
            onSuccess={() => {
              setFeedbackNotice("Supplier purchase order issued successfully!");
              setTimeout(() => setFeedbackNotice(null), 3000);
              triggerRefresh();
            }}
          />

          <ReceivePOModal
            isOpen={!!receiveTargetPO}
            onClose={() => setReceiveTargetPO(null)}
            shopId={activeShopId}
            purchaseOrder={receiveTargetPO}
            onSuccess={() => {
              setFeedbackNotice("Delivery received and catalog stock updated!");
              setTimeout(() => setFeedbackNotice(null), 3000);
              triggerRefresh();
            }}
          />

          <ShortageCheckModal
            isOpen={!!shortageBooking}
            onClose={() => setShortageBooking(null)}
            shopId={activeShopId}
            bookingId={shortageBooking?.id || null}
            bookingStatus={shortageBooking?.status}
            onOpenCreatePO={(items, bookingId) => {
              setCreatePOLinkedBookingId(bookingId);
              setCreatePOPreloadedItems(items);
              setIsCreatePOOpen(true);
            }}
            onSuccess={() => {
              setFeedbackNotice("Booking updated successfully!");
              setTimeout(() => setFeedbackNotice(null), 3000);
              triggerRefresh();
            }}
          />
        </>
      )}
    </div>
  );
}
