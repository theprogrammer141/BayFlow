import type { BookingSummary } from "@/lib/contracts/booking";
import type { Estimate } from "@/lib/contracts/estimate";
import type { Part, PurchaseOrder } from "@/lib/contracts/inventory";
import type { QcQueueItem, QcIssue } from "@/lib/contracts/qc";

export const MOCK_TECHNICIAN_JOBS: BookingSummary[] = [
  {
    id: "job-tech-101",
    shopId: "shop-cuid-apex",
    customerId: "usr-cust-1",
    vehicleId: "veh-1",
    slotId: "slot-0900",
    status: "INSPECTING",
    customerNotes: "Grinding noise when steering at low speeds.",
    technicianId: "usr-tech-1",
    createdAt: "2026-10-09T08:30:00.000Z",
    updatedAt: "2026-10-09T09:15:00.000Z",
    vehicle: {
      id: "veh-1",
      regNo: "LEA-20-4521",
      make: "Toyota",
      model: "Corolla Altis Grande 1.8",
      year: 2020,
      color: "Super White",
    },
    customer: {
      id: "usr-cust-1",
      name: "Hamza Malik",
      email: "hamza@example.com",
      phone: "+92 301 5551234",
    },
  },
  {
    id: "job-tech-102",
    shopId: "shop-cuid-apex",
    customerId: "usr-cust-2",
    vehicleId: "veh-2",
    slotId: "slot-1000",
    status: "IN_REPAIR",
    customerNotes: "Engine misfire code P0300 on dashboard.",
    technicianId: "usr-tech-1",
    createdAt: "2026-10-08T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
    vehicle: {
      id: "veh-2",
      regNo: "BKL-19-8902",
      make: "Honda",
      model: "Civic Oriel 1.8",
      year: 2019,
      color: "Lunar Silver Metallic",
    },
    customer: {
      id: "usr-cust-2",
      name: "Tariq Jameel",
      email: "tariq@example.com",
      phone: "+92 333 7778899",
    },
  },
];

export const MOCK_ESTIMATES: Estimate[] = [
  {
    id: "est-101",
    bookingId: "job-tech-101",
    revision: 1,
    total: 26500,
    sentAt: "2026-10-09T09:45:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    items: [
      {
        id: "est-item-1",
        estimateId: "est-101",
        type: "PART",
        partId: "part-brk-01",
        name: "OEM Ceramic Brake Pad Set (Front)",
        quantity: 1,
        unitCost: 14500,
      },
      {
        id: "est-item-2",
        estimateId: "est-101",
        type: "PART",
        partId: "part-brk-rot",
        name: "Front Brake Rotor Resurfacing",
        quantity: 2,
        unitCost: 3000,
      },
      {
        id: "est-item-3",
        estimateId: "est-101",
        type: "LABOUR",
        partId: null,
        name: "Brake Caliper Service & Bleeding Labour",
        quantity: 1,
        unitCost: 6000,
      },
    ],
  },
];

export const MOCK_PARTS: Part[] = [
  {
    id: "part-brk-01",
    shopId: "shop-cuid-apex",
    sku: "BP-TY-001",
    name: "OEM Ceramic Brake Pad Set (Front)",
    quantity: 8,
    reorderLevel: 3,
    cost: 14500,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "part-oil-5w30",
    shopId: "shop-cuid-apex",
    sku: "OIL-SYN-5W30",
    name: "Full Synthetic Engine Oil 5W-30 (4L)",
    quantity: 15,
    reorderLevel: 5,
    cost: 9500,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "part-spk-irid",
    shopId: "shop-cuid-apex",
    sku: "SPK-NGK-IRID",
    name: "NGK Laser Iridium Spark Plug (Pack of 4)",
    quantity: 2,
    reorderLevel: 4,
    cost: 11000,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po-2026-001",
    shopId: "shop-cuid-apex",
    status: "ORDERED",
    createdById: "usr-parts-1",
    createdAt: "2026-10-08T15:00:00.000Z",
    updatedAt: "2026-10-08T15:00:00.000Z",
    items: [
      {
        id: "poi-1",
        purchaseOrderId: "po-2026-001",
        partId: "part-spk-irid",
        bookingId: "job-tech-102",
        qtyOrdered: 6,
        qtyReceived: 0,
        part: {
          id: "part-spk-irid",
          name: "NGK Laser Iridium Spark Plug (Pack of 4)",
          sku: "SPK-NGK-IRID",
        },
      },
    ],
  },
];

export const MOCK_QC_QUEUE: QcQueueItem[] = [
  {
    bookingId: "book-qc-201",
    shopId: "shop-cuid-apex",
    vehicleRegNo: "ICT-22-1109",
    vehicleModel: "Kia Sportage FWD 2.0",
    technicianName: "Rashid Mahmood",
    enteredQcAt: "2026-10-09T11:45:00.000Z",
  },
  {
    bookingId: "book-qc-202",
    shopId: "shop-cuid-apex",
    vehicleRegNo: "KHI-21-7744",
    vehicleModel: "Hyundai Tucson GLS 2.0",
    technicianName: "Asif Nawaz",
    enteredQcAt: "2026-10-09T12:30:00.000Z",
  },
];

export const MOCK_QC_ISSUES: QcIssue[] = [
  {
    id: "qci-1",
    bookingId: "book-qc-201",
    raisedById: "usr-qc-1",
    raisedByName: "Bilal Inspector",
    title: "Steering Wheel Off-Center During Road Test",
    description: "Wheel pulls slightly to the left under moderate acceleration. Needs toe angle recalibration.",
    createdAt: "2026-10-09T13:10:00.000Z",
  },
];
