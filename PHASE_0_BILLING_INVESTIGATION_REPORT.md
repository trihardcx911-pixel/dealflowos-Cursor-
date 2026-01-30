# Phase 0: Billing Infrastructure Investigation Report

## A) Route Mounting & Auth

**billing router mounted at:** `/api/billing`  
**protected by:** `requireAuth` middleware + `billingRateLimiter`  
**webhook route path:** `/stripe/webhook` (bypasses auth, uses raw body for signature verification)

**Reference:** `server/src/server.ts` line 262

## B) Existing Billing Endpoints

| method | path | calls Stripe? | reads DB? | response keys |
|--------|------|---------------|-----------|---------------|
| GET | `/api/billing/status` | No | Yes | `billingStatus`, `plan`, `cancelAtPeriodEnd`, `currentPeriodEnd` |
| POST | `/api/billing/create-checkout-session` | Yes | Yes | `url`, `id` |
| POST | `/api/billing/portal` | Yes | Yes | `url` |
| GET | `/api/billing/invoices` | Yes | Yes | `items` (array) |
| POST | `/api/billing/retry/:invoiceId` | Yes | Yes | `success`, `invoiceId`, `status` |
| GET | `/api/billing/invoice/:id/pdf` | Yes | Yes | `url` |

**Missing endpoints (to be created in Phase 1+):**
- `GET /api/billing/summary` - **NOT FOUND**
- `POST /api/billing/cancel` - **NOT FOUND**
- `POST /api/billing/resume` - **NOT FOUND**
- `POST /api/billing/change-plan` - **NOT FOUND**

## C) Webhook Coverage

**handled event types:**
1. `checkout.session.completed` - Handles subscription creation after checkout
2. `invoice.payment_succeeded` - Updates billing status on successful payment
3. `invoice.payment_failed` - Sets status to `past_due`
4. `customer.subscription.updated` - Syncs subscription changes (status, price, cancel_at_period_end)
5. `customer.subscription.deleted` - Marks subscription as canceled

**Missing event handler:**
- `customer.subscription.created` - **NOT HANDLED** (edge case when checkout.session.completed is missed)

**user lookup method:**
- Strategy 1: Find by `subscriptionId` (most reliable)
- Strategy 2: Find by `customerId` (fallback)
- Strategy 3: Find by `metadata.userId` (from checkout session metadata)
- **BOLA-safe:** All lookups use stored identifiers from User table, never trust client input

**idempotency method:**
- Uses `lastStripeEventId` column on User table
- Function: `isDuplicateWebhook(userId, eventId)` checks if `user.lastStripeEventId === event.id`
- **Potential issue:** If events arrive out of order, only the latest event ID is stored. However, webhook handlers retrieve full subscription state from Stripe API, so out-of-order events should still result in correct final state.

**fields persisted to User:**
- `stripeCustomerId` ✅
- `stripeSubscriptionId` ✅
- `stripePriceId` ✅
- `billingStatus` ✅
- `cancelAtPeriodEnd` ✅
- `currentPeriodEnd` ✅
- `lastStripeEventId` ✅
- `subscriptionCancelledAt` ✅ (only on deletion)
- `trialEnd` ❌ **MISSING** - Not persisted in any webhook handler

**Reference:** `server/src/routes/stripeWebhook.ts` lines 18-270

## D) DB Fields Confirmed

**billing columns present:**
- `stripeCustomerId` (TEXT, nullable)
- `stripeSubscriptionId` (TEXT, nullable)
- `stripePriceId` (TEXT, nullable)
- `billingStatus` (TEXT, nullable)
- `cancelAtPeriodEnd` (BOOLEAN, nullable)
- `currentPeriodEnd` (TIMESTAMPTZ, nullable)
- `lastStripeEventId` (TEXT, nullable)
- `subscriptionCancelledAt` (TIMESTAMPTZ, nullable)
- `email` (TEXT, nullable)

**missing columns:**
- `trialEnd` (TIMESTAMPTZ) - **MUST ADD** in Phase 1 migration

