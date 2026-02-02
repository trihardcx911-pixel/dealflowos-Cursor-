# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DealflowOS is a wholesale real estate CRM for managing leads, deals, and analytics. It's a monorepo with separate backend and frontend applications.

## Development Commands

### Backend (root directory)
```bash
npm run dev          # Start backend server (port 3010) with tsx watch
npm run dev:all      # Start both backend and frontend concurrently
npm run prisma:generate  # Generate Prisma client after schema changes
```

### Frontend (web/)
```bash
cd web && npm run dev    # Start Vite dev server (port 5173)
cd web && npm run build  # Production build
```

### Legacy Server (server/) - Avoid unless necessary
```bash
cd server && npm run dev      # Legacy backend with auth bypass
cd server && npm run dev:lite # Lightweight dev server
```

### Tests
```bash
cd tests && npx jest              # Run all tests
cd tests && npx jest <file>.test.ts  # Run single test file
```

## Architecture

### Active Stack
- **Backend** (`src/`): Express 5 + TypeScript + Prisma ORM + PostgreSQL
- **Frontend** (`web/`): Vite + React 18 + TailwindCSS + TanStack Query + Firebase Auth
- **Database**: PostgreSQL via Prisma (`prisma/schema.prisma`)
- **Caching**: Redis (ioredis) for KPI caching

### Directory Structure
```
src/
├── routes/       # Express route handlers (leads, deals, calendar, kpis)
├── services/     # Business logic (kpiService, leadScoreService, pipelineService)
├── middleware/   # Auth, validation, error handling
├── db/           # Database pool and utilities
├── workers/      # Background job processors
└── server.ts     # Main entry point

web/src/
├── pages/        # Route pages (LeadsPage, DashboardPage, CalendarPage)
├── components/   # UI components
├── api/          # API client hooks
├── hooks/        # Custom React hooks
└── App.tsx       # Router configuration
```

### Legacy Directories (do not edit)
- `server/`: Older Node backend - kept for reference
- `dealflow-frontend/`: Older React frontend - deprecated

## Key Patterns

### Multi-tenant Isolation
All data is scoped by `orgId`. Queries must always include org filtering.

### Authentication
- **Production**: Firebase Auth with Bearer tokens
- **Development**: Set `DEV_AUTH_BYPASS=1` and use `x-dev-user-id`/`x-dev-user-email` headers

### API Client (Frontend)
Use `web/src/api.ts` for API calls, not direct imports from `api/client`.

### KPI System
- Real-time calculations + daily snapshots in `KpiSnapshot` table
- Cache-first with Redis TTL invalidation
- Event-driven: lead events trigger KPI recalculation

### Lead Status Flow
`new` → `contacted` → `qualified` → `offer_made` → `under_contract` → `closed` (or `dead`)

### Deal Legal Stages
`PRE_CONTRACT` → `UNDER_CONTRACT` → `ASSIGNMENT_IN_PROGRESS` → `ASSIGNED` → `TITLE_CLEARING` → `CLEARED_TO_CLOSE` → `CLOSED`

## Environment Setup

Copy `.env.example` to `.env` (root) and `web/.env.example` to `web/.env`:

```bash
# Root .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wholesale_crm
PORT=3010

# web/.env
VITE_API_URL=http://localhost:3010
# Plus Firebase config vars
```

**Node version**: 18.x or 19.x required (see `engines` in package.json)

## Local Stripe Webhooks

For local dev, Stripe cannot POST to localhost. Use the Stripe CLI to forward webhook events so `billingStatus` updates after checkout and the user is redirected to the app instead of back to onboarding.

