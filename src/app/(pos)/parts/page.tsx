"use client";

import * as React from "react";
import { Package, Search, Truck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import type { Part, PurchaseOrder } from "@/lib/contracts/inventory";

type SessionUser = { memberships: Array<{ shopId: string }> };
type PartsJob = {
  bookingId: string;
  status: string;
  vehicle: { regNo: string; make: string; model: string };
  items: Array<{ partId: string; name: string; requiredQty: number; availableQty: number; shortage: number }>;
};

export default function PartsDashboardPage() {
  const [parts, setParts] = React.useState<Part[]>([]);
  const [jobs, setJobs] = React.useState<PartsJob[]>([]);
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
  const [shopId, setShopId] = React.useState<string>();
  const [search, setSearch] = React.useState("");
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const user = await apiClient<SessionUser>("/api/auth/me");
        const shopId = user.memberships[0]?.shopId;
        if (!shopId) throw new Error("No shop membership found");
        const [loadedParts, loadedJobs, loadedOrders] = await Promise.all([
          apiClient<Part[]>(`/api/shops/${shopId}/parts`),
          apiClient<PartsJob[]>(`/api/shops/${shopId}/parts/jobs`),
          apiClient<PurchaseOrder[]>(`/api/shops/${shopId}/purchase-orders`),
        ]);
        if (!cancelled) {
          setParts(loadedParts);
          setJobs(loadedJobs);
          setOrders(loadedOrders);
          setShopId(shopId);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const filteredParts = parts.filter((part) =>
    `${part.sku} ${part.name}`.toLowerCase().includes(search.toLowerCase())
  );
  const columns: Column<Part>[] = [
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs font-semibold">{row.sku}</span> },
    { key: "name", header: "Part Description", cell: (row) => <span className="text-xs font-medium">{row.name}</span> },
    { key: "quantity", header: "On Hand", cell: (row) => <span className={row.quantity <= row.reorderLevel ? "text-xs font-semibold text-rose-600" : "text-xs font-semibold"}>{row.quantity} units</span> },
    { key: "reorderLevel", header: "Reorder Threshold", cell: (row) => <span className="text-xs text-muted-foreground">{row.reorderLevel} units</span> },
    { key: "cost", header: "Unit Cost", cell: (row) => <span className="font-mono text-xs">PKR {row.cost.toLocaleString()}</span> },
    { key: "status", header: "Stock Status", cell: (row) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.quantity === 0 ? "bg-rose-500/10 text-rose-700" : row.quantity <= row.reorderLevel ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}`}>{row.quantity === 0 ? "Out of Stock" : row.quantity <= row.reorderLevel ? "Low Stock" : "In Stock"}</span> },
  ];

  async function createOrder(job: PartsJob) {
    if (!shopId) return;
    const items = job.items.filter((item) => item.shortage > 0).map((item) => ({ partId: item.partId, bookingId: job.bookingId, qtyOrdered: item.shortage }));
    if (items.length === 0) return;
    const order = await apiClient<PurchaseOrder>(`/api/shops/${shopId}/purchase-orders`, { method: "POST", body: JSON.stringify({ items }) });
    setOrders((current) => [order, ...current]);
  }

  async function receiveOrder(order: PurchaseOrder) {
    if (!shopId) return;
    const items = order.items.filter((item) => item.qtyReceived < item.qtyOrdered).map((item) => ({ itemId: item.id, qty: item.qtyOrdered - item.qtyReceived }));
    if (items.length === 0) return;
    const updated = await apiClient<PurchaseOrder>(`/api/shops/${shopId}/purchase-orders/${order.id}/receive`, { method: "POST", body: JSON.stringify({ items }) });
    setOrders((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
  }

  async function allocateJob(job: PartsJob) {
    if (!shopId) return;
    await apiClient(`/api/shops/${shopId}/bookings/${job.bookingId}/transition`, { method: "POST", body: JSON.stringify({ to: "IN_REPAIR" }) });
    setJobs((current) => current.map((candidate) => candidate.bookingId === job.bookingId ? { ...candidate, status: "IN_REPAIR" } : candidate));
  }

  if (state === "loading") return <p className="text-sm text-muted-foreground">Loading inventory...</p>;
  if (state === "error") return <p className="text-sm text-rose-600">Inventory could not be loaded for this shop.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4 text-primary" />Shop Parts Inventory ({parts.length})</h3>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU or part name" className="pl-8 text-xs" />
        </div>
      </div>
      {filteredParts.length === 0 ? <p className="text-sm text-muted-foreground">No parts match this search.</p> : <DataTable columns={columns} data={filteredParts} keyExtractor={(row) => row.id} />}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Jobs Awaiting Parts</h3>
        {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No jobs are currently awaiting parts.</p> : jobs.map((job) => <div key={job.bookingId} className="border-b border-border py-3 text-xs"><div className="flex flex-wrap justify-between gap-3"><span className="font-semibold">{job.vehicle.regNo} - {job.vehicle.make} {job.vehicle.model}</span><span className="text-muted-foreground">{job.status}</span></div><p className="mt-1 text-muted-foreground">{job.items.map((item) => `${item.name}: ${item.availableQty}/${item.requiredQty} in stock`).join(" | ")}</p><div className="mt-2 flex gap-2"><Button size="xs" variant="outline" onClick={() => void createOrder(job)} disabled={!job.items.some((item) => item.shortage > 0)}><Truck className="size-3" />Create PO</Button><Button size="xs" variant="outline" onClick={() => void allocateJob(job)} disabled={job.status !== "PARTS_READY"}><Wrench className="size-3" />Allocate</Button></div></div>)}
      </section>
      <section className="space-y-3"><h3 className="text-sm font-semibold">Purchase Orders</h3>{orders.length === 0 ? <p className="text-sm text-muted-foreground">No purchase orders yet.</p> : orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 text-xs"><span className="font-mono">{order.id}</span><span>{order.status}</span><Button size="xs" variant="outline" onClick={() => void receiveOrder(order)} disabled={order.status === "RECEIVED"}><Truck className="size-3" />Receive outstanding</Button></div>)}</section>
    </div>
  );
}
