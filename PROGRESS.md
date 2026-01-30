# PROGRESS.md

Project progress tracker for DealflowOS. Last updated: January 2026.

## Status Legend
- ✅ **Complete** - Production-ready, verified
- 🚧 **In Progress** - Actively being worked on
- 📋 **Planned** - Documented plan exists, not started
- ❌ **Blocked** - Waiting on dependency

---

## Completed Features

### Phase 0: Foundation (Calendar + Auth) ✅
- Fixed `CalendarEvent.userId` type mismatch (Int → String)
- Made orgId scoping reliable in production auth
- Safe SQL migration with USING clause

### Phase 1: Reminders Infrastructure ✅
- Reminder model with DB + in-memory fallback
- Background scheduler (60s interval)
- RESTful API endpoints (`GET /api/reminders/due`, `PATCH /mark-delivered`)
- Frontend polling hook (30s interval)
- Toast notifications with localStorage coordination

### Phase 2: Calendar → Reminders Integration ✅
- Reminder controls in EventModal (checkbox + dropdown)
- Calendar CRUD with reminder lifecycle
- Non-blocking reminder operations
- Reminder invalidation on event deletion

### Phase 3: Tasks Backend + Task Reminders ✅
- Task model with orgId/userId/dueAt/status/leadId fields
- Full CRUD API (`GET /api/tasks`, `POST`, `PATCH`, `DELETE`)
- Task reminder integration
- Frontend TasksPage backed by API

### Billing entitlement hardening ✅
- **Time-based entitlement checks** (requireAuth): Access is denied if `billingStatus` is trialing but `trialEnd` has passed, or if status is active/trialing/past_due but `currentPeriodEnd` has passed. Robust date parsing (ISO string or Date; null-safe). Dev-only diagnostic log when `DEV_DIAGNOSTICS=1` (billingStatus, trialEnd, currentPeriodEnd, nowIso, expired flags).
- **Dev billing bypass flag**: `DEV_BILLING_BYPASS=1` (dev-only) skips subscription gating so local work can continue after trial/period end. Hard-gated: never active in production. One-time boot log: `[BILLING] DEV_BILLING_BYPASS enabled`. Documented in `server/.env.example`.

---

## Planned Features

### Auth & Identity

| Feature | Status | Priority | Docs |
|---------|--------|----------|------|
| Auth 401 Fix (dev JWT signing) | 📋 Planned | High | AUTH_401_FIX_AND_EMAIL_PASSWORD_PLAN.md |
| Email/Password Management | 📋 Planned | Medium | AUTH_401_FIX_AND_EMAIL_PASSWORD_PLAN.md |
| API Identity Unification | 📋 Planned | High | API_IDENTITY_UNIFICATION_PLAN.md |

### Leads & Data

| Feature | Status | Priority | Docs |
|---------|--------|----------|------|
| Leads Import Unblock | 📋 Planned | High | LEADS_IMPORT_UNBLOCK_PLAN.md |
| Bulk Select + Delete | 📋 Planned | Medium | LEADS_BULK_SELECT_DELETE_PLAN.md |
| Leads Overview Unification | 📋 Planned | Medium | LEADS_OVERVIEW_UNIFICATION_PLAN.md |

### KPIs & Analytics

| Feature | Status | Priority | Docs |
|---------|--------|----------|------|
| Lead Sources Pie Chart Fix | 📋 Planned | High | LEAD_SOURCES_PIE_CHART_FIX_PLAN.md |
| KPI Semantic Colors | 📋 Planned | Low | KPI_SEMANTIC_COLORS_IMPLEMENTATION_PLAN.md |

### Dashboard & UI

| Feature | Status | Priority | Docs |
|---------|--------|----------|------|
| Dashboard Geometry (280px cards) | 📋 Planned | Low | DASHBOARD_GEOMETRY_IMPLEMENTATION_PLAN.md |

### Deal Milestones

| Phase | Status | Docs |
|-------|--------|------|
| Phase 1 | ✅ Complete | DEAL_MILESTONES_PHASE1_SUMMARY.md |
| Phase 2 | ✅ Complete | DEAL_MILESTONES_PHASE2_SUMMARY.md |
| Phase 3 | ✅ Complete | DEAL_MILESTONES_PHASE3_SUMMARY.md |
| Phase 4 | ✅ Complete | DEAL_MILESTONES_PHASE4_SUMMARY.md |
| Phase 5 | ✅ Complete | DEAL_MILESTONES_PHASE5_SUMMARY.md |

---

## Blocking Dependencies

