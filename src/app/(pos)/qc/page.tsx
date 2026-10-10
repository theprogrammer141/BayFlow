"use client";

import * as React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  RefreshCw,
  Clock,
  Car,
  Wrench,
  User,
  FileText,
  AlertCircle,
  Building2,
  CheckSquare,
  Square,
  Sparkles,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { FailInspectionModal } from "@/components/qc/fail-inspection-modal";
import type { BookingStatus } from "@/lib/contracts/common";

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

interface QcQueueItemDetailed {
  bookingId: string;
  shopId: string;
  vehicleRegNo: string;
  vehicleModel: string;
  technicianName: string;
  enteredQcAt: string;
  status: string;
  customerNotes?: string | null;
  technician?: { id: string; name: string; email: string } | null;
  customer?: { id: string; name: string; email: string; phone?: string | null } | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    regNo: string;
    color?: string | null;
    mileage?: number | null;
  } | null;
  services?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    service: { id: string; name: string; description?: string | null };
  }>;
  estimate?: {
    id: string;
    revision: number;
    total: number;
    items: Array<{
      id: string;
      type: "PART" | "LABOUR";
      name: string;
      quantity: number;
      unitCost: number;
    }>;
  } | null;
  qcIssues?: Array<{
    id: string;
    title: string;
    description: string;
    createdAt: string;
    raisedBy?: { id: string; name: string; email?: string } | null;
  }>;
}

interface ShopBookingDetailed {
  id: string;
  shopId: string;
  status: string;
  technicianId?: string | null;
  qcInspectorId?: string | null;
  customerNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    regNo: string;
    color?: string | null;
    mileage?: number | null;
  };
  technician?: { id: string; name: string; email: string } | null;
  qcInspector?: { id: string; name: string; email: string } | null;
  customer: { id: string; name: string; email: string; phone?: string | null };
  services: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    service: { id: string; name: string; description?: string | null };
  }>;
  estimate?: {
    id: string;
    revision: number;
    total: number;
    items: Array<{
      id: string;
      type: "PART" | "LABOUR";
      name: string;
      quantity: number;
      unitCost: number;
    }>;
  } | null;
  qcIssues?: Array<{
    id: string;
    title: string;
    description: string;
    createdAt: string;
    raisedBy?: { id: string; name: string; email?: string } | null;
  }>;
}

const CHECKLIST_ITEMS = [
  { id: "road_test", label: "Road Test & Driving Dynamics", description: "Smooth acceleration, zero shudder, correct shift points and cruise stability" },
  { id: "brakes", label: "Braking System & ABS", description: "Firm pedal pressure, zero sponginess, linear bite, ABS self-check verified" },
  { id: "suspension", label: "Suspension & Steering Alignment", description: "Centered steering wheel, no pulling left/right, no clunks over road undulations" },
  { id: "fluids", label: "Fluids, Seals & Leak Inspection", description: "Engine oil, coolant, brake fluid at proper dipstick marks with zero dripping" },
  { id: "obd_scan", label: "OBD-II Diagnostic Scan", description: "ECU clear of active diagnostic trouble codes (DTCs); emissions monitors ready" },
  { id: "fasteners", label: "Safety Torques & Reassembly", description: "Wheel lug nuts torqued to manufacturer spec; splash shields & clips secured" },
  { id: "cleanliness", label: "Shop Cleanup & Interior Hygiene", description: "Steering wheel / seat protective covers removed; no grease marks on bodywork" },
];