1. **Install Stripe CLI** (macOS):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```
2. **Log in to Stripe**:
   ```bash
   stripe login
   ```
3. **Start the backend** on port 3010 (e.g. `cd server && npm run dev`).
4. **Forward webhooks to localhost** (in a separate terminal):
   ```bash
   stripe listen --forward-to localhost:3010/stripe/webhook
   ```
5. **Copy the webhook signing secret** printed by the CLI (e.g. `whsec_...`) into `server/.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
6. **Restart the server** so it picks up the new secret.
7. **Test the flow**: sign up / log in → `/onboarding/plan` → start checkout (e.g. Bronze) → complete payment in Stripe test mode → you should land on `/billing/success` then be redirected to the app (`/leads`), not back to onboarding.

### Troubleshooting

- **Symptoms:** After Stripe payment, user returns to `/onboarding/plan` or sees "Failed to verify subscription status" on `/billing/success`.
- **Cause:** Webhook events are not reaching localhost (Stripe cannot call your machine; you must run `stripe listen`).
- **Verify:** Server logs should show webhook events (e.g. `[STRIPE WEBHOOK] checkout.session.completed`). After payment, `GET /api/billing/status` (with your Bearer token) should return `billingStatus: "active"` or `"trialing"` once the webhook has run.

# DealflowOS (DFOS) — Project Rules (Authoritative)

## 0) What DFOS is
DealflowOS is a multi-tenant wholesale real-estate CRM SaaS.
Stack: React + Tailwind (web/), Node/Express + TypeScript + Prisma + Postgres (server/).
Design: neon red/black cyberpunk + “glass” UI. Dark/light theme parity. i18n (EN/ES/PT).

## 1) Repo map (where to look first)
- web/src/components/ : UI components (LandingPage.tsx is used for marketing/landing surfaces)
- web/src/api.ts : API client + headers/dev identity behavior
- server/src/server.ts : env loading + server bootstrap
- server/src/middleware/requireAuth.ts : auth + request identity/org scoping behavior
- server/src/routes/ : all API routes (leads, tasks, calendar, kpis, billing, imports)
- server/src/db/prisma.ts : Prisma client construction + DATABASE_URL guard

## 2) Non-negotiable data isolation & auth invariants (P0)
### Multi-tenant scoping
- Every route MUST derive orgId consistently from a single helper (e.g., getOrgId(req)).
- NEVER allow cross-tenant reads/writes.
- In production: NEVER accept x-dev-* headers as overrides.
- Avoid inline orgId resolution chains spread across routes.

### Auth mode rules
- If Authorization: Bearer exists, server enters JWT mode.
- DEV headers (x-dev-org-id / x-dev-user-id) may only be honored in DEV AND only when NO Bearer token is present.
- Frontend must not accidentally send Authorization header in DEV when forcing dev identity.

### Environment truth
- server/.env is the single authoritative env source.
- Avoid prisma/.env conflicts.
- In production, DATABASE_URL must be present; fail fast if missing.

## 3) CSV import reliability (P0/P1)
- Upload endpoints must enforce explicit file size limits (multer limits.fileSize).
- Commit endpoints must enforce payload size/row-count guardrails or chunking.
- Prefer predictable failure with clear error messages over silent partial import.

## 4) UI/React structural guardrails (STRICT)
When editing any React/JSX:
- MUST have a single root element (no fragments).
- NO conditional returns (don’t `if (...) return ...`).
- Fullscreen overlays must be rendered unconditionally as siblings (visibility controlled via styles/classes).
- Avoid structural drift: do not rearrange layout hierarchy unless explicitly required.

## 5) UI design system constraints
- Maintain DFOS cyberpunk/glass aesthetic: subtle glow, clean spacing, low clutter.
- Preserve dark/light parity (no “dark-only” hacks).
- Keep typography consistent across cards/pages.
- i18n must remain functional (EN/ES/PT) — do not hardcode strings if i18n is in place.

## 6) Workflow rules (how to change code)
- Prefer the smallest diff that fixes the issue (no refactors unless necessary).
- If terminal commands are needed, list the exact commands FIRST.
- Don’t assume pnpm/rg are available in the environment; check or provide fallbacks.
- Avoid running multiple agents in parallel if it risks code collisions.

