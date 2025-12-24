# Legal Workflow System Implementation Plan

## Repository Analysis Summary

### Backend Structure
- **Active Backend**: `server/src/server.ts` (Express server)
- **Alternative Backend**: `src/` (more complex structure with domain services)
- **Database**: Prisma ORM with PostgreSQL (`prisma/schema.prisma`)
- **Auth Pattern**: `req.auth` with `{ userId, email, orgId }` from middleware (`src/auth/auth.ts`)
- **Dev Auth**: Headers `x-dev-user-id`, `x-dev-org-id`, `x-dev-user-email` (`src/middleware/devAuth.ts`)

### Existing Patterns
- **Deal Domain**: `src/domain/deals.ts` - transaction-safe operations, uses `LeadEvent` for logging
- **Deal Routes**: `src/routes/deals.ts` - org-scoped, uses validation middleware
- **Event Pattern**: `LeadEvent` model exists for immutable event logging (perfect template)
- **Validation**: Zod schemas in `src/validation/schemas.ts`
- **API Client**: `web/src/api.ts` - uses `/api` prefix, token-based auth

### Frontend Structure
- **Framework**: React + TypeScript, React Router
- **Pages**: `web/src/pages/` - no existing Deal detail page found
- **Components**: `web/src/components/` - uses neon glass styling
- **Routing**: `web/src/main.tsx` - React Router v6

## Implementation Plan

### Phase 1: Database Schema (Prisma)

#### 1.1 Add Legal Stage to Deal Model
**File**: `prisma/schema.prisma`

Add `legalStage` field to `Deal` model:
```prisma
model Deal {
  // ... existing fields
  legalStage LegalStage @default(PRE_CONTRACT)
  // ... rest of model
}
```

#### 1.2 Create LegalStage Enum
**File**: `prisma/schema.prisma`

```prisma
enum LegalStage {
  PRE_CONTRACT
  UNDER_CONTRACT
  ASSIGNMENT_IN_PROGRESS
  ASSIGNED
  TITLE_CLEARING
  CLEARED_TO_CLOSE
  CLOSED
  DEAD
}
```

#### 1.3 Create Legal Metadata Models
**File**: `prisma/schema.prisma`

```prisma
model ContractMetadata {
  id          String   @id @default(cuid())
  dealId      String   @unique
  sellerName  String?
  buyerName   String?
  contractPrice Decimal? @db.Decimal(12, 2)
  contractDate DateTime?
  externalUrl String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deal        Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
}

model AssignmentMetadata {
  id          String   @id @default(cuid())
  dealId      String   @unique
  endBuyerName String?
  assignmentFee Decimal? @db.Decimal(12, 2)
  assignmentDate DateTime?
  externalUrl String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deal        Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
}

model TitleMetadata {
  id          String   @id @default(cuid())
  dealId      String   @unique
  titleCompany String?
  escrowOfficer String?
  escrowNumber  String?
  expectedCloseDate DateTime?
  externalUrl String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deal        Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
}
```

#### 1.4 Add Relations to Deal Model
**File**: `prisma/schema.prisma`

```prisma
model Deal {
  // ... existing fields
  legalStage         LegalStage
  contractMetadata   ContractMetadata?
  assignmentMetadata AssignmentMetadata?
  titleMetadata      TitleMetadata?
  legalEvents        DealEvent[]
  // ... rest of model
}
```

#### 1.5 Create DealEvent Model (Following LeadEvent Pattern)
**File**: `prisma/schema.prisma`

```prisma
model DealEvent {
  id        String   @id @default(cuid())
  dealId    String
  eventType String   // "stage_transition", "metadata_updated", "deadline_missed", etc.
  metadata  Json?
  createdAt DateTime @default(now())
  deal      Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([dealId, eventType])
  @@index([dealId, createdAt])
}
```

#### 1.6 Create JurisdictionProfile Model (Configuration)
**File**: `prisma/schema.prisma`

```prisma
model JurisdictionProfile {
  id                String   @id @default(cuid())
  state             String   // "TX", "FL", etc.
  county            String?  // Optional county-level rules
  profileVersion    String   @default("1.0")
  requiredFields    Json     // Stage -> required fields mapping
  timingRules       Json?    // Deadline expectations
  featureFlags      Json?    // e.g., { "assignmentAllowed": true }
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([state, county, profileVersion])
  @@index([state])
}
```

#### 1.7 Create LegalAcknowledgement Model
**File**: `prisma/schema.prisma`

```prisma
model LegalAcknowledgement {
  id        String   @id @default(cuid())
  userId    String
  orgId     String
  ackType   String   // "legal_hub_access", "disclaimer", etc.
  acknowledgedAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  org       Organization @relation(fields: [orgId], references: [id])

  @@unique([userId, orgId, ackType])
}
```

Add relations to `User` and `Organization` models.

