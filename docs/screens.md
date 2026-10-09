# BayFlow — Shop Floor Screen & Field Specifications

This document outlines the screens, components, and field lists for the Technician, Parts Person, and QC Inspector dashboards under `(pos)/`.

---

## 1. Technician Dashboard (`/(pos)/technician`)

### 1.1 My Assigned Jobs (`/pos/technician`)
Lists bookings assigned to the authenticated technician (`status IN [ASSIGNED, INSPECTING, IN_REPAIR]`).
- **Fields displayed:**
  - `Booking ID`: Unique identifier (`cuid`)
  - `Vehicle`: Registration number, make, model, year, color
  - `Scheduled Slot`: Date and start time
  - `Customer Notes`: Reported symptoms or requested work
  - `Status Badge`: `ASSIGNED`, `INSPECTING`, or `IN_REPAIR`
  - `QC Alert`: Prominent badge if returned from QC with an active issue
- **Actions:**
  - "Start Inspection" (transitions `ASSIGNED -> INSPECTING`)
  - "Continue Inspection / Build Estimate"
  - "Resume Repair" / "Send to QC"

### 1.2 Inspection & Estimate Builder (`/pos/technician/[bookingId]/estimate`)
Active inspection and draft estimate composition.
- **Fields & Form inputs:**
  - `Line Items Table`:
    - `Type`: Select (`PART` | `LABOUR`)
    - `Part`: Dropdown selection from shop catalog (optional if custom part/labour)
    - `Description / Item Name`: String
    - `Quantity`: Integer (`>= 1`)
    - `Unit Cost`: Integer PKR (`>= 0`)
    - `Line Total`: Computed read-only (`quantity * unitCost`)
  - `Estimate Total`: Dynamic sum in PKR
  - `Technician Inspection Notes`: Multiline text
- **Actions:**
  - "Add Line Item"
  - "Remove Line Item"
  - "Submit to SA for Review" (transitions `INSPECTING -> ESTIMATE_REVIEW`)

### 1.3 Active Repair & QC Loop (`/pos/technician/[bookingId]/repair`)
Active repair view once parts are allocated.
- **Fields displayed:**
  - `Allocated Parts List`: Part SKU, name, allocated quantity
  - `Active QC Issues (if returned)`: Issue title, description, inspector name, timestamp
- **Actions:**
  - "Complete Repair & Send to QC" (transitions `IN_REPAIR -> QC_PENDING`)

---

## 2. Parts Person Dashboard (`/(pos)/parts`)

### 2.1 Inventory Catalog (`/pos/parts/inventory`)
Per-shop catalog of parts, stock levels, and procurement thresholds.
- **Fields displayed:**
  - `SKU`: Unique shop part code
  - `Part Name`: Descriptive title
  - `Quantity on Hand`: Integer
  - `Reorder Level`: Threshold integer
  - `Cost (PKR)`: Unit replacement cost
  - `Stock Status`: Badge (`In Stock`, `Low Stock`, `Out of Stock`)
- **Actions & Modals:**
  - "Add New Part" modal (`sku`, `name`, `quantity`, `reorderLevel`, `cost`)
  - "Update Stock / Cost" inline edit

### 2.2 Jobs Awaiting Parts (`/pos/parts/jobs`)
Bookings in `PARTS_PENDING` or `PARTS_ORDERED`.
- **Fields displayed:**
  - `Booking ID`: Unique identifier
  - `Vehicle`: Reg number, make, model
  - `Required Parts List`: Name, required quantity, available quantity, shortage quantity
  - `Status`: `PARTS_PENDING` or `PARTS_ORDERED`
- **Actions:**
  - "Mark Ready" (transitions `PARTS_PENDING -> PARTS_READY` if all parts in stock)
  - "Generate Purchase Order" (pre-populates PO with missing quantities, transitions `PARTS_PENDING -> PARTS_ORDERED`)
  - "Allocate & Release to Repair" (transitions `PARTS_READY -> IN_REPAIR`, atomically decrements stock)

### 2.3 Purchase Orders & Receiving (`/pos/parts/orders`)
Tracking supplier purchase orders and receiving shipments.
- **Fields displayed:**
  - `PO Number`: Cuid / reference
  - `Status`: `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`
  - `Created Date`: Timestamp
  - `PO Items Table`: Part SKU, name, quantity ordered, quantity received, remaining
- **Actions & Modals:**
  - "Receive Order" modal:
    - Input `Quantity Received` per item
    - Submits receipt: updates stock levels; if all items received, updates booking to `PARTS_READY`

---

## 3. QC Inspector Dashboard (`/(pos)/qc`)

### 3.1 Shared QC Queue (`/pos/qc/queue`)
Shared pool of jobs ready for quality verification (`QC_PENDING`).
- **Fields displayed:**
  - `Booking ID`: Unique identifier
  - `Vehicle`: Reg number, make, model
  - `Assigned Technician`: Mechanic who performed the repair
  - `Repair Completion Time`: Timestamp entering QC
  - `Status Badge`: `QC_PENDING`
- **Actions:**
  - "Pick Job for Inspection" (atomic lock: transitions `QC_PENDING -> QC_IN_PROGRESS`, assigns `qcInspectorId`)

### 3.2 Active Quality Inspection (`/pos/qc/[bookingId]`)
Inspection workbench for the locked job.
- **Fields displayed:**
  - `Vehicle & Repair Summary`: Completed services and installed parts
  - `Previous QC History`: Past issues raised (if repeated loop)
  - `Inspector Notes / Checklist`: General inspection comments
- **Actions & Modals:**
  - "Pass Inspection" (transitions `QC_IN_PROGRESS -> READY_FOR_PICKUP`)
  - "Fail Inspection" modal:
    - `Issue Title`: Short summary (e.g., "Brake noise persists")
    - `Issue Description`: Detailed instructions for technician
    - Submits failure: creates `QcIssue`, clears inspector, transitions `QC_IN_PROGRESS -> IN_REPAIR` back to same technician
