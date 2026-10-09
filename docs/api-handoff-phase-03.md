# Phase 03 API Handoff — Customer Portal & Booking Engine

This document defines the API contracts, endpoint URLs, request/response schemas, and error behavior implemented in **Phase 03 (Customer Portal and Booking Engine)** for integration with the Service Advisor (SA) module (Phase 04) and subsequent phases.

---

## 1. Authentication & Tenancy Model

- **Customer Scope:** Customers are global user entities (`isCustomer: true`). Their data access is scoped strictly by `booking.customerId === authenticatedUser.id`. Cross-customer reads or transitions return `403 ForbiddenError`.
- **Session Mechanism:** Uses `httpOnly` cookie (`bayflow_token`) or `Authorization: Bearer <JWT>`. Successful booking creation automatically issues a token and attaches the session cookie.
- **Shop Scope:** Public queries (`/api/public/*`) expose only non-sensitive operational information (shop name, working hours, capacity, available services, available slots). Private staff fields (`ownerId`, team rosters, supplier costs) are never leaked.

---

## 2. Public Shop Discovery & Slot Engine

### 2.1 List Public Shops
- **Endpoint:** `GET /api/public/shops` (rewritten from `/public/shops`)
- **Query Parameters:**
  - `city` (optional): Filter by city name (case-insensitive substring).
  - `q` (optional): Search query matched against shop name, city, or address.
- **Response Shape (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid-shop-1",
      "name": "Apex Auto Works",
      "address": "Plot 14-C, Phase 6 DHA",
      "city": "Karachi",
      "phone": "+92 300 1234567",
      "logoUrl": null,
      "workStart": "09:00",
      "workEnd": "18:00",
      "slotMinutes": 60,
      "slotCapacity": 3,
      "rating": 4.8,
      "services": [
        {
          "id": "cuid-srv-1",
          "name": "Synthetic Oil & Filter Service",
          "description": "Full synthetic 5W-30 oil",
          "estMinutes": 45,
          "basePrice": 12500
        }
      ]
    }
  ]
}
```

### 2.2 List Available Slots for Shop & Date
- **Endpoint:** `GET /api/public/shops/:shopId/slots?date=YYYY-MM-DD`
- **Behavior:**
  - Materializes slot records in the database if not yet generated.
  - Returns **only slots with remaining capacity** (`booked < capacity`).
  - Dates and hours follow shop-specific `workStart`, `workEnd`, `slotMinutes`, and `slotCapacity`.
- **Response Shape (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid-slot-0900",
      "shopId": "cuid-shop-1",
      "startsAt": "2026-10-15T09:00:00.000Z",
      "capacity": 3,
      "booked": 1,
      "available": true
    },
    {
      "id": "cuid-slot-1000",
      "shopId": "cuid-shop-1",
      "startsAt": "2026-10-15T10:00:00.000Z",
      "capacity": 3,
      "booked": 2,
      "available": true
    }
  ]
}
```

---

## 3. Booking Creation Service

- **Endpoint:** `POST /api/bookings` (rewritten from `/bookings`)
- **Authentication:** Public (creates or reuses customer account and sets session cookie).
- **Transactional Guarantees:**
  - Entire operation runs in a single database transaction.
  - Claims slot capacity using atomic conditional update (`WHERE booked < capacity`). Concurrent attempts for the final available spot prevent overbooking (`409 ConflictError`).
  - If existing email is supplied with an incorrect password, fails with `400 ValidationError` and rolls back any partial vehicle or slot records.
  - Creates booking in `PENDING` status.
  - Automatically writes `BookingHistory` record.
  - Emits in-app notifications to active SAs and Owners of the shop.
  - Issues JWT and sets `bayflow_token` `httpOnly` cookie.

### Request Payload:
```json
{
  "shopId": "cuid-shop-1",
  "slotId": "cuid-slot-0900",
  "serviceIds": ["cuid-srv-1"],
  "customerNotes": "Brake squeaking noise on deceleration",
  "customer": {
    "name": "Hamza Malik",
    "email": "hamza@example.com",
    "phone": "+92 301 5551234",
    "password": "customerpassword123"
  },
  "vehicle": {
    "regNo": "LEA-20-4521",
    "make": "Toyota",
    "model": "Corolla Altis Grande",
    "year": 2020,
    "color": "Super White",
    "mileage": 42000
  }
}
```

### Response Payload (201 Created):
```json
{
  "data": {
    "booking": {
      "id": "cuid-booking-1",
      "status": "PENDING",
      "shopId": "cuid-shop-1",
      "customerId": "cuid-user-cust",
      "vehicleId": "cuid-veh-1",
      "slotId": "cuid-slot-0900",
      "customerNotes": "Brake squeaking noise on deceleration",
      "createdAt": "2026-10-15T08:30:00.000Z"
    },
    "user": {
      "id": "cuid-user-cust",
      "name": "Hamza Malik",
      "email": "hamza@example.com",
      "isCustomer": true
    },
    "token": "eyJhbGciOi..."
  }
}
```

---

## 4. Customer Bookings Management