#### 1.8 Generate Migration
Run `npx prisma migrate dev --name add_legal_workflow` after schema changes.

### Phase 2: Backend Domain Service

#### 2.1 Create Legal Domain Service
**File**: `src/domain/legal.ts`

Create `LegalDomain` class following `DealDomain` pattern:
- `validateStageTransition(dealId, newStage, jurisdiction)` - validates transitions
- `advanceStage(dealId, newStage, userId)` - transitions with validation and event logging
- `updateContractMetadata(dealId, data)` - updates contract metadata
- `updateAssignmentMetadata(dealId, data)` - updates assignment metadata
- `updateTitleMetadata(dealId, data)` - updates title metadata
- `getLegalState(dealId)` - returns complete legal state
- `getBlockers(dealId, jurisdiction)` - returns blockers for current stage
- `emitEvent(dealId, eventType, metadata)` - creates DealEvent

Use transaction safety pattern from `DealDomain.create()`.

#### 2.2 Create Jurisdiction Service
**File**: `src/services/jurisdictionService.ts`

- `getJurisdictionProfile(state, county?)` - loads profile from DB
- `validateRequiredFields(stage, metadata, profile)` - checks required fields
- `getTimingRules(stage, profile)` - returns deadline expectations
- `checkFeatureFlags(flag, profile)` - checks if feature enabled

### Phase 3: Backend Routes

#### 3.1 Create Legal Routes
**File**: `src/routes/legal.ts`

Following pattern from `src/routes/deals.ts`:

```typescript
// GET /api/deals/:dealId/legal - Get legal state
// PATCH /api/deals/:dealId/legal/stage - Advance stage
// PUT /api/deals/:dealId/legal/contract - Update contract metadata
// PUT /api/deals/:dealId/legal/assignment - Update assignment metadata
// PUT /api/deals/:dealId/legal/title - Update title metadata
// GET /api/deals/:dealId/legal/events - Get legal events
// GET /api/deals/:dealId/legal/blockers - Get blockers
```

Use:
- `validate` middleware for request validation
- `asyncHandler` for error handling
- `req.auth!` for org/user scoping
- Zod schemas for validation

#### 3.2 Create Validation Schemas
**File**: `src/validation/legalSchemas.ts`

Zod schemas for:
- Stage transition requests
- Contract metadata updates
- Assignment metadata updates
- Title metadata updates

#### 3.3 Register Routes
**File**: `src/app.ts` or `server/src/server.ts` (whichever is active)

Add: `app.use("/api/deals", dealsRouter)` (if not already present)
Add: `app.use("/api/deals/:dealId/legal", legalRouter)` (nested under deals)

### Phase 4: Frontend Legal Hub

#### 4.1 Create Deal Detail Page (if missing)
**File**: `web/src/pages/DealPage.tsx`

If no deal detail page exists, create one following `LeadsPage.tsx` pattern:
- Route: `/deals/:dealId`
- Fetches deal data from `/api/deals/:dealId`
- Displays deal info and Legal Hub component

#### 4.2 Create Legal Hub Component
**File**: `web/src/components/legal/LegalHub.tsx`

Main component displaying:
- Current legal stage (badge/indicator)
- Stage progression timeline
- Metadata panels (Contract, Assignment, Title)
- Blockers/warnings section
- "Advance Stage" button (with validation)
- Legal events timeline

#### 4.3 Create Legal Stage Indicator
**File**: `web/src/components/legal/LegalStageIndicator.tsx`

Visual indicator showing current stage and available transitions.

#### 4.4 Create Metadata Panels
**Files**:
- `web/src/components/legal/ContractMetadataPanel.tsx`
- `web/src/components/legal/AssignmentMetadataPanel.tsx`
- `web/src/components/legal/TitleMetadataPanel.tsx`

Each panel:
- Displays current metadata
- Edit mode for updating
- External URL field (optional)
- Save button

#### 4.5 Create Legal Events Timeline
**File**: `web/src/components/legal/LegalEventsTimeline.tsx`

Displays `DealEvent` records in chronological order, similar to audit log.

#### 4.6 Create Stage Transition Modal
**File**: `web/src/components/legal/StageTransitionModal.tsx`

Modal for advancing stages:
- Shows current stage → target stage
- Lists blockers (if any)
- Requires confirmation
- Shows validation errors

#### 4.7 Add API Client Methods
**File**: `web/src/api.ts`

Add helper functions:
```typescript
export function getDealLegal(dealId: string)
export function advanceLegalStage(dealId: string, stage: string)
export function updateContractMetadata(dealId: string, data: ContractMetadata)
export function updateAssignmentMetadata(dealId: string, data: AssignmentMetadata)
export function updateTitleMetadata(dealId: string, data: TitleMetadata)
export function getLegalEvents(dealId: string)
export function getLegalBlockers(dealId: string)
```