## 7) Definition of “done” for risky changes
Any change touching auth/orgId/import must include:
- Clear explanation of orgId derivation path
- Verification steps for:
  1) DEV headers only (no Bearer)
  2) JWT only (Bearer present)
  3) Mixed headers + Bearer (Bearer must win)
  4) Cross-org isolation sanity checks
- Minimal logging/diagnostics if needed for proving runtime behavior

## 8) Local dev notes
- If build tooling differs (pnpm missing), use npm scripts as fallback or instruct installation.
- Do not claim builds passed if they weren’t run successfully in this environment.
DFOS Project Boundaries (Repo-Derived)
1) HARD BOUNDARIES (must not violate)
Auth: Authorization header wins over dev bypass.
If Authorization: Bearer <token> is present, the server always uses JWT auth and never honors x-dev-* or DEV_AUTH_BYPASS.
Why: Prevents dev bypass when a real token is sent.
Evidence: server/src/middleware/requireAuth.ts:174–196 (bearer check first; dev bypass only when !hasBearer).
Dev bypass only when: development + localhost + DEV_AUTH_BYPASS=1 and no Bearer.
Dev bypass must require NODE_ENV === "development", DEV_AUTH_BYPASS === "1", and client IP localhost; it must not run if Authorization: Bearer is set.
Why: Avoids auth bypass in production or from non-local IPs.
Evidence: server/src/middleware/requireAuth.ts:179–184 (devBypass), 681–684 (bypass branch only when no Bearer).
orgId must come from auth middleware only.
All protected routes must use (req as any).orgId or req.user?.orgId set by requireAuth; no route may trust only x-dev-org-id in production or allow unauthenticated org override.
Why: Prevents cross-tenant reads/writes.
Evidence: server/src/middleware/requireAuth.ts:639–641 (JWT: orgId = req.user.id), 687–708 (dev: orgId from header or "org_dev"); routes use (req as any).orgId || req.user?.orgId || req.user?.id (e.g. server/src/routes/leads.dev.ts:23, server/src/routes/tasks.ts:56, server/src/routes/kpis.ts:16, server/src/routes/leads.import.ts:303).
Prisma models that have orgId must be filtered by orgId in every query.
Lead, Deal, Task, and any org-scoped data must include orgId in WHERE clauses.
Why: Enforces tenant isolation at the data layer.
Evidence: server/prisma/schema.prisma:26–60 (Lead.orgId), 109–118 (Task.orgId); route queries use WHERE "orgId" = $1 (e.g. server/src/routes/leads.dev.ts:38, server/src/routes/kpis.ts:203, server/src/routes/leads.import.ts:317).
Server env loaded from server/.env before other imports.
Env must be loaded from server/.env (relative to server entrypoint) before any code that reads process.env (e.g. DATABASE_URL, JWT_SECRET).
Why: Single source of truth; avoids wrong/missing env when Prisma or pool are constructed.
Evidence: server/src/server.ts:1–11 (dotenv from path.resolve(__dirname, "../.env") before other imports).
JWT_SECRET required and length ≥ 32 in production.
In production, server must exit if JWT_SECRET is missing or shorter than 32 characters.
Why: Avoids weak or missing signing secret in prod.
Evidence: server/src/server.ts:124–129.
Stripe webhook route must be mounted before express.json().
Stripe webhooks need raw body for signature verification; JSON body parser must not consume the body for that path.
Why: Webhook signature verification requires raw body.
Evidence: server/src/server.ts:164–165 (comment), 166 (stripeWebhookRouter before json).
Frontend API: single source of truth is web/src/api.ts.
New code must not import from api/client for HTTP calls; use get/post/patch/del from web/src/api.ts.
Why: Centralizes base URL, headers, and dev identity behavior.
Evidence: web/src/api.ts:1–12 (comment and API_BASE); web/package.json script check:api-client enforces no api/client imports.
React structure: single root element; no conditional returns; overlays as siblings.
Components must have one root element (no bare fragments as root). No if (...) return ... that changes structure. Fullscreen overlays must be rendered unconditionally as siblings, with visibility via class/style.
Why: Matches project guardrails and avoids layout/accessibility regressions.
Evidence: CLAUDE.md:104–109 (single root, no conditional returns, overlays as siblings); web/src/components/PricingSection.tsx:423 (“Waitlist Modal Overlay - Always mounted, visibility toggled”).
i18n: user-facing strings must use t() where translations exist.
Do not hardcode strings for nav, settings, resources, dashboard if a key exists in web/src/i18n/translations.ts.
Why: Keeps EN/ES/PT support consistent.
Evidence: web/src/i18n/translations.ts (en/es/pt); usage in web/src/components/TodoCard.tsx, ScheduleCard.tsx, KpiCard.tsx, ResourcesPage.tsx via t() / useLanguage.
2) SOFT CONVENTIONS (preferred patterns)
Prefer one shared orgId helper (e.g. getOrgId(req)) instead of repeating resolution in each route.
Why: Reduces drift and mistakes; today resolution is duplicated (e.g. (req as any).orgId || req.user?.orgId || req.user?.id).
Evidence: Multiple route files use the same pattern (see orgId grep above).
Use npm when pnpm is not in PATH.
Why: Scripts and docs assume npm; pnpm may be missing in some environments.
Evidence: Root and server package.json do not reference pnpm; CLAUDE.md and scripts use npm.
Use grep for search in scripts/audits when rg is not installed.
Why: rg is not guaranteed to be present.
Evidence: web/package.json check:api-client uses grep; project rules say “don’t assume pnpm/rg”.
Log orgId resolution in dev only.
Why: Aids debugging without leaking identity in prod.
Evidence: server/src/middleware/requireAuth.ts:458–459, 711–712; server/src/routes/leads.import.ts:306–308.
Preserve dark/light parity in CSS.
Why: Design system expects both; theme is toggled via html.dark.
Evidence: web/src/styles/neon.css (e.g. html:not(.dark) overrides); web/src/hooks/useTheme.ts:20–24, 54–58 (classList add/remove 'dark' on documentElement).
Keep lead status and deal legal stage enums aligned with docs.
Lead: new → contacted → qualified → offer_made → under_contract → closed (or dead). Deal: PRE_CONTRACT → … → CLOSED.
Evidence: CLAUDE.md:76–80.
3) DANGER ZONES (high risk for prod or cross-tenant bugs)
orgId resolution order differs by route.
Risk: Cross-tenant data or wrong org if a route prioritizes a different source (e.g. header over req.user).
Where: server/src/routes/leads.import.ts:302–303 uses headerOrgId in the chain; other routes use (req as any).orgId || req.user?.orgId || req.user?.id. If frontend sends both Bearer and x-dev-org-id, server uses JWT and ignores header, but any route that ever preferred header over req.orgId would be unsafe.
Evidence: server/src/routes/leads.import.ts:301–303; server/src/routes/leads.dev.ts:23, server/src/routes/tasks.ts:56, server/src/routes/kpis.ts:16.
Frontend sending Authorization when “dev identity” is intended.
Risk: With token in localStorage and FORCE_DEV_IDENTITY not set, frontend sends Bearer; server uses JWT and ignores dev headers, so org/user can diverge from what dev expects.
Where: web/src/api.ts:79 — auth is set when !FORCE_DEV_IDENTITY && token; no logic to suppress Bearer when dev identity is intended.
Evidence: web/src/api.ts:66–81; server/src/middleware/requireAuth.ts:195–196.
Multer has no file size limit.
Risk: Large CSV uploads can cause 413, timeouts, or memory pressure.
Where: server/src/routes/leads.import.ts:12 — multer({ dest: "uploads/" }) only.
Evidence: server/src/routes/leads.import.ts:12; commit uses express.json({ limit: "10mb" }) at 279 but preview does not limit file size.
Two backends in repo (root src/ vs server/).
Risk: Edits in the wrong backend or env (root vs server) break runs or deployments.
Where: Root src/server.ts and server/src/server.ts; CLAUDE.md calls root “Backend” and server “Legacy Server”; server has the full auth/import/KPI/calendar/tasks stack we audited.
Evidence: CLAUDE.md:10–27; server/package.json scripts use dotenv/config and server/.env; root package.json has prisma at root.
Prisma client built without DATABASE_URL guard.
Risk: In prod, if DATABASE_URL is missing at Prisma load time, failures can be opaque.
Where: server/src/db/prisma.ts constructs PrismaClient; env is loaded in server.ts before imports, but Prisma is imported by routes later.
Evidence: server/src/db/prisma.ts:7–12; server/src/server.ts:1–11, 115–119 (DATABASE_URL log).
Conditional JSON body size by path.
Risk: If a new large-payload route is added and not included in the 10mb path, it gets 100kb and can 413.
Where: server/src/server.ts:168–175 — only URLs starting with /api/leads-import get 10mb.
Evidence: server/src/server.ts:166–175.
4) RUN/BUILD CONTRACT
Backend (server/):
Env: server/.env (copy from a .env.example at repo root or server if present). Must include at least DATABASE_URL, PORT (default 3010), JWT_SECRET (≥32 chars in prod).
Load order: Env loaded in server/src/server.ts from server/.env before other imports (server/src/server.ts:1–11).
Commands:
cd server && npm run dev — NODE_ENV=development, DEV_AUTH_BYPASS=1, tsx watch, dotenv/config; port 3010.
cd server && npm run build — tsc; output in server dist.
cd server && npm run start — node dist/server.js.
cd server && npm run prisma:generate — prisma generate --schema prisma/schema.prisma.
Prisma: Schema at server/prisma/schema.prisma; DATABASE_URL from env (server/prisma/schema.prisma:4–6).
Frontend (web/):
Env: web/.env (e.g. from web/.env.example). Must include VITE_API_URL and Firebase VITE_* vars for auth.
Commands:
cd web && npm run dev — Vite dev server, port 5173.
cd web && npm run build — Vite production build.
API: Requests go to /api; Vite proxy sends /api to http://127.0.0.1:3010 (web/vite.config.ts:11–18). No base URL in api.ts (relative /api).
Ports:
Backend: 3010 (or PORT from env).
Frontend: 5173 (web/vite.config.ts:10).
Node: Root package.json specifies engines: "node": ">=18 <20" (package.json:16–18). Server package.json does not set engines; use same range for server to stay consistent.
Package manager: Repo scripts use npm. Use npm if pnpm is not available.
Required binaries: None mandated in package.json. grep used in web check script; rg optional. Prisma CLI used via npx/npm run.
What Claude must do before proposing changes
Identify which backend is in scope — root src/ vs server/ — and which env file applies (server/.env for server).
Confirm orgId derivation — any change to auth or org-scoped routes must keep orgId from requireAuth only ((req as any).orgId / req.user?.orgId) and must not allow unauthenticated or header-only override in production.
Do not change auth semantics — preserve “Authorization Bearer wins; dev bypass only when no Bearer + dev + localhost + DEV_AUTH_BYPASS=1”.
If touching import: ensure upload (multer) and commit (express.json) limits are explicit and consistent; avoid 413 from oversized bodies or files.
If touching frontend API: keep single client in web/src/api.ts; preserve FORCE_DEV_IDENTITY vs Authorization behavior so devs can force dev headers without sending Bearer.
If touching React: keep single root element, no conditional returns that change structure, overlays as siblings with visibility by class/style.
If adding or changing env: document in the same place as other env (e.g. .env.example) and ensure server loads it from server/.env before Prisma/DB.
Verify run contract: after edits, run the relevant dev/build commands (e.g. cd server && npm run dev, cd web && npm run build) and note if pnpm/rg are required or optional.x