1. **API Identity Unification** blocks:
   - Lead Sources Pie Chart Fix
   - Leads Overview Unification
   - KPI consistency across all views

2. **Leads Import Unblock** blocks:
   - Full import flow functionality
   - `kpis.dev.ts` causing server crash

3. **Firebase Admin SDK research** blocks:
   - Email change verification (Auth Phase 4)

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Dual-mode persistence (DB + in-memory) | Dev mode works without Postgres |
| Canonical API client (`web/src/api.ts`) | Single source of truth for identity |
| Cache-first with React Query | Consistent state, automatic invalidation |
| Org-scoped multi-tenancy | All queries filtered by orgId |
| Idempotency keys for reminders | Prevent duplicate notifications |

---

## Recent Fixes

| Fix | Status | Docs |
|-----|--------|------|
| Billing Cache Stale 402 | ✅ Fixed | (inline) |
| Calendar 404 | ✅ Fixed | CALENDAR_404_FIX.md |
| OrgId Mismatch | ✅ Fixed | ORGID_MISMATCH_FIX_SUMMARY.md |
| Import Preview Clickable | ✅ Fixed | IMPORT_PREVIEW_CLICKABLE_FIX.md |
| Runtime Crash | ✅ Fixed | RUNTIME_CRASH_ANALYSIS.md |

---

## Next Steps (Recommended Order)

1. **Leads Import Unblock** - Remove `kpis.dev.ts` import to fix server boot
2. **API Identity Unification** - Fix dual API client issue
3. **Auth 401 Fix** - Make dev login return signed JWT
4. **Lead Sources Pie Chart** - Depends on identity unification
5. **Bulk Select/Delete** - UX improvement for leads management
- `2026-01-29 12:28:20` | files: dealflow-frontend/.env.example,package-lock.json,package.json,prisma/schema.prisma,prisma/seed.ts | test: manual hook test
- `2026-01-29 12:28:35` | files: dealflow-frontend/.env.example,package-lock.json,package.json,prisma/schema.prisma,prisma/seed.ts | auto: hook write/edit
- `2026-01-29 12:35:54` | GUARDRAIL VIOLATIONS (50): [ORGID-CAST] server/src/routes/billing.ts...
- `2026-01-29 13:01:13` | NEW GUARDRAIL VIOLATIONS (4): [ORGID-INLINE] server/src/routes/leads.import.ts...
- `2026-01-29 13:24:15` | NEW GUARDRAIL VIOLATIONS (3): [ORGID-CAST] server/src/routes/deals.dev.ts...
- `2026-01-29 13:24:58` | NEW GUARDRAIL VIOLATIONS (6): [ORGID-INVARIANT] server/src/routes/billing.ts...
- `2026-01-29 13:26:25` | NEW GUARDRAIL VIOLATIONS (1): [REACT-RETURN-NULL] web/src/App.tsx...

---

## Tier 2.1 Implementation (2026-01-29)

**Completed Tasks:**

- **Task A (P0)**: Signature-based baseline delta
  - Keys now use `RULE|FILE|SIGNATURE` format (sha1 of matched line)
  - Precise detection of NEW violations even if same file+rule
  - Verified: adding new violation detected, reverting shows OK

- **Task B (P0)**: Normalized backend root
  - Moved `getOrgId.ts` from `src/middleware/` to `server/src/middleware/`
  - Guardrails focused on `server/src/routes/` only

- **Task C (P1)**: ORGID-INVARIANT check added
  - Flags routes using org-scoped DB ops without `getOrgId(req)` or `req.orgId`
  - 4 pre-existing violations captured in baseline

- **Task D (P1)**: IMPORT-NO-PARITY check added
  - Flags leads.import.ts if preview/commit lack shared validation
  - 2 pre-existing violations captured in baseline

- **Task E (P2)**: Server boot/env diagnostics de-risked
  - Verbose request logging gated behind `DEV_DIAGNOSTICS=1`
  - Debug endpoint `/api/debug/db-schema` gated behind `isDev`

**State:**
- Baseline: 205 known violations
- Status: OK (0 NEW violations)

- `2026-01-29 18:05:49` | NEW GUARDRAIL VIOLATIONS (2): [ORGID-DEV-HEADER] server/src/routes/leads.import.ts...
- `2026-01-29 18:05:52` | NEW GUARDRAIL VIOLATIONS (2): [ORGID-DEV-HEADER] server/src/routes/leads.import.ts...
- `2026-01-29 18:17:53` | NEW GUARDRAIL VIOLATIONS (2): [ORGID-DEV-HEADER] server/src/routes/leads.import.ts...