### 4.1 List My Bookings
- **Endpoint:** `GET /api/me/bookings`
- **Headers:** `Cookie: bayflow_token=...` or `Authorization: Bearer <token>`
- **Response Shape (200 OK):**
```json
{
  "data": [
    {
      "id": "cuid-booking-1",
      "status": "AWAITING_CUSTOMER",
      "createdAt": "2026-10-15T08:30:00.000Z",
      "vehicle": {
        "regNo": "LEA-20-4521",
        "make": "Toyota",
        "model": "Corolla Altis Grande",
        "year": 2020
      },
      "shop": {
        "name": "Apex Auto Works",
        "city": "Karachi",
        "address": "Plot 14-C, Phase 6 DHA"
      },
      "slot": {
        "startsAt": "2026-10-15T09:00:00.000Z"
      },
      "estimate": {
        "id": "cuid-est-1",
        "revision": 1,
        "total": 24500
      }
    }
  ]
}
```

### 4.2 Get Booking Details
- **Endpoint:** `GET /api/me/bookings/:id`
- **Ownership:** Enforces `booking.customerId === authenticatedUser.id`. Unauthorized access returns `403 ForbiddenError`.
- **Response Shape (200 OK):**
```json
{
  "data": {
    "id": "cuid-booking-1",
    "status": "AWAITING_CUSTOMER",
    "customerNotes": "Brake squeaking noise on deceleration",
    "vehicle": {
      "regNo": "LEA-20-4521",
      "make": "Toyota",
      "model": "Corolla Altis Grande",
      "year": 2020,
      "color": "Super White",
      "mileage": 42000
    },
    "shop": {
      "name": "Apex Auto Works",
      "city": "Karachi",
      "address": "Plot 14-C, Phase 6 DHA",
      "phone": "+92 300 1234567"
    },
    "slot": {
      "startsAt": "2026-10-15T09:00:00.000Z"
    },
    "services": [
      {
        "id": "cuid-bsrv-1",
        "quantity": 1,
        "unitPrice": 12500,
        "service": {
          "name": "Synthetic Oil & Filter Service"
        }
      }
    ],
    "estimate": {
      "id": "cuid-est-1",
      "revision": 1,
      "total": 24500,
      "sentAt": "2026-10-15T11:00:00.000Z",
      "approvedAt": null,
      "rejectedAt": null,
      "items": [
        {
          "id": "item-1",
          "type": "PART",
          "name": "Ceramic Brake Pads Front",
          "quantity": 1,
          "unitCost": 16000
        },
        {
          "id": "item-2",
          "type": "LABOUR",
          "name": "Front Disc Resurfacing & Pad Fitting",
          "quantity": 1,
          "unitCost": 8500
        }
      ]
    },
    "history": [
      {
        "id": "hist-1",
        "fromStatus": null,
        "toStatus": "PENDING",
        "note": "Appointment booked online by customer",
        "createdAt": "2026-10-15T08:30:00.000Z"
      },
      {
        "id": "hist-2",
        "fromStatus": "PENDING",
        "toStatus": "CONFIRMED",
        "note": "Bay allocated",
        "createdAt": "2026-10-15T08:45:00.000Z"
      }
    ]
  }
}
```

---

## 5. Customer State Machine Transitions

- **Endpoint:** `POST /api/me/bookings/:id/transition`
- **Engine:** Calls the centralized `transitionBooking` engine in `src/lib/services/booking-state.ts`.
- **Ownership:** Caller must be the customer who owns the booking.

### 5.1 Supported Customer Transitions

| Action | Current Status | Target (`to`) | Guards & Side Effects |
|---|---|---|---|
| **Cancel Appointment** | `PENDING` | `CANCELLED` | Counterparty notification to SAs; releases allocations. |
| **Approve Estimate** | `AWAITING_CUSTOMER` | `ESTIMATE_APPROVED` | Sets `approvedAt`; notifies SA. |
| **Decline Estimate** | `AWAITING_CUSTOMER` | `ESTIMATE_REJECTED` | Sets `rejectedAt`; stores rejection note; notifies SA. |
| **Confirm Vehicle Pickup** | `READY_FOR_PICKUP` | `COMPLETED` | Sets `completedAt`. |

### 5.2 Example Transition Requests

#### Approve Estimate:
```json
{
  "to": "ESTIMATE_APPROVED",
  "note": "Approved online by customer"
}
```

#### Decline Estimate (with feedback note):
```json
{
  "to": "ESTIMATE_REJECTED",
  "note": "Please quote alternative brake pad brand"
}
```

#### Cancel Appointment:
```json
{
  "to": "CANCELLED",
  "note": "Schedule conflict"
}
```

#### Confirm Vehicle Collected:
```json
{
  "to": "COMPLETED"
}
```

### 5.3 Error Status Codes

- `401 Unauthorized`: Session cookie missing or expired.
- `403 Forbidden`: Authenticated user does not own `booking.customerId`.
- `404 Not Found`: Booking ID does not exist.
- `409 Conflict`: Invalid transition for current status (e.g., trying to approve while in `IN_REPAIR` or `PENDING`).