### Phase 5: Migration & Data

#### 5.1 Migration Script
**File**: `scripts/migrate-legal-stages.ts`

Script to:
- Set default `legalStage = PRE_CONTRACT` for all existing deals
- Create initial `DealEvent` for each deal: `{ eventType: "initialized", metadata: { stage: "PRE_CONTRACT" } }`

#### 5.2 Seed Jurisdiction Profiles
**File**: `prisma/seed.ts` or new seed file

Seed common jurisdiction profiles (TX, FL, CA, etc.) with:
- Required fields per stage
- Timing rules
- Feature flags

### Phase 6: Testing & Validation

#### 6.1 Backend Tests
- Test stage transitions (valid/invalid)
- Test metadata updates
- Test event emission
- Test jurisdiction validation

#### 6.2 Frontend Integration
- Test Legal Hub renders in Deal view
- Test stage advancement flow
- Test metadata editing
- Test blocker display

## Implementation Order

1. **Database Schema** (Phase 1) - Foundation
2. **Backend Domain Service** (Phase 2) - Core logic
3. **Backend Routes** (Phase 3) - API layer
4. **Frontend Components** (Phase 4) - UI layer
5. **Migration & Seeding** (Phase 5) - Data setup
6. **Testing** (Phase 6) - Validation

## Key Design Decisions

1. **Nested Routes**: Legal routes nested under `/api/deals/:dealId/legal` to maintain deal context
2. **Event Pattern**: Reuse `LeadEvent` pattern for `DealEvent` - proven immutable event logging
3. **Transaction Safety**: All legal operations use Prisma transactions (like `DealDomain`)
4. **Jurisdiction Config**: Stored in DB as JSON for flexibility, versioned for changes
5. **No File Storage**: Only external URLs allowed, no uploads or file management
6. **State Machine**: Explicit transitions only, no implicit state changes

## Files to Create

**Backend:**
- `src/domain/legal.ts`
- `src/services/jurisdictionService.ts`
- `src/routes/legal.ts`
- `src/validation/legalSchemas.ts`

**Frontend:**
- `web/src/pages/DealPage.tsx` (if missing)
- `web/src/components/legal/LegalHub.tsx`
- `web/src/components/legal/LegalStageIndicator.tsx`
- `web/src/components/legal/ContractMetadataPanel.tsx`
- `web/src/components/legal/AssignmentMetadataPanel.tsx`
- `web/src/components/legal/TitleMetadataPanel.tsx`
- `web/src/components/legal/LegalEventsTimeline.tsx`
- `web/src/components/legal/StageTransitionModal.tsx`

**Database:**
- Migration file (auto-generated)
- Seed data for jurisdictions

## Files to Modify

**Backend:**
- `prisma/schema.prisma` - Add models and enums
- `src/app.ts` or `server/src/server.ts` - Register legal routes

**Frontend:**
- `web/src/main.tsx` - Add Deal detail route
- `web/src/api.ts` - Add legal API methods

## Guardrails

- Do NOT touch: Leads, Tasks, KPIs, Calendar, Auth, Billing routes
- Do NOT add file upload functionality
- Do NOT create document storage tables
- Do NOT refactor existing Deal domain (only extend)
- Follow existing patterns: transaction safety, event logging, org scoping

## TODO Items

1. Add LegalStage enum and legalStage field to Deal model in prisma/schema.prisma
2. Create ContractMetadata, AssignmentMetadata, TitleMetadata models in prisma/schema.prisma
3. Create DealEvent model following LeadEvent pattern in prisma/schema.prisma
4. Create JurisdictionProfile and LegalAcknowledgement models in prisma/schema.prisma
5. Generate and run Prisma migration for legal workflow schema changes
6. Create LegalDomain service class in src/domain/legal.ts with stage transition, metadata update, and event emission methods
7. Create JurisdictionService in src/services/jurisdictionService.ts for profile loading and validation
8. Create Zod validation schemas in src/validation/legalSchemas.ts for legal API requests
9. Create legal routes in src/routes/legal.ts with nested /api/deals/:dealId/legal endpoints
10. Register legal routes in main server file (src/app.ts or server/src/server.ts)
11. Create DealPage.tsx in web/src/pages/ if missing, or identify existing deal view location
12. Create LegalHub.tsx main component in web/src/components/legal/ with stage indicator, metadata panels, and events timeline
13. Create ContractMetadataPanel, AssignmentMetadataPanel, TitleMetadataPanel components
14. Create StageTransitionModal component for advancing legal stages with validation
15. Add legal API client methods to web/src/api.ts for all legal endpoints
16. Create migration script to set default legalStage for existing deals and create initial events
17. Seed common jurisdiction profiles (TX, FL, CA, etc.) with required fields and timing rules



