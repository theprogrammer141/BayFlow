# Estimate API Contract & Endpoint Handoff

## Overview

The Estimate API provides server-side management of itemized estimates for vehicle repair bookings. It strictly enforces:
1. **Server-Side Financial Calculations:** Totals are always computed on the server as integer PKR `sum(quantity * unitCost)`. Client-supplied totals are completely ignored.
2. **State Machine & Role Guards:**
   - **`INSPECTING` status:** Only the assigned Technician (`booking.technicianId === actor.id`) can edit the estimate.
   - **`ESTIMATE_REVIEW` status:** Only active Service Advisors (`SERVICE_ADVISOR`) or Shop Owners (`OWNER`) can edit the estimate.
   - **Other statuses:** Edits are rejected with `409 CONFLICT`.
3. **Revision Tracking:**
   - Edits made by Service Advisors or Owners during `ESTIMATE_REVIEW` automatically increment `estimate.revision`.
   - The reject-and-revise workflow (`ESTIMATE_REJECTED -> ESTIMATE_REVIEW`) in the centralized state machine also increments `estimate.revision`.
4. **Sent Locking:**
   - Once an estimate is sent to the customer (`sentAt` timestamp set upon transitioning `ESTIMATE_REVIEW -> AWAITING_CUSTOMER`), line items are locked from further editing until rejected and revised.
5. **Read Access Control:**
   - Accessible by the booking's Customer (`booking.customerId === actor.id`) or active staff members belonging to the booking's workshop (`shopId`). Unauthorized users receive `403 FORBIDDEN_ACTION`.

---

## 1. Get Estimate

Retrieve the itemized estimate for a booking.

- **Method:** `GET`
- **Path:** `/api/shops/:shopId/bookings/:id/estimate`
- **Authentication:** Required (HTTP-only cookie `bayflow_token`)
- **Authorization:** Booking customer OR active shop staff/owner

### Request

```http
GET /api/shops/shop_cm123/bookings/bk_789/estimate HTTP/1.1
Host: localhost:3000
Cookie: bayflow_token=...
```

### Success Response (`200 OK`)

```json
{
  "data": {
    "id": "est_abc123",
    "bookingId": "bk_789",
    "revision": 1,
    "total": 12500,
    "sentAt": null,
    "approvedAt": null,
    "rejectedAt": null,
    "createdAt": "2026-10-09T17:40:00.000Z",
    "updatedAt": "2026-10-09T17:40:00.000Z",
    "items": [
      {
        "id": "esti_1",
        "estimateId": "est_abc123",
        "type": "PART",
        "partId": "part_xyz",
        "name": "Brake Pads Front (Set)",
        "quantity": 2,
        "unitCost": 4000,
        "createdAt": "2026-10-09T17:40:00.000Z",
        "updatedAt": "2026-10-09T17:40:00.000Z"
      },
      {
        "id": "esti_2",
        "estimateId": "est_abc123",
        "type": "LABOUR",
        "partId": null,
        "name": "Front Brake Pad Replacement Labour",
        "quantity": 1,
        "unitCost": 4500,
        "createdAt": "2026-10-09T17:40:00.000Z",
        "updatedAt": "2026-10-09T17:40:00.000Z"
      }
    ]
  }
}
```

### Error Responses

- `401 UNAUTHENTICATED`: When no valid authentication cookie is provided.
- `403 FORBIDDEN_ACTION`: When the user is neither the customer nor staff of this shop.
  ```json
  {
    "error": {
      "code": "FORBIDDEN_ACTION",
      "message": "Not authorized to view this estimate"
    }
  }
  ```
