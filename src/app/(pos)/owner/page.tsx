"use client";

import * as React from "react";
import {
  Building2,
  Users,
  Wrench,
  Plus,
  RefreshCw,
  Clock,
  MapPin,
  Phone,
  AlertCircle,
  UserPlus,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { Shop, TeamMember, ServiceItem, ShopOverview } from "@/lib/contracts/shop";
import { BookingStatusEnum, RoleEnum, type BookingStatus, type Role } from "@/lib/contracts/common";

export default function OwnerDashboardPage() {
  const [shops, setShops] = React.useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<ShopOverview | null>(null);
  const [team, setTeam] = React.useState<TeamMember[]>([]);
  const [services, setServices] = React.useState<ServiceItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"overview" | "team" | "services" | "settings">("overview");

  // Dialog modals state
  const [showCreateShopModal, setShowCreateShopModal] = React.useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = React.useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = React.useState(false);

  // Form states
  const [newShop, setNewShop] = React.useState({
    name: "",
    address: "",
    city: "",
    phone: "",
    workStart: "09:00",
    workEnd: "18:00",
    slotMinutes: 60,
    slotCapacity: 2,
  });

  const [newTeamMember, setNewTeamMember] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "TECHNICIAN" as Role,
    password: "",
  });

  const [newService, setNewService] = React.useState({
    name: "",
    description: "",
    estMinutes: 60,
    basePrice: 5000,
  });

  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<{ text: string; isError?: boolean } | null>(null);

  // Load shops
  const fetchShops = React.useCallback(async () => {
    try {
      const data = await apiClient<Shop[]>("/api/shops");
      setShops(data);
      if (data.length > 0 && !selectedShopId) {
        setSelectedShopId(data[0].id);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError("Please log in as a Shop Owner to access this dashboard.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load shops");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedShopId]);

  React.useEffect(() => {
    let isMounted = true;
    apiClient<Shop[]>("/api/shops")
      .then((data) => {
        if (!isMounted) return;
        setShops(data);
        if (data.length > 0) {
          setSelectedShopId(data[0].id);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiClientError && err.status === 401) {
          setError("Please log in as a Shop Owner to access this dashboard.");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load shops");
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load selected shop details (overview, team, services)
  const fetchShopDetails = React.useCallback(async (shopId: string) => {
    try {
      const [overviewData, teamData, servicesData] = await Promise.all([
        apiClient<ShopOverview>(`/api/shops/${shopId}/overview`).catch(() => null),
        apiClient<TeamMember[]>(`/api/shops/${shopId}/team`).catch(() => []),
        apiClient<ServiceItem[]>(`/api/shops/${shopId}/services`).catch(() => []),
      ]);
      setOverview(overviewData);
      setTeam(teamData);
      setServices(servicesData);
    } catch (err) {
      console.error("Failed to load shop details", err);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedShopId) return;
    let isMounted = true;

    Promise.all([
      apiClient<ShopOverview>(`/api/shops/${selectedShopId}/overview`).catch(() => null),
      apiClient<TeamMember[]>(`/api/shops/${selectedShopId}/team`).catch(() => []),
      apiClient<ServiceItem[]>(`/api/shops/${selectedShopId}/services`).catch(() => []),
    ]).then(([overviewData, teamData, servicesData]) => {
      if (!isMounted) return;
      setOverview(overviewData);
      setTeam(teamData);
      setServices(servicesData);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedShopId]);

  // Handlers
  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setActionMessage(null);
    try {
      const created = await apiClient<Shop>("/api/shops", {
        method: "POST",
        body: JSON.stringify(newShop),
      });
      setShowCreateShopModal(false);
      setNewShop({
        name: "",
        address: "",
        city: "",
        phone: "",
        workStart: "09:00",
        workEnd: "18:00",
        slotMinutes: 60,
        slotCapacity: 2,
      });
      await fetchShops();
      setSelectedShopId(created.id);
      setActionMessage({ text: "Shop created successfully!" });
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Failed to create shop",
        isError: true,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddTeamMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShopId) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      await apiClient<TeamMember>(`/api/shops/${selectedShopId}/team`, {
        method: "POST",
        body: JSON.stringify(newTeamMember),
      });
      setShowAddTeamModal(false);
      setNewTeamMember({
        name: "",
        email: "",
        phone: "",
        role: "TECHNICIAN",
        password: "",
      });
      await fetchShopDetails(selectedShopId);
      setActionMessage({ text: "Team member added successfully!" });
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Failed to add team member",
        isError: true,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleMemberStatus(member: TeamMember) {
    if (!selectedShopId) return;
    setActionLoading(true);
    try {
      await apiClient<TeamMember>(`/api/shops/${selectedShopId}/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      await fetchShopDetails(selectedShopId);
      setActionMessage({
        text: `Team member ${!member.isActive ? "activated" : "deactivated"} successfully!`,
      });
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Failed to update member status",
        isError: true,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRoleChange(member: TeamMember, newRole: Role) {
    if (!selectedShopId) return;
    setActionLoading(true);
    try {
      await apiClient<TeamMember>(`/api/shops/${selectedShopId}/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await fetchShopDetails(selectedShopId);
      setActionMessage({ text: `Role updated to ${newRole}` });
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Failed to update role",
        isError: true,
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShopId) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      await apiClient<ServiceItem>(`/api/shops/${selectedShopId}/services`, {
        method: "POST",
        body: JSON.stringify(newService),
      });
      setShowAddServiceModal(false);
      setNewService({
        name: "",
        description: "",
        estMinutes: 60,
        basePrice: 5000,
      });
      await fetchShopDetails(selectedShopId);
      setActionMessage({ text: "Service created successfully!" });
    } catch (err: unknown) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Failed to create service",
        isError: true,
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Columns for Team Table
  const teamColumns: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Member",
      cell: (row) => (
        <div>
          <p className="font-semibold text-xs text-foreground">{row.user.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.user.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => (
        <select
          value={row.role}
          onChange={(e) => handleRoleChange(row, e.target.value as Role)}
          className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-hidden"
          disabled={actionLoading || row.role === "OWNER"}
        >
          {RoleEnum.options.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.isActive ? "default" : "destructive"} className="text-[10px]">
          {row.isActive ? "Active" : "Deactivated"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Action",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.role !== "OWNER" && (
            <Button
              size="xs"
              variant={row.isActive ? "destructive" : "outline"}
              className="text-[11px]"
              disabled={actionLoading}
              onClick={() => handleToggleMemberStatus(row)}
            >
              {row.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Columns for Service Table
  const serviceColumns: Column<ServiceItem>[] = [
    {
      key: "name",
      header: "Service Name",
      cell: (row) => (
        <div>
          <p className="font-semibold text-xs text-foreground">{row.name}</p>
          {row.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "duration",
      header: "Est. Duration",
      cell: (row) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          <span>{row.estMinutes} mins</span>
        </div>
      ),
    },
    {
      key: "basePrice",
      header: "Base Price",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.basePrice != null ? `PKR ${row.basePrice.toLocaleString()}` : "Variable"}
        </span>
      ),
    },
  ];

  const currentShop = shops.find((s) => s.id === selectedShopId);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">Loading Owner Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <EmptyState
          title="Access Restricted or Offline"
          description={error}
          action={
            <Button size="sm" onClick={fetchShops}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Shop Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Owner Dashboard
            </h1>
            <Badge variant="outline" className="text-xs">
              Multi-Shop Scope
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage shops, staff teams, catalog services, and operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {shops.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <select
                value={selectedShopId ?? ""}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => setShowCreateShopModal(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            Add Shop
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedShopId && fetchShopDetails(selectedShopId)}
            className="text-xs"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs ${
            actionMessage.isError
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.isError ? (
              <AlertCircle className="size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setActionMessage(null)}
            className="text-xs h-6 px-1.5"
          >
            Dismiss
          </Button>
        </div>
      )}

      {shops.length === 0 ? (
        <EmptyState
          title="No Shops Created Yet"
          description="Create your first workshop to begin managing your staff, services, and bookings."
          action={
            <Button size="sm" onClick={() => setShowCreateShopModal(true)}>
              Create First Shop
            </Button>
          }
        />
      ) : (
        <>
          {/* Shop Meta Pill */}
          {currentShop && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-card p-3 border border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Building2 className="size-3.5 text-primary" />
                <span>{currentShop.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                <span>{currentShop.address}, {currentShop.city}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                <span>{currentShop.phone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>{currentShop.workStart} - {currentShop.workEnd}</span>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px]">
                Capacity: {currentShop.slotCapacity} cars / {currentShop.slotMinutes}m
              </Badge>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-border text-xs font-semibold">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              Overview & Bookings
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
                activeTab === "team"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" />
              Team Members ({team.length})
            </button>
            <button
              onClick={() => setActiveTab("services")}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-colors ${
                activeTab === "services"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wrench className="size-3.5" />
              Service Catalog ({services.length})
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs">Active Team</CardDescription>
                    <CardTitle className="text-2xl font-black text-foreground">
                      {overview?.teamCount ?? team.filter((m) => m.isActive).length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                    Staff members
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs">Inventory Parts</CardDescription>
                    <CardTitle className="text-2xl font-black text-foreground">
                      {overview?.inventorySummary.totalParts ?? 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                    Catalog parts
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs">Low Stock Shortages</CardDescription>
                    <CardTitle className="text-2xl font-black text-amber-600">
                      {overview?.inventorySummary.lowStockCount ?? 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                    Below reorder level
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="text-xs">Services Offered</CardDescription>
                    <CardTitle className="text-2xl font-black text-foreground">
                      {services.length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                    Active packages
                  </CardContent>
                </Card>
              </div>

              {/* Bookings Status Breakdown Grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-foreground">
                    Live Bookings by Status
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time operational distribution across the state machine.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {BookingStatusEnum.options.map((status: BookingStatus) => {
                      const count = overview?.countsByStatus[status] ?? 0;
                      return (
                        <div
                          key={status}
                          className="flex flex-col justify-between rounded-lg border border-border bg-muted/20 p-2.5 transition-all hover:bg-muted/40"
                        >
                          <div className="mb-2">
                            <StatusBadge status={status} />
                          </div>
                          <span className="font-mono text-lg font-bold text-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: TEAM MANAGEMENT */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Shop Team Members</h3>
                  <p className="text-xs text-muted-foreground">
                    Manage service advisors, technicians, QC inspectors, and parts specialists.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddTeamModal(true)}
                  className="gap-1.5 text-xs"
                >
                  <UserPlus className="size-3.5" />
                  Add Team Member
                </Button>
              </div>

              <DataTable
                columns={teamColumns}
                data={team}
                keyExtractor={(row) => row.id}
                emptyTitle="No team members yet"
                emptyDescription="Add staff members using the button above."
              />
            </div>
          )}

          {/* TAB 3: SERVICES */}
          {activeTab === "services" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Service Catalog</h3>
                  <p className="text-xs text-muted-foreground">
                    Define maintenance services, standard duration, and base price PKR.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddServiceModal(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add Service
                </Button>
              </div>

              <DataTable
                columns={serviceColumns}
                data={services}
                keyExtractor={(row) => row.id}
                emptyTitle="No services defined"
                emptyDescription="Create standard services to offer them to customers."
              />
            </div>
          )}
        </>
      )}

      {/* CREATE SHOP MODAL */}
      {showCreateShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground">Create New Shop</h2>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowCreateShopModal(false)}
              >
                ✕
              </Button>
            </div>
            <form onSubmit={handleCreateShop} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Shop Name</Label>
                <Input
                  required
                  placeholder="e.g. Apex Auto Defense"
                  value={newShop.name}
                  onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input
                    required
                    placeholder="Lahore"
                    value={newShop.city}
                    onChange={(e) => setNewShop({ ...newShop, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    required
                    placeholder="+923001234567"
                    value={newShop.phone}
                    onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Input
                  required
                  placeholder="e.g. 14-C Commercial Area"
                  value={newShop.address}
                  onChange={(e) => setNewShop({ ...newShop, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Work Start</Label>
                  <Input
                    required
                    placeholder="09:00"
                    value={newShop.workStart}
                    onChange={(e) => setNewShop({ ...newShop, workStart: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Work End</Label>
                  <Input
                    required
                    placeholder="18:00"
                    value={newShop.workEnd}
                    onChange={(e) => setNewShop({ ...newShop, workEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Slot Minutes</Label>
                  <Input
                    type="number"
                    min={15}
                    value={newShop.slotMinutes}
                    onChange={(e) =>
                      setNewShop({ ...newShop, slotMinutes: parseInt(e.target.value) || 60 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Slot Capacity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newShop.slotCapacity}
                    onChange={(e) =>
                      setNewShop({ ...newShop, slotCapacity: parseInt(e.target.value) || 2 })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateShopModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Creating..." : "Create Shop"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TEAM MEMBER MODAL */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground">Add Team Member</h2>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowAddTeamModal(false)}
              >
                ✕
              </Button>
            </div>
            <form onSubmit={handleAddTeamMember} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Staff Name</Label>
                <Input
                  required
                  placeholder="e.g. Asad Technician"
                  value={newTeamMember.name}
                  onChange={(e) =>
                    setNewTeamMember({ ...newTeamMember, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  required
                  placeholder="asad@bayflow.io"
                  value={newTeamMember.email}
                  onChange={(e) =>
                    setNewTeamMember({ ...newTeamMember, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Temporary Password</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Temporary password"
                  value={newTeamMember.password}
                  onChange={(e) =>
                    setNewTeamMember({ ...newTeamMember, password: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select
                  value={newTeamMember.role}
                  onChange={(e) =>
                    setNewTeamMember({
                      ...newTeamMember,
                      role: e.target.value as Role,
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden"
                >
                  <option value="SERVICE_ADVISOR">Service Advisor</option>
                  <option value="TECHNICIAN">Technician</option>
                  <option value="PARTS_PERSON">Parts Person</option>
                  <option value="QC_INSPECTOR">QC Inspector</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddTeamModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SERVICE MODAL */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground">Add Service to Catalog</h2>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowAddServiceModal(false)}
              >
                ✕
              </Button>
            </div>
            <form onSubmit={handleAddService} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Service Name</Label>
                <Input
                  required
                  placeholder="e.g. Brake Disc Resurfacing"
                  value={newService.name}
                  onChange={(e) =>
                    setNewService({ ...newService, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (Optional)</Label>
                <Input
                  placeholder="Precision machining of front brake discs"
                  value={newService.description}
                  onChange={(e) =>
                    setNewService({ ...newService, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Est. Duration (Mins)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newService.estMinutes}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        estMinutes: parseInt(e.target.value) || 30,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Base Price (PKR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newService.basePrice}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        basePrice: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddServiceModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Creating..." : "Save Service"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