export default function QcDashboardPage() {
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);
  const [activeShopId, setActiveShopId] = React.useState<string | null>(null);
  const [shopsList, setShopsList] = React.useState<Array<{ id: string; name: string }>>([]);

  const [activeTab, setActiveTab] = React.useState<"queue" | "bench" | "history">("queue");
  const [queue, setQueue] = React.useState<QcQueueItemDetailed[]>([]);
  const [inProgressJobs, setInProgressJobs] = React.useState<ShopBookingDetailed[]>([]);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = React.useState<string | null>(null);

  // Bench inspection state
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>({});
  const [inspectionNotes, setInspectionNotes] = React.useState("");
  const [isPassing, setIsPassing] = React.useState(false);
  const [isPickingId, setIsPickingId] = React.useState<string | null>(null);

  // Defect Modal
  const [failModalBooking, setFailModalBooking] = React.useState<{
    id: string;
    model: string;
    regNo: string;
    tech: string;
  } | null>(null);

  // Inline Quick Login state
  const [loginEmail, setLoginEmail] = React.useState("qc@bayflow.demo");
  const [loginPassword, setLoginPassword] = React.useState("password123");
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [searchFilter, setSearchFilter] = React.useState("");

  const fetchQcData = React.useCallback(async () => {
    if (!activeShopId) return;

    try {
      setIsRefreshing(true);
      setError(null);

      const [queueData, bookingsData] = await Promise.all([
        apiClient<QcQueueItemDetailed[]>(`/api/shops/${activeShopId}/qc/queue`),
        apiClient<{ bookings: ShopBookingDetailed[] }>(
          `/api/shops/${activeShopId}/bookings?status=QC_IN_PROGRESS`
        ),
      ]);

      setQueue(queueData || []);
      const inProg = bookingsData?.bookings || [];
      setInProgressJobs(inProg);

      setSelectedJobId((prev) => {
        if (prev && inProg.some((j) => j.id === prev)) return prev;
        if (inProg.length > 0) {
          const myJob = inProg.find((j) => j.qcInspectorId === user?.id) || inProg[0];
          return myJob.id;
        }
        return null;
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`Failed to load QC jobs: ${err.message}`);
      } else {
        setError("Unable to connect to the shop quality control service.");
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [activeShopId, user?.id]);

  // 1. Initial Load user profile & memberships
  React.useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const data = await apiClient<MeResponse>("/api/auth/me");
        if (!mounted) return;
        if (data?.user) {
          setUser(data.user);
          const qcOrOwnerMemberships = data.user.memberships.filter(
            (m) => (m.role === "QC_INSPECTOR" || m.role === "OWNER") && m.isActive
          );
          const shops = qcOrOwnerMemberships.map((m) => ({
            id: m.shopId,
            name: m.shop?.name || `Shop #${m.shopId.slice(-6)}`,
          }));
          setShopsList(shops);

          if (shops.length > 0) {
            setActiveShopId((prev) => prev ?? shops[0].id);
          }
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Load QC queue and active in-progress bookings for active shop
  React.useEffect(() => {
    if (!activeShopId || !user) return;
    let mounted = true;

    async function loadQcData() {
      try {
        setIsRefreshing(true);
        setError(null);

        const [queueData, bookingsData] = await Promise.all([
          apiClient<QcQueueItemDetailed[]>(`/api/shops/${activeShopId}/qc/queue`),
          apiClient<{ bookings: ShopBookingDetailed[] }>(
            `/api/shops/${activeShopId}/bookings?status=QC_IN_PROGRESS`
          ),
        ]);

        if (!mounted) return;
        setQueue(queueData || []);

        const inProg = bookingsData?.bookings || [];
        setInProgressJobs(inProg);

        setSelectedJobId((prev) => {
          if (prev && inProg.some((j) => j.id === prev)) return prev;
          if (inProg.length > 0) {
            const myJob = inProg.find((j) => j.qcInspectorId === user?.id) || inProg[0];
            return myJob.id;
          }
          return null;
        });
      } catch (err) {
        if (!mounted) return;
        if (err instanceof ApiClientError) {
          setError(`Failed to load QC jobs: ${err.message}`);
        } else {
          setError("Unable to connect to the shop quality control service.");
        }
      } finally {
        if (mounted) setIsRefreshing(false);
      }
    }

    void loadQcData();
    return () => {
      mounted = false;
    };
  }, [activeShopId, user]);

  // Handle Quick Login
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await apiClient<MeResponse>("/api/auth/me");
      if (data?.user) {
        setUser(data.user);
        const qcOrOwnerMemberships = data.user.memberships.filter(
          (m) => (m.role === "QC_INSPECTOR" || m.role === "OWNER") && m.isActive
        );
        const shops = qcOrOwnerMemberships.map((m) => ({
          id: m.shopId,
          name: m.shop?.name || `Shop #${m.shopId.slice(-6)}`,
        }));
        setShopsList(shops);
        if (shops.length > 0) {
          setActiveShopId(shops[0].id);
        }
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Pick Lock Action
  const handlePickJob = async (bookingId: string) => {
    if (!activeShopId) return;
    try {
      setIsPickingId(bookingId);
      setError(null);
      setFeedbackNotice(null);

      await apiClient(`/api/shops/${activeShopId}/bookings/${bookingId}/qc/pick`, {
        method: "POST",
      });

      setFeedbackNotice(`Job #${bookingId} successfully claimed! Added to your inspection bench.`);
      setSelectedJobId(bookingId);
      setActiveTab("bench");
      setChecklist({});
      setInspectionNotes("");
      await fetchQcData();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setError("Job lock conflict: Another inspector just claimed this job from the queue.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to pick QC job");
      }
      await fetchQcData();
    } finally {
      setIsPickingId(null);
    }
  };

  // Pass Inspection Action
  const handlePassInspection = async (bookingId: string) => {
    if (!activeShopId) return;
    try {
      setIsPassing(true);
      setError(null);
      setFeedbackNotice(null);

      await apiClient(`/api/shops/${activeShopId}/bookings/${bookingId}/qc/pass`, {
        method: "POST",
        body: JSON.stringify({ note: inspectionNotes.trim() || "QC Inspection verified and passed" }),
      });

      setFeedbackNotice(`Inspection Passed! Booking moved to READY_FOR_PICKUP. Service Advisor notified.`);
      setSelectedJobId(null);
      setChecklist({});
      setInspectionNotes("");
      setActiveTab("queue");
      await fetchQcData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pass inspection");
    } finally {
      setIsPassing(false);
    }
  };

  // Fail Inspection Action
  const handleConfirmFail = async (title: string, description: string) => {
    if (!activeShopId || !failModalBooking) return;
    try {
      setError(null);
      setFeedbackNotice(null);

      await apiClient(`/api/shops/${activeShopId}/bookings/${failModalBooking.id}/qc/fail`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          note: `QC Failed: ${title}`,
        }),
      });

      setFeedbackNotice(
        `Defect recorded. Job returned to ${failModalBooking.tech} in IN_REPAIR for corrective rework.`
      );
      setSelectedJobId(null);
      setChecklist({});
      setInspectionNotes("");
      setActiveTab("queue");
      await fetchQcData();
    } catch (err) {
      throw err;
    }
  };

  // Helper toggle all checklist
  const toggleAllChecklist = () => {
    const allChecked = CHECKLIST_ITEMS.every((item) => checklist[item.id]);
    const nextState: Record<string, boolean> = {};
    for (const item of CHECKLIST_ITEMS) {
      nextState[item.id] = !allChecked;
    }
    setChecklist(nextState);
  };

  const activeBenchJob = inProgressJobs.find((j) => j.id === selectedJobId);
  const isInspectorOwnerOfJob = activeBenchJob?.qcInspectorId === user?.id;

  // Filtered queue items
  const filteredQueue = queue.filter((item) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      item.bookingId.toLowerCase().includes(term) ||
      item.vehicleModel.toLowerCase().includes(term) ||
      item.vehicleRegNo.toLowerCase().includes(term) ||
      item.technicianName.toLowerCase().includes(term)
    );
  });

  // Collect all historical QC issues across shop bookings
  const allHistoricalIssues = React.useMemo(() => {
    const issues: Array<{
      issueId: string;
      bookingId: string;
      vehicleModel: string;
      vehicleRegNo: string;
      title: string;
      description: string;
      raisedByName: string;
      createdAt: string;
      status: string;
    }> = [];

    // From queue
    for (const q of queue) {
      if (q.qcIssues) {
        for (const iss of q.qcIssues) {
          issues.push({
            issueId: iss.id,
            bookingId: q.bookingId,
            vehicleModel: q.vehicleModel,
            vehicleRegNo: q.vehicleRegNo,
            title: iss.title,
            description: iss.description,
            raisedByName: iss.raisedBy?.name ?? "QC Inspector",
            createdAt: iss.createdAt,
            status: q.status,
          });
        }
      }
    }

    // From inProgress
    for (const ip of inProgressJobs) {
      if (ip.qcIssues) {
        for (const iss of ip.qcIssues) {
          if (!issues.some((x) => x.issueId === iss.id)) {
            issues.push({
              issueId: iss.id,
              bookingId: ip.id,
              vehicleModel: `${ip.vehicle.make} ${ip.vehicle.model}`,
              vehicleRegNo: ip.vehicle.regNo,
              title: iss.title,
              description: iss.description,
              raisedByName: iss.raisedBy?.name ?? "QC Inspector",
              createdAt: iss.createdAt,
              status: ip.status,
            });
          }
        }
      }
    }

    return issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [queue, inProgressJobs]);

  // Queue Table Columns
  const queueColumns: Column<QcQueueItemDetailed>[] = [
    {
      key: "bookingId",
      header: "Booking ID",
      cell: (row) => (
        <div>
          <span className="font-mono text-xs font-semibold text-foreground">{row.bookingId}</span>
          {row.qcIssues && row.qcIssues.length > 0 && (
            <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
              <RotateCcw className="size-3" />
              Re-Inspection (#{row.qcIssues.length + 1})
            </div>
          )}
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle Tested",
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground text-xs">{row.vehicleModel}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[11px] text-muted-foreground">{row.vehicleRegNo}</span>
            {row.vehicle?.color && (
              <span className="text-[10px] text-muted-foreground">• {row.vehicle.color}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "technician",
      header: "Repairing Technician",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Wrench className="size-3 text-muted-foreground" />
          <span className="text-xs text-foreground font-medium">{row.technicianName}</span>
        </div>
      ),
    },
    {
      key: "notes",
      header: "Customer Request",
      cell: (row) => (
        <p className="text-xs text-muted-foreground line-clamp-1 max-w-60">
          {row.customerNotes || "Standard service maintenance"}
        </p>
      ),
    },
    {
      key: "enteredQcAt",
      header: "In Queue Since",
      cell: (row) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3 text-muted-foreground" />
          <span>
            {new Date(row.enteredQcAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <Button
          size="xs"
          onClick={() => handlePickJob(row.bookingId)}
          disabled={isPickingId === row.bookingId}
          className="gap-1 text-[11px] bg-violet-600 hover:bg-violet-700 text-white font-medium active:scale-95 transition-all shadow-xs"
        >
          {isPickingId === row.bookingId ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Play className="size-3 fill-current" />
          )}
          Pick Job
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="size-6 animate-spin text-violet-600" />
          <p className="text-sm font-medium">Initializing Quality Control Console...</p>
        </div>
      </div>
    );
  }

  // Not logged in or not QC Inspector
  if (!user || shopsList.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-8">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-violet-600 mb-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">QC Inspector Authentication</h2>
              <p className="text-xs text-muted-foreground">Log in with a QC Inspector role to access the queue</p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              {loginError}
            </div>
          )}

          <form onSubmit={handleQuickLogin} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Inspector Email</label>
              <Input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="text-xs"
                required
              />
            </div>
            <div className="space-y-1">
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
              disabled={isLoggingIn}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs mt-2"
            >
              {isLoggingIn ? "Authenticating..." : "Sign In to QC Station"}
            </Button>
          </form>

          <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground text-center">
            Demo credentials: <span className="font-mono font-medium text-foreground">qc@bayflow.demo</span> /{" "}
            <span className="font-mono font-medium text-foreground">password123</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                Quality Control Station
                <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                  {queue.length} Pending Test
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                First-picker atomic lock • Multi-point inspection checklist • Defect loop to repairing technician
              </p>
            </div>
          </div>
        </div>

        {/* Shop Switcher & Refresh */}
        <div className="flex items-center gap-2.5">
          {shopsList.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
              <Building2 className="size-3.5 text-muted-foreground" />
              <select
                value={activeShopId || ""}
                onChange={(e) => setActiveShopId(e.target.value)}
                className="bg-transparent font-medium text-foreground outline-hidden cursor-pointer"
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
            onClick={fetchQcData}
            disabled={isRefreshing}
            className="gap-1.5 text-xs text-foreground"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-violet-600" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Feedback Notices */}
      {feedbackNotice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setFeedbackNotice(null)}
            className="text-[11px] hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
          >
            Dismiss
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setError(null)}
            className="text-[11px] hover:bg-rose-500/20 text-rose-700 dark:text-rose-300"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`relative px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "queue"
              ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" />
          Shared QC Queue
          <span className="rounded-full bg-violet-500/10 px-1.5 py-0.2 text-[10px] font-bold">
            {queue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bench")}
          className={`relative px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "bench"
              ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="size-3.5" />
          Active Inspection Bench
          {inProgressJobs.length > 0 && (
            <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-bold">
              {inProgressJobs.length} active
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`relative px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <RotateCcw className="size-3.5" />
          Defect Loop History
          {allHistoricalIssues.length > 0 && (
            <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 text-[10px] font-bold">
              {allHistoricalIssues.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SHARED QC QUEUE */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-xs w-full">
              <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <Input
                placeholder="Search queue by vehicle, reg no, or tech..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Jobs appear in queue automatically when technicians mark repairs finished.
            </p>
          </div>

          <DataTable
            columns={queueColumns}
            data={filteredQueue}
            keyExtractor={(row) => row.bookingId}
            emptyTitle="QC Queue Empty"
            emptyDescription="There are currently no vehicles waiting in QC_PENDING. When a technician finishes repairs, it will immediately show here."
          />
        </div>
      )}

      {/* TAB 2: ACTIVE INSPECTION BENCH */}
      {activeTab === "bench" && (
        <div className="space-y-6">
          {/* Active Job Selector Strip */}
          {inProgressJobs.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                Claimed Jobs:
              </span>
              {inProgressJobs.map((job) => {
                const isSelected = job.id === selectedJobId;
                const isMine = job.qcInspectorId === user?.id;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setChecklist({});
                      setInspectionNotes("");
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-violet-600 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:border-violet-300 hover:text-foreground"
                    }`}
                  >
                    <Car className="size-3.5" />
                    <span>{job.vehicle.make} {job.vehicle.model}</span>
                    <span className="font-mono text-[11px] opacity-75">({job.vehicle.regNo})</span>
                    {isMine && (
                      <span className="rounded bg-violet-600 text-white px-1 py-0.2 text-[9px] font-bold">
                        YOU
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {activeBenchJob ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Job Specs & Estimate Items */}
              <div className="space-y-6 lg:col-span-1">
                {/* Vehicle & Customer Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Inspected Vehicle
                      </span>
                      <h3 className="text-sm font-bold text-foreground">
                        {activeBenchJob.vehicle.make} {activeBenchJob.vehicle.model}
                      </h3>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        {activeBenchJob.vehicle.regNo} • Year {activeBenchJob.vehicle.year}
                      </p>
                    </div>
                    <StatusBadge status={activeBenchJob.status as BookingStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Mileage</span>
                      <p className="font-mono font-medium text-foreground">
                        {activeBenchJob.vehicle.mileage ? `${activeBenchJob.vehicle.mileage.toLocaleString()} km` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Color</span>
                      <p className="font-medium text-foreground">
                        {activeBenchJob.vehicle.color || "Standard"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="size-3" />
                      <span className="font-medium text-foreground">{activeBenchJob.customer.name}</span>
                      {activeBenchJob.customer.phone && (
                        <span className="font-mono text-[11px]">({activeBenchJob.customer.phone})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Wrench className="size-3" />
                      <span>Repair Mechanic:</span>
                      <span className="font-semibold text-foreground">
                        {activeBenchJob.technician?.name || "Unassigned"}
                      </span>
                    </div>
                  </div>

                  {activeBenchJob.customerNotes && (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs space-y-1">
                      <span className="font-semibold text-foreground flex items-center gap-1 text-[11px]">
                        <FileText className="size-3 text-muted-foreground" />
                        Original Customer Complaint:
                      </span>
                      <p className="text-muted-foreground italic">
                        &quot;{activeBenchJob.customerNotes}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {/* Estimate Breakdown (Work performed by mechanic) */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Mechanic Repair Items
                    </h4>
                    {activeBenchJob.estimate && (
                      <span className="font-mono text-xs font-semibold text-foreground">
                        Rs. {activeBenchJob.estimate.total.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {activeBenchJob.estimate?.items && activeBenchJob.estimate.items.length > 0 ? (
                    <div className="divide-y divide-border/60 text-xs">
                      {activeBenchJob.estimate.items.map((item) => (
                        <div key={item.id} className="py-2 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-semibold">
                              {item.type} • Qty {item.quantity}
                            </span>
                          </div>
                          <span className="font-mono text-muted-foreground">
                            Rs. {(item.quantity * item.unitCost).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-2">
                      No itemized estimate lines attached to this job.
                    </p>
                  )}
                </div>

                {/* Prior QC Defects Notice on this booking */}
                {activeBenchJob.qcIssues && activeBenchJob.qcIssues.length > 0 && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-semibold text-xs">
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      <span>Previous Defect History on this Vehicle</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      This job failed a prior inspection cycle. Ensure the defect noted below was remedied by the mechanic:
                    </p>
                    <div className="space-y-2 pt-1">
                      {activeBenchJob.qcIssues.map((iss) => (
                        <div key={iss.id} className="rounded-md border border-amber-500/30 bg-background/80 p-2.5 text-xs">
                          <p className="font-semibold text-rose-600 dark:text-rose-400">{iss.title}</p>
                          <p className="text-muted-foreground text-[11px] mt-0.5">{iss.description}</p>
                          <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                            Reported by {iss.raisedBy?.name ?? "QC"} on {new Date(iss.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Columns: Multi-Point Quality Inspection Form */}
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="size-4 text-violet-600" />
                        Multi-Point Vehicle Inspection Protocol
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Complete physical tests before certifying vehicle ready for customer delivery.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={toggleAllChecklist}
                      className="text-xs gap-1.5 self-start"
                    >
                      <CheckSquare className="size-3.5" />
                      {CHECKLIST_ITEMS.every((item) => checklist[item.id])
                        ? "Uncheck All"
                        : "Mark All Verified"}
                    </Button>
                  </div>

                  {/* Checklist Grid */}
                  <div className="divide-y divide-border/60">
                    {CHECKLIST_ITEMS.map((item) => {
                      const isChecked = Boolean(checklist[item.id]);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className="py-3 flex items-start gap-3 cursor-pointer group hover:bg-muted/20 px-2 rounded-lg transition-colors"
                        >
                          <button
                            type="button"
                            className="mt-0.5 text-muted-foreground group-hover:text-violet-600 transition-colors"
                          >
                            {isChecked ? (
                              <CheckSquare className="size-4 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                            ) : (
                              <Square className="size-4 text-muted-foreground" />
                            )}
                          </button>
                          <div className="space-y-0.5 flex-1">
                            <p
                              className={`text-xs font-semibold ${
                                isChecked
                                  ? "text-foreground line-through opacity-75"
                                  : "text-foreground"
                              }`}
                            >
                              {item.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inspector Notes */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Inspection Notes & Certification Remarks</span>
                      <span className="text-[11px] text-muted-foreground">Optional</span>
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="e.g. Completed 5 km road test on Ring Road. Rolling brake test measured 82% efficiency. All torques verified."
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  {/* Authorization Notice */}
                  {!isInspectorOwnerOfJob && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-semibold">Inspector Lock Notice</p>
                      <p className="mt-0.5">
                        This job was claimed by inspector{" "}
                        <span className="font-semibold text-foreground">{activeBenchJob.qcInspector?.name || "another staff member"}</span>.
                        Only the claiming inspector can pass or fail this job under server invariant rules.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="border-t border-border pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!isInspectorOwnerOfJob || isPassing}
                      onClick={() =>
                        setFailModalBooking({
                          id: activeBenchJob.id,
                          model: `${activeBenchJob.vehicle.make} ${activeBenchJob.vehicle.model}`,
                          regNo: activeBenchJob.vehicle.regNo,
                          tech: activeBenchJob.technician?.name || "Technician",
                        })
                      }
                      className="w-full sm:w-auto gap-1.5 text-xs"
                    >
                      <AlertTriangle className="size-4" />
                      Fail Quality Test & Return to Tech
                    </Button>

                    <Button
                      type="button"
                      disabled={!isInspectorOwnerOfJob || isPassing}
                      onClick={() => handlePassInspection(activeBenchJob.id)}
                      className="w-full sm:w-auto gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs active:scale-95 transition-all"
                    >
                      {isPassing ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          Certifying Pass...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          Pass Inspection & Notify Ready
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Inspection Bench Selected"
              description="Pick a vehicle from the Shared QC Queue or select an active job above to perform the multi-point inspection."
              action={
                <Button size="sm" onClick={() => setActiveTab("queue")}>
                  Go to QC Queue
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* TAB 3: DEFECT LOOP HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <RotateCcw className="size-4 text-rose-600" />
                QC Failure Loop & Rework Audit Log
              </h3>
              <p className="text-xs text-muted-foreground">
                All quality defects recorded on vehicles returned to technicians for rework.
              </p>
            </div>
          </div>

          {allHistoricalIssues.length > 0 ? (
            <div className="divide-y divide-border border rounded-xl bg-card overflow-hidden">
              {allHistoricalIssues.map((issue) => (
                <div key={issue.issueId} className="p-4 space-y-2 hover:bg-muted/10 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {issue.bookingId}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {issue.vehicleModel}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        ({issue.vehicleRegNo})
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(issue.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {issue.title}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {issue.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      Flagged by inspector <strong className="text-foreground">{issue.raisedByName}</strong>
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setSelectedJobId(issue.bookingId);
                        setActiveTab("bench");
                      }}
                      className="text-violet-600 hover:text-violet-700 text-[11px] gap-1"
                    >
                      View Booking Details
                      <ExternalLink className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Defect Issues Recorded"
              description="Zero inspection failures logged so far. When quality defects are found and returned, their full rework history will be tracked here."
            />
          )}
        </div>
      )}

      {/* Defect Modal */}
      {failModalBooking && (
        <FailInspectionModal
          isOpen={Boolean(failModalBooking)}
          onClose={() => setFailModalBooking(null)}
          bookingId={failModalBooking.id}
          vehicleModel={failModalBooking.model}
          vehicleRegNo={failModalBooking.regNo}
          technicianName={failModalBooking.tech}
          onConfirmFail={handleConfirmFail}
        />
      )}
    </div>
  );
}
