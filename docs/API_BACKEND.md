# DealflowOS Backend API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
All `/api/*` routes require authentication via:
- **Production**: Bearer token in `Authorization` header
- **Development**: Set `DEV_AUTH_BYPASS=true` and use headers:
  - `x-dev-user-id`: User ID
  - `x-dev-user-email`: User email

---

## Leads API

### GET /api/leads
Get all leads for the organization.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| isQualified | boolean | Filter by qualification |
| limit | number | Results per page (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "items": [Lead],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### GET /api/leads/:id
Get a single lead with related data.

**Response:** Lead object with events, deals, pipeline history, contacts

### POST /api/leads
Create a new lead.

**Body:**
```json
{
  "address": "123 Main St",
  "city": "Austin",
  "state": "TX",
  "zip": "78701",
  "arv": 250000,
  "estimatedRepairs": 35000,
  "investorMultiplier": 0.70,
  "desiredAssignmentFee": 10000,
  "offerPrice": 150000,
  "sellerName": "John Doe",
  "sellerPhone": "512-555-1234",
  "sellerEmail": "john@example.com",
  "propertyType": "sfr",
  "bedrooms": 3,
  "bathrooms": 2,
  "squareFeet": 1800,
  "yearBuilt": 1985,
  "lotSize": 7500
}
```

**Response:** `201 Created` with Lead object

### PUT /api/leads/:id
Update a lead (full update).

### PATCH /api/leads/:id/status
Update lead status.

**Body:**
```json
{
  "status": "contacted"
}
```

**Status Values:**
- `new` - Fresh lead
- `contacted` - Initial contact made
- `qualified` - Lead qualified
- `offer_made` - Offer submitted
- `under_contract` - Contract signed
- `closed` - Deal closed
- `dead` - Lead lost

### PATCH /api/leads/:id/qualify
Qualify or disqualify a lead.

**Body:**
```json
{
  "isQualified": true
}
```

### DELETE /api/leads/:id
Soft delete (marks as "dead").

### DELETE /api/leads/:id/hard
Permanently delete lead.

---

## Deals API

### GET /api/deals
Get all deals.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| limit | number | Results per page |
| offset | number | Pagination offset |

### GET /api/deals/:id
Get single deal with lead details.

### POST /api/deals
Create deal from lead.

**Body:**
```json
{
  "leadId": "lead_abc123",
  "buyerName": "ABC Investments",
  "assignmentFee": 15000,
  "dealType": "assignment"
}
```

### PUT /api/deals/:id
Update deal.

### PATCH /api/deals/:id/close
Close a deal.

**Body:**
```json
{
  "profit": 15000,
  "closeDate": "2024-01-15T00:00:00Z"
}
```

### PATCH /api/deals/:id/cancel
Cancel a deal.

**Body:**
```json
{
  "reason": "Buyer backed out"
}
```

---

## Lead Events API

### GET /api/lead-events/:leadId
Get events for a lead.

### POST /api/lead-events/:leadId
Create generic event.

**Body:**
```json
{
  "eventType": "contacted",
  "metadata": { "method": "phone" }
}
```

### POST /api/lead-events/:leadId/call
Log a phone call.

**Body:**
```json
{
  "duration": 300,
  "outcome": "spoke_with_seller",
  "notes": "Seller interested in selling quickly"
}
```

### POST /api/lead-events/:leadId/sms
Log an SMS.

**Body:**
```json
{
  "message": "Hi, interested in your property...",
  "direction": "outbound"
}
```

### POST /api/lead-events/:leadId/email
Log an email.

**Body:**
```json
{
  "subject": "Cash offer for your property",
  "direction": "outbound"
}
```

### POST /api/lead-events/:leadId/note
Add a note.

**Body:**
```json
{
  "content": "Seller motivated, needs to sell by end of month"
}
```

---

## KPIs API

### GET /api/kpis
Get basic KPIs.

**Response:**
```json
{
  "totalLeads": 150,
  "activeLeads": 75,
  "qualifiedLeads": 30,
  "totalProfit": 125000,
  "totalRevenue": 180000,
  "dealCount": 12,
  "closedDealCount": 8,
  "qualificationRate": 20.0,
  "dealCloseRatio": 66.7
}
```

### GET /api/kpis/full
Get complete KPI dashboard.

**Response:** Extended KPIs including:
- Contact rate
- Average pipeline time
- Monthly/weekly revenue
- Daily activity
- Average offer-to-MOA spread
- Lead-to-contract cycle time

### GET /api/kpis/pipeline
Get pipeline statistics.

**Response:**
```json
{
  "stats": [{ "stage": "new", "count": 50 }],
  "byStage": [{ "stage": "new", "count": 50 }],
  "velocity": 24.5,
  "transitions": [{ "transition": "new → contacted", "count": 45 }]
}
```

### GET /api/kpis/pipeline/activity
Get recent pipeline activity.

### GET /api/kpis/analytics
Get analytics data.

**Query Parameters:**
- `days`: Number of days to analyze (default: 30)

### GET /api/kpis/revenue
Get revenue metrics.

---

## User Settings API

### GET /api/user-settings
Get current user settings.

**Response:**
```json
{
  "userId": "user_123",
  "defaultMultiplier": 0.70,
  "defaultAssignmentFee": 10000,
  "defaultFollowupInterval": 3
}
```

### PUT /api/user-settings
Update settings (full).

### PATCH /api/user-settings
Update settings (partial).

### DELETE /api/user-settings
Reset to defaults.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `CONFLICT` | 409 | Duplicate resource |
| `SERVER_ERROR` | 500 | Internal server error |

**Error Response Format:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [{ "path": ["field"], "message": "validation error" }]
}
```

---

## Health Check Endpoints

### GET /healthz
Liveness probe.

**Response:** `200 OK` with body `ok`

### GET /readyz
Readiness probe (checks DB, Redis).

**Response:** `200 OK` with body `ready` or `503` if not ready

---

## Legacy Endpoints

These endpoints exist for backwards compatibility:

### GET /leads
Get leads (requires `orgId` query param).

### POST /leads
Create lead (requires `orgId` in body).

### GET /calendar
Calendar events.

### POST /calendar
Create calendar event.