- `404 NOT_FOUND`: When the booking or estimate does not exist.
  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "Estimate not found for this booking"
    }
  }
  ```

---

## 2. Save / Replace Estimate Lines

Atomically replace estimate lines, recalculate totals, and track revisions.

- **Method:** `PUT`
- **Path:** `/api/shops/:shopId/bookings/:id/estimate`
- **Authentication:** Required
- **Authorization:**
  - Assigned Technician when `status == "INSPECTING"`
  - Service Advisor or Owner when `status == "ESTIMATE_REVIEW"`

### Request Body Schema (`SaveEstimateRequestSchema`)

```typescript
{
  items: Array<{
    type: "PART" | "LABOUR";
    partId?: string | null;
    name: string;
    quantity: number;   // Integer >= 1
    unitCost: number;   // Integer >= 0 PKR
  }>; // Minimum 1 line item
}
```

### Example Request (`PUT`)

```http
PUT /api/shops/shop_cm123/bookings/bk_789/estimate HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: bayflow_token=...

{
  "items": [
    {
      "type": "PART",
      "partId": "part_456",
      "name": "Spark Plugs (Set of 4)",
      "quantity": 4,
      "unitCost": 1500
    },
    {
      "type": "LABOUR",
      "name": "Engine Diagnostics & Tune-up",
      "quantity": 2,
      "unitCost": 2500
    }
  ]
}
```

### Success Response (`200 OK`)

```json
{
  "data": {
    "id": "est_abc123",
    "bookingId": "bk_789",
    "revision": 2,
    "total": 11000,
    "sentAt": null,
    "approvedAt": null,
    "rejectedAt": null,
    "items": [
      {
        "id": "esti_3",
        "estimateId": "est_abc123",
        "type": "PART",
        "partId": "part_456",
        "name": "Spark Plugs (Set of 4)",
        "quantity": 4,
        "unitCost": 1500
      },
      {
        "id": "esti_4",
        "estimateId": "est_abc123",
        "type": "LABOUR",
        "partId": null,
        "name": "Engine Diagnostics & Tune-up",
        "quantity": 2,
        "unitCost": 2500
      }
    ]
  }
}
```

### Error Responses

- `400 VALIDATION_ERROR`: When payload schema validation fails.
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": {
        "fieldErrors": {
          "items": ["At least one item is required"]
        }
      }
    }
  }
  ```
- `403 FORBIDDEN_ACTION`:
  - When a non-assigned technician attempts to edit in `INSPECTING`:
    ```json
    {
      "error": {
        "code": "FORBIDDEN_ACTION",
        "message": "Only the assigned technician can edit estimates during inspection"
      }
    }
    ```
  - When non-SA/non-Owner attempts to edit in `ESTIMATE_REVIEW`:
    ```json
    {
      "error": {
        "code": "FORBIDDEN_ACTION",
        "message": "Only Service Advisors or Shop Owners can edit estimates during review"
      }
    }
    ```
- `409 CONFLICT`:
  - When the booking is in an unpermitted status:
    ```json
    {
      "error": {
        "code": "CONFLICT",
        "message": "Estimates cannot be edited while booking is in CONFIRMED status"
      }
    }
    ```
  - When trying to modify an already sent estimate:
    ```json
    {
      "error": {
        "code": "CONFLICT",
        "message": "Sent estimates are locked and cannot be modified until rejected and revised"
      }
    }
    ```

---

## 3. State Machine Integration Summary

| Event | Status Transition | Actor | State Machine Effect |
|---|---|---|---|
| Technician submits estimate | `INSPECTING -> ESTIMATE_REVIEW` | Assigned Technician | Creates Estimate (revision 1) if not already created; verifies at least 1 line item. |
| SA reviews & sends to customer | `ESTIMATE_REVIEW -> AWAITING_CUSTOMER` | SA / Owner | Recomputes total, sets `sentAt = now()`, locking the estimate lines. |
| Customer approves estimate | `AWAITING_CUSTOMER -> ESTIMATE_APPROVED` | Customer | Sets `approvedAt = now()`. |
| Customer rejects estimate | `AWAITING_CUSTOMER -> ESTIMATE_REJECTED` | Customer | Sets `rejectedAt = now()`. |
| SA decides to revise with Technician | `ESTIMATE_REJECTED -> ESTIMATE_REVIEW` | SA / Owner | Increments `estimate.revision += 1`, clears `rejectedAt = null`. |
