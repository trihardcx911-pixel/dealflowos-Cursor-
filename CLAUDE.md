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

## Project Boundaries (Non-Negotiable)

### 1. React/JSX Structural Guardrails
These rules prevent UI rendering bugs and structural drift:

- **Single root element**: Every component return must have exactly one root element
- **No React fragments**: Never use `<>...</>` or `<Fragment>`. Use a proper wrapper div/element
- **No conditional returns**: Never use early `return null` or `if (...) return` patterns that change the structural tree. Control visibility via CSS/props instead
- **Fullscreen overlays**: Must be rendered unconditionally as siblings, visibility controlled via CSS/props only
- **No structural drift**: Do not reorder root layout wrappers unless explicitly requested

### 2. Auth + Multi-Tenant OrgId
These rules prevent security and data isolation bugs:

- **Never invent orgId patterns**: Always use the project's existing helper/middleware for orgId derivation
- **No `(req as any).orgId`**: This pattern bypasses type safety and has caused bugs
- **Dev headers are dev-only**: Never allow `x-dev-user-id` or `x-dev-org-id` headers to override JWT scoping in production code paths
- **DEV_BYPASS scope**: Any `DEV_BYPASS` logic must be explicitly gated by `NODE_ENV=development`

### 3. Environment Files
These rules prevent configuration drift:

- **Single source**: `server/.env` is the authoritative env source for backend
- **No prisma/.env**: Prisma should read from `server/.env` or use `--schema` flag
- **No duplicate .env files**: Don't create new .env files outside established locations (`server/.env`, `web/.env`)

### 4. Tooling Reality
These rules ensure commands work across environments:

- **Don't assume pnpm**: Always provide `npm` fallback or use `npm` by default
- **Don't assume rg (ripgrep)**: Use `grep` as primary, `rg` as optimization
- **Exact commands**: When providing terminal commands, give exact copy-paste-ready commands

## Workflow & Constraints

### Claude Code Hooks
This repo uses Claude Code hooks (`.claude/settings.json`):
- **SessionStart**: Read CLAUDE.md + PROGRESS.md + guardrails + sanity reports
- **PostToolUse (Write/Edit)**: Runs lint/typecheck, guardrails scan, sanity check
- **PreCompact**: Appends compaction summary to PROGRESS.md
- **Stop**: Blocks only if NEW guardrail violations exist (not legacy)

### Tier 2 Guardrails Scanner
The guardrails scanner uses a **baseline delta** system:
- `.claude/state/guardrails_baseline.txt`: Known pre-existing violations (ignored)
- `.claude/state/guardrails_status.txt`: `OK` or `VIOLATIONS_NEW`
- `.claude/state/guardrails_last.txt`: Full report with delta

**Checks performed**:
- React: fragments, conditional returns, early returns
- Env: files outside `server/.env` and `web/.env`
- OrgId: `(req as any).orgId`, inline header access, ungated dev headers
- Import safety: `leads.import.ts` must have fileSize and row limits

**OrgId helper**: Use `getOrgId(req)` from `src/middleware/getOrgId.ts` instead of inline patterns.

**Baseline management**:
```bash
# Regenerate baseline (captures current state as "known")
CLAUDE_PROJECT_DIR="$(pwd)" ./.claude/hooks/guardrails-baseline.sh
```

### Sanity Check
The sanity check (`.claude/hooks/dfos-sanity.sh`) warns about:
- New .env files outside authorized locations
- Missing `server/.env` in dev
- Tooling availability (pnpm, rg)

### Hard Constraints
- Do NOT run destructive commands (`rm -rf`, delete directories, modify git history)
- Do NOT edit `server/` or `dealflow-frontend/` (legacy, deprecated)
- Make changes in small, reviewable steps
- All hooks fail-open (exit 0) to never block work