**does User.name exist?** **NO** - User table has `display_name` (from `add_firebase_user_fields.sql`), not `name`. Use `display_name` or fallback to `email` for customer name in summary endpoint.

**Reference:** `server/src/migrations/2026_01_11_add_user_billing_columns.sql`

## E) Invoice Data Compatibility

**invoices endpoint shape matches BillingRowData?** **YES** (with minor differences)

**invoices endpoint response:** `{ items: Array<{ id, type, date, amount, currency, status, description, invoiceNumber?, receiptNumber?, chargeId?, refundReason?, hostedInvoiceUrl?, invoicePdf? }> }`

**BillingRowData interface:**
```typescript
{
  id: string;
  type: 'charge' | 'refund' | 'invoice' | 'failed';
  date: string;
  description: string;
  amount: number;
  status?: 'OPEN' | 'OVERDUE';
  invoiceNumber?: string;
  receiptNumber?: string;
  refundReason?: string;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}
```

**differences:**
1. Invoices endpoint returns `date` as ISO string (e.g., `"2024-01-15T00:00:00.000Z"`), BillingRow expects formatted date string (e.g., `"Jan 15, 2024"`). **Frontend must format** - not a blocker.
2. Invoices endpoint returns `status` as Stripe status (`"paid"`, `"open"`, `"uncollectible"`, `"void"`), BillingRow expects `'OPEN' | 'OVERDUE'`. **Mapping needed** - invoices endpoint already maps `"uncollectible" | "void"` to `type: "failed"`, but `status` field may need transformation.
3. Invoices endpoint includes `currency` and `chargeId` fields not in BillingRowData - **safe to ignore** in frontend.

**Reference:** `server/src/routes/billing.ts` lines 462-608, `web/src/components/billing/BillingRow.tsx` lines 6-18

## F) Phase Readiness Decision

**OK to proceed to Phase 1 migration?** **YES**

**blockers (if any):**
- **NONE** - All routes properly mounted, auth middleware in place, webhook can map events to users, invoices endpoint exists and is compatible.

**Non-blocking gaps (to address in Phase 1+):**
1. `trialEnd` column missing from User table - **Add in Phase 1 migration**
2. `customer.subscription.created` handler missing - **Add in Phase 2 webhook update**
3. `trialEnd` not persisted in webhook handlers - **Fix in Phase 2**
4. `GET /api/billing/summary` endpoint missing - **Add in Phase 3**
5. `POST /api/billing/cancel` endpoint missing - **Add in Phase 4**
6. `POST /api/billing/resume` endpoint missing - **Add in Phase 4**
7. `POST /api/billing/portal` returnUrl hardcoded - **Update in Phase 4** (accept returnUrl param)
8. User table has `display_name` not `name` - **Use display_name in summary endpoint**

**Contract Lock Proposal:**

**GET /api/billing/summary response shape:**
```typescript
{
  customer: {
    name?: string;  // from User.display_name
    email?: string; // from User.email
  };
  plan: {
    priceId?: string;
    name?: string;      // from Stripe product.name (best-effort)
    amount?: number;    // from Stripe price.unit_amount / 100 (best-effort)
    interval?: string;  // from Stripe price.recurring.interval (best-effort)
  } | null;
  subscription: {
    status: string | null;           // from User.billingStatus
    cancelAtPeriodEnd: boolean;      // from User.cancelAtPeriodEnd
    currentPeriodEnd: string | null; // from User.currentPeriodEnd (ISO)
    trialEnd: string | null;         // from User.trialEnd (ISO)
  };
  paymentMethod: {
    brand?: string;    // from Stripe paymentMethod.card.brand (best-effort)
    last4?: string;    // from Stripe paymentMethod.card.last4 (best-effort)
    expMonth?: number; // from Stripe paymentMethod.card.exp_month (best-effort)
    expYear?: number;  // from Stripe paymentMethod.card.exp_year (best-effort)
  } | null;
}
```

**Decision:** DB-first for status/subscription fields (fast, consistent). Stripe API best-effort for plan name + card details (enrichment only, failures don't break summary).

---

**Report generated:** Phase 0 investigation complete. No blocking issues found. Ready to proceed with Phase 1 migration.







