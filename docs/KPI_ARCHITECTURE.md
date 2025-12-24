# 📊 DealflowOS KPI Backend Architecture

> Complete technical reference for the KPI, Analytics, and Observability system

---

## 🏗️ Architecture Overview

The KPI system is built on a **multi-layered architecture** that separates concerns across data storage, computation, caching, and presentation layers.

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Real-time + Historical** | Live calculations + daily snapshots |
| **Cache-first** | Redis caching with TTL invalidation |
| **Event-driven** | Lead events trigger KPI recalculation |
| **Multi-tenant** | All queries scoped by `orgId` |
| **Observable** | Health checks, metrics, worker status |

---

## 🗄️ Database Layer

### Core KPI-Related Models

```prisma
// Lead - Primary data source for KPIs
model Lead {
  id                String    @id
  orgId             String    // Multi-tenant isolation
  status            String    // Pipeline stage tracking
  isQualified       Boolean   // Qualification tracking
  arv               Decimal?  // After Repair Value
  moa               Decimal?  // Maximum Offer Amount (auto-calculated)
  offerPrice        Decimal?  // Current offer
  estimatedRepairs  Decimal?  // Repair costs
  dealScore         Int?      // Computed deal quality score
  createdAt         DateTime
  updatedAt         DateTime
  
  events          LeadEvent[]
  deals           Deal[]
  pipelineHistory PipelineHistory[]
}

// LeadEvent - Activity tracking for engagement metrics
model LeadEvent {
  id        String   @id
  leadId    String
  eventType String   // call, sms, email, note, status_changed, etc.
  metadata  Json?    // Enriched context
  createdAt DateTime
}

// Deal - Revenue & profit tracking
model Deal {
  id             String    @id
  orgId          String
  leadId         String
  status         String    // in_progress, closed, cancelled
  salePrice      Decimal?
  assignmentFee  Decimal?
  profit         Decimal?
  closedAt       DateTime?
  createdAt      DateTime
}

// PipelineHistory - Stage transition tracking
model PipelineHistory {
  id        String   @id
  leadId    String
  oldStatus String?
  newStatus String
  changedAt DateTime
}

// KpiSnapshot - Daily aggregated metrics
model KpiSnapshot {
  id                String   @id
  orgId             String
  date              DateTime
  totalLeads        Int
  activeLeads       Int
  qualifiedLeads    Int
  dealsCreated      Int
  dealsClosed       Int
  revenue           Decimal
  profit            Decimal
  contactRate       Decimal?
  qualificationRate Decimal?
  createdAt         DateTime
  
  @@unique([orgId, date])
}
```

### Database Triggers (PostgreSQL)

```sql
-- Auto-calculate MOA on Lead insert/update
CREATE TRIGGER trg_update_moa
BEFORE INSERT OR UPDATE ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION update_moa_trigger();

-- Log pipeline stage changes automatically
CREATE TRIGGER trg_pipeline_history
AFTER UPDATE ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION log_pipeline_change();
```

### Indexes for KPI Queries

```sql
-- Lead indexes
CREATE INDEX idx_lead_orgId ON "Lead"("orgId");
CREATE INDEX idx_lead_status ON "Lead"("status");
CREATE INDEX idx_lead_org_status ON "Lead"("orgId", "status");

-- Event indexes
CREATE INDEX idx_event_leadId ON "LeadEvent"("leadId");
CREATE INDEX idx_event_lead_created ON "LeadEvent"("leadId", "createdAt");

-- Deal indexes
CREATE INDEX idx_deal_orgId ON "Deal"("orgId");
CREATE INDEX idx_deal_org_status ON "Deal"("orgId", "status");

-- Snapshot indexes
CREATE INDEX idx_snapshot_org_date ON "KpiSnapshot"("orgId", "date");
```

---

## 🧮 Services Layer

### KPI Service (`src/services/kpiService.ts`)

The central service for all KPI calculations.

```typescript
export const kpiService = {
  // Core metrics
  getKpis(orgId: string): Promise<KpiData>
  getFullKpiDashboard(orgId: string): Promise<FullKpiData>
  
  // Rate calculations
  getContactRate(orgId: string): Promise<number>
  getQualificationRate(orgId: string): Promise<number>
  getDealCloseRatio(orgId: string): Promise<number>
  
  // Revenue metrics
  getMonthlyRevenue(orgId: string): Promise<number>
  getWeeklyRevenue(orgId: string): Promise<number>
  
  // Time-based metrics
  getAvgTimeInPipeline(orgId: string): Promise<number | null>
  getLeadToContractCycleTime(orgId: string): Promise<number | null>
  
  // Activity metrics
  getDailyActivity(orgId: string): Promise<{ events: number; leadsCreated: number }>
  getAvgOfferToMoaSpread(orgId: string): Promise<number | null>
}
```

**KPI Calculations:**

| Metric | Formula |
|--------|---------|
| **Contact Rate** | `(leads with call/sms/email event) / total leads × 100` |
| **Qualification Rate** | `qualified leads / total leads × 100` |
| **Deal Close Ratio** | `closed deals / total deals × 100` |
| **Avg Pipeline Time** | `AVG(closedAt - createdAt)` for closed leads |
| **MOA Spread** | `AVG(moa - offerPrice)` where both exist |

### Pipeline Service (`src/services/pipelineService.ts`)

Handles pipeline-specific metrics and health scoring.

```typescript
export const pipelineService = {
  // Stage analysis
  getPipelineStats(orgId: string): Promise<StageCount[]>
  getLeadsByStage(orgId: string): Promise<StageCount[]>
  
  // Flow metrics
  getPipelineVelocity(orgId: string): Promise<number | null>
  getStageTransitions(orgId: string): Promise<TransitionCount[]>
  
  // Health scoring
  getHealthScore(orgId: string): Promise<{
    score: number;       // 0-100
    rating: string;      // Excellent, Good, Fair, Needs Attention
    metrics: {
      activeLeads: number;
      stuckLeads: number;
      weeklyActivity: number;
    };
  }>
  
  // Activity feed
  getRecentPipelineActivity(orgId: string, limit: number): Promise<Activity[]>
}
```

**Health Score Algorithm:**

```
Base Score: 50

Active Leads Bonus:
  +15 if >= 10 leads
  +10 if >= 5 leads
  +5  if >= 1 lead

Stuck Leads Penalty (no activity 14+ days):
  +15 if < 10% stuck
  +5  if < 25% stuck
  -5  if 25-50% stuck
  -15 if > 50% stuck

Weekly Activity Bonus:
  +20 if >= 20 events
  +10 if >= 10 events
  +5  if >= 5 events
  -10 if 0 events

Final Score: clamp(0, 100)
```

### Analytics Service (`src/services/analyticsService.ts`)

Event-based analytics and trends.

```typescript
export const analyticsService = {
  // Contact tracking
  getContactRate(orgId: string): Promise<number>
  
  // Event analytics
  getEventActivityCounts(orgId: string, days: number): Promise<EventCounts>
  getCommunicationBreakdown(orgId: string, days: number): Promise<CommBreakdown>
  
  // Trend analysis
  getDailyEventTrend(orgId: string, days: number): Promise<DailyTrend[]>
  
  // Funnel analysis
  getQualificationFunnel(orgId: string): Promise<FunnelStage[]>
}
```

### Lead Score Service (`src/services/leadScoreService.ts`)

Advanced lead scoring with multiple factors.

```typescript
export const leadScoreService = {
  // Individual lead scoring
  calculateFullScore(leadId: string): Promise<{
    totalScore: number;      // 0-100
    engagementScore: number; // Activity-based
    urgencyScore: number;    // Time-based
    dealScore: number;       // Financial metrics
    statusScore: number;     // Pipeline position
    breakdown: Record<string, number>;
    recommendations: string[];
  }>
  
  // Bulk operations
  getTopLeads(orgId: string, limit: number): Promise<Lead[]>
  getLeadsNeedingAttention(orgId: string, limit: number): Promise<Lead[]>
}
```

**Scoring Factors:**

| Category | Factor | Points |
|----------|--------|--------|
| **Engagement** | Per call | +5 |
| | Per SMS | +3 |
| | Per email | +2 |
| | Per note | +1 |
| **Urgency** | Activity < 2 days | +10 |
| | Activity 2-7 days | 0 |
| | Activity 7-14 days | -5 |
| | Activity > 14 days | -15 |
| **Status** | New | 0 |
| | Contacted | +10 |
| | Qualified | +25 |
| | Offer Made | +40 |
| | Under Contract | +60 |
| **Deal** | Offer below MOA | +20 |
| | Per $10k spread | +10 |

---

## ⚡ Caching Layer

### Redis Cache Strategy (`src/cache/kpiCache.ts`)

```typescript
// Cache configuration
const CACHE_TTL = 300; // 5 minutes

// Cache key pattern
const cacheKey = (orgId: string, metric: string) => `kpi:${orgId}:${metric}`;

// Cache wrapper
async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const fresh = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(fresh));
  return fresh;
}

// Invalidation
async function invalidateOrgCache(orgId: string): Promise<void> {
  const keys = await redis.keys(`kpi:${orgId}:*`);
  if (keys.length) await redis.del(...keys);
}
```

### Cache Invalidation Triggers

```typescript
// Invalidate on data changes (src/services/kpiInvalidation.ts)

onLeadCreated(orgId)     → invalidateOrgCache(orgId)
onLeadUpdated(orgId)     → invalidateOrgCache(orgId)
onStatusChanged(orgId)   → invalidateOrgCache(orgId)
onDealCreated(orgId)     → invalidateOrgCache(orgId)
onDealClosed(orgId)      → invalidateOrgCache(orgId)
onEventLogged(orgId)     → invalidateOrgCache(orgId)
```

---

## 🔄 Background Workers

### Worker Schedule (`src/workers/`)

| Worker | Schedule | Purpose |
|--------|----------|---------|
| `kpiWorker` | Every 10 min | Pre-compute KPIs for all orgs |
| `snapshotWorker` | Daily | Create daily KPI snapshots |
| `leadScoreWorker` | Every 5 min | Recalculate lead scores |
| `cleanupWorker` | Hourly | Archive old data, find orphans |

### Snapshot Worker Flow

```
1. Get all organization IDs
2. For each org:
   a. Calculate current KPIs
   b. Upsert into KpiSnapshot table
   c. Use current date as snapshot date
3. Log completion
```

### Worker Status API

```
GET /api/system/workers/status

Response:
{
  "workers": [
    {
      "name": "kpi-recompute",
      "pattern": "*/10 * * * *",
      "isRunning": false,
      "lastRun": "2024-12-05T10:30:00Z",
      "nextRun": "2024-12-05T10:40:00Z",
      "runCount": 42,
      "errorCount": 0
    }
  ],
  "summary": {
    "total": 4,
    "running": 0,
    "healthy": 4,
    "withErrors": 0
  }
}
```

---

## 🌐 API Layer

### KPI Endpoints (`/api/kpis`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/kpis` | GET | Basic KPIs |
| `/api/kpis/full` | GET | Full KPI dashboard |
| `/api/kpis/snapshots?range=30` | GET | Historical snapshots |
| `/api/kpis/pipeline` | GET | Pipeline statistics |
| `/api/kpis/pipeline/summary` | GET | Health + bottleneck |
| `/api/kpis/analytics` | GET | Event analytics |
| `/api/kpis/revenue` | GET | Revenue metrics |

### Response Shapes

**GET /api/kpis/full**
```json
{
  "totalLeads": 150,
  "activeLeads": 45,
  "qualifiedLeads": 28,
  "totalProfit": 125000,
  "totalRevenue": 450000,
  "dealCount": 12,
  "closedDealCount": 8,
  "qualificationRate": 18.67,
  "dealCloseRatio": 66.67,
  "contactRate": 72.5,
  "avgPipelineTime": 14.2,
  "monthlyRevenue": 85000,
  "weeklyRevenue": 22000,
  "dailyActivity": {
    "events": 24,
    "leadsCreated": 5
  },
  "avgOfferSpread": 15000,
  "leadToContractCycleTime": 21.5
}
```

**GET /api/kpis/pipeline/summary**
```json
{
  "stages": [
    { "stage": "new", "count": 25 },
    { "stage": "contacted", "count": 18 },
    { "stage": "qualified", "count": 12 },
    { "stage": "offer_made", "count": 8 },
    { "stage": "under_contract", "count": 3 },
    { "stage": "closed", "count": 42 }
  ],
  "velocity": 48.5,
  "health": {
    "score": 75,
    "rating": "Good",
    "metrics": {
      "activeLeads": 66,
      "stuckLeads": 8,
      "weeklyActivity": 45
    }
  },
  "bottleneck": {
    "stage": "new",
    "count": 25,
    "recommendation": "25 leads stuck in new - consider outreach"
  }
}
```

**GET /api/kpis/snapshots?range=30**
```json
{
  "data": [
    {
      "id": "snap_1",
      "orgId": "org_123",
      "date": "2024-11-05T00:00:00Z",
      "totalLeads": 120,
      "activeLeads": 35,
      "qualifiedLeads": 20,
      "dealsCreated": 2,
      "dealsClosed": 1,
      "revenue": 35000,
      "profit": 12000,
      "contactRate": 68.5,
      "qualificationRate": 16.67
    }
    // ... 29 more days
  ],
  "range": 30,
  "startDate": "2024-11-05T00:00:00Z",
  "endDate": "2024-12-05T00:00:00Z"
}
```

### Dashboard Endpoints (`/api/dashboard`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/digest` | GET | Daily summary for dashboard |
| `/api/dashboard/quick-stats` | GET | Header quick stats |
| `/api/dashboard/notifications` | GET | Alerts & automation logs |

### System Endpoints (`/api/system`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/system/health` | GET | Component health checks |
| `/api/system/metrics` | GET | CPU/memory/queue stats |
| `/api/system/workers/status` | GET | Worker statuses |
| `/api/system/workers/:name/run` | POST | Trigger worker manually |
| `/api/system/stats` | GET | Entity counts |

---

## 🔁 Data Flow

### Real-Time KPI Request Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  API Route  │────▶│    Cache    │
│  (React)    │     │  /api/kpis  │     │   (Redis)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                           ┌───────────────────┤
                           │ Cache Miss        │ Cache Hit
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ KPI Service │     │   Return    │
                    │ (Calculate) │     │   Cached    │
                    └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  PostgreSQL │
                    │   (Query)   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Cache Write │
                    │ (5 min TTL) │
                    └─────────────┘
```

### Event-Driven Invalidation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Lead Update │────▶│   Domain    │────▶│   Cache     │
│   (CRUD)    │     │   Layer     │     │ Invalidate  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Next Request│
                                        │ = Fresh Data│
                                        └─────────────┘
```

### Daily Snapshot Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cron      │────▶│  Snapshot   │────▶│    Get All  │
│ (Daily 0:00)│     │   Worker    │     │    Org IDs  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                           ┌───────────────────┘
                           ▼
                    ┌─────────────┐
                    │ For Each Org│
                    │ Calculate   │
                    │    KPIs     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Upsert    │
                    │ KpiSnapshot │
                    └─────────────┘
```

---

## 📁 File Structure

```
src/
├── routes/
│   ├── kpis-v2.ts           # KPI API endpoints
│   ├── dashboard.ts         # Dashboard digest endpoints
│   └── system.ts            # Health & metrics endpoints
│
├── services/
│   ├── kpiService.ts        # Core KPI calculations
│   ├── pipelineService.ts   # Pipeline metrics & health
│   ├── analyticsService.ts  # Event analytics
│   ├── leadScoreService.ts  # Lead scoring engine
│   ├── kpiInvalidation.ts   # Cache invalidation triggers
│   └── eventEnricher.ts     # Event context enrichment
│
├── cache/
│   └── kpiCache.ts          # Redis caching utilities
│
├── workers/
│   ├── index.ts             # Worker manager
│   ├── scheduler.ts         # Cron-like scheduler
│   ├── kpiWorker.ts         # KPI precomputation
│   ├── snapshotWorker.ts    # Daily snapshots
│   ├── leadScoreWorker.ts   # Score recalculation
│   └── cleanupWorker.ts     # Data retention
│
├── domain/
│   ├── leads.ts             # Lead business logic
│   ├── deals.ts             # Deal business logic
│   └── pipeline.ts          # Pipeline business logic
│
├── lib/
│   ├── formulas.ts          # MOA, deal score calculations
│   └── prisma.ts            # Prisma client
│
└── validation/
    ├── dto.ts               # TypeScript types from Zod
    └── schemas.ts           # Zod validation schemas
```

---

## 📊 Visual Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                           DealflowOS KPI Architecture                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │                         🖥️  FRONTEND LAYER                              │  ║
║  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  ║
║  │  │ KpiOverview  │  │ PipelineCard │  │  KpiChart    │  │ Diagnostics│  │  ║
║  │  │   (cards)    │  │  (stages)    │  │  (trends)    │  │  (system)  │  │  ║
║  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │  ║
║  │         │                 │                 │                │         │  ║
║  │         └────────────────┬┴─────────────────┴────────────────┘         │  ║
║  │                          │                                              │  ║
║  │                   ┌──────▼──────┐                                       │  ║
║  │                   │ React Query │  (useKpis, usePipelineSummary, etc.)  │  ║
║  │                   │    Hooks    │  Auto-refresh: 5s - 60s               │  ║
║  │                   └──────┬──────┘                                       │  ║
║  └──────────────────────────┼──────────────────────────────────────────────┘  ║
║                             │                                                 ║
║  ════════════════════════════════════════════════════════════════════════════ ║
║                             │  HTTP / REST                                    ║
║  ════════════════════════════════════════════════════════════════════════════ ║
║                             │                                                 ║
║  ┌──────────────────────────▼──────────────────────────────────────────────┐  ║
║  │                          🌐 API LAYER                                    │  ║
║  │                                                                          │  ║
║  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  ║
║  │   │ /api/kpis/* │  │/api/dashboard│ │ /api/leads/ │  │ /api/system │    │  ║
║  │   │             │  │   /digest   │  │   :id/score │  │  /metrics   │    │  ║
║  │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │  ║
║  │          │                │                │                │           │  ║
║  └──────────┼────────────────┼────────────────┼────────────────┼───────────┘  ║
║             │                │                │                │              ║
║  ┌──────────▼────────────────▼────────────────▼────────────────▼───────────┐  ║
║  │                        ⚡ CACHE LAYER (Redis)                            │  ║
║  │                                                                          │  ║
║  │    ┌─────────────────────────────────────────────────────────────┐      │  ║
║  │    │  kpi:{orgId}:full    │  kpi:{orgId}:pipeline  │  TTL: 5min  │      │  ║
║  │    └─────────────────────────────────────────────────────────────┘      │  ║
║  │                                    │                                     │  ║
║  │                         Cache Miss │ Cache Hit → Return                  │  ║
║  └────────────────────────────────────┼─────────────────────────────────────┘  ║
║                                       │                                        ║
║  ┌────────────────────────────────────▼─────────────────────────────────────┐  ║
║  │                        🧮 SERVICE LAYER                                   │  ║
║  │                                                                           │  ║
║  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │  ║
║  │  │   kpiService    │  │ pipelineService │  │ leadScoreService│           │  ║
║  │  │                 │  │                 │  │                 │           │  ║
║  │  │ • getKpis()     │  │ • getByStage()  │  │ • calcScore()   │           │  ║
║  │  │ • getRates()    │  │ • getHealth()   │  │ • getTop()      │           │  ║
║  │  │ • getRevenue()  │  │ • getVelocity() │  │ • getStale()    │           │  ║
║  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │  ║
║  │           │                    │                    │                    │  ║
║  │  ┌────────▼────────────────────▼────────────────────▼────────┐           │  ║
║  │  │              analyticsService  •  eventEnricher            │           │  ║
║  │  └───────────────────────────────────────────────────────────┘           │  ║
║  └───────────────────────────────────┬───────────────────────────────────────┘  ║
║                                      │                                         ║
║  ┌───────────────────────────────────▼───────────────────────────────────────┐  ║
║  │                         🗄️ DATABASE LAYER (PostgreSQL)                     │  ║
║  │                                                                            │  ║
║  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐       │  ║
║  │  │    Lead    │  │  LeadEvent │  │    Deal    │  │ PipelineHistory│       │  ║
║  │  │            │  │            │  │            │  │                │       │  ║
║  │  │ • status   │  │ • eventType│  │ • profit   │  │ • oldStatus    │       │  ║
║  │  │ • arv/moa  │  │ • metadata │  │ • closedAt │  │ • newStatus    │       │  ║
║  │  │ • qualified│  │ • createdAt│  │ • status   │  │ • changedAt    │       │  ║
║  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────┬───────┘       │  ║
║  │        │               │               │                  │               │  ║
║  │        └───────────────┴───────┬───────┴──────────────────┘               │  ║
║  │                                │                                          │  ║
║  │                     ┌──────────▼──────────┐                               │  ║
║  │                     │    KpiSnapshot      │  ← Daily Aggregates           │  ║
║  │                     │  (Historical Data)  │                               │  ║
║  │                     └────────────────────┘                               │  ║
║  │                                                                           │  ║
║  │  ┌────────────────────────────────────────────────────────────────┐      │  ║
║  │  │  TRIGGERS:  trg_update_moa  │  trg_pipeline_history            │      │  ║
║  │  └────────────────────────────────────────────────────────────────┘      │  ║
║  └───────────────────────────────────────────────────────────────────────────┘  ║
║                                                                               ║
║  ┌───────────────────────────────────────────────────────────────────────────┐  ║
║  │                         ⚙️ BACKGROUND WORKERS                              │  ║
║  │                                                                            │  ║
║  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  ║
║  │   │ kpiWorker    │  │snapshotWorker│  │scoreWorker   │  │cleanupWorker │  │  ║
║  │   │ */10 min     │  │ Daily 0:00   │  │ */5 min      │  │ Hourly       │  │  ║
║  │   │              │  │              │  │              │  │              │  │  ║
║  │   │ Precompute   │  │ Create daily │  │ Recalc lead  │  │ Archive old  │  │  ║
║  │   │ KPIs → Cache │  │ snapshots    │  │ scores       │  │ data         │  │  ║
║  │   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │  ║
║  └───────────────────────────────────────────────────────────────────────────┘  ║
║                                                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝


                              DATA FLOW LEGEND
                              ════════════════

    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Request │────────▶│  Cache  │────────▶│ Response│
    └─────────┘  HIT    └─────────┘         └─────────┘
                           │
                      MISS │
                           ▼
                     ┌─────────┐
                     │ Service │
                     │  Query  │
                     └────┬────┘
                          │
                          ▼
                     ┌─────────┐
                     │   DB    │
                     └────┬────┘
                          │
                          ▼
                     ┌─────────┐
                     │  Cache  │───────▶ Next request = instant
                     │  Write  │
                     └─────────┘


                         INVALIDATION FLOW
                         ═════════════════

    ┌───────────────┐
    │ Lead Created  │──┐
    │ Lead Updated  │  │
    │ Deal Closed   │  │       ┌─────────────────┐
    │ Status Change │──┼──────▶│ invalidateCache │──────▶ Cache cleared
    │ Event Logged  │  │       │   (orgId)       │        Next request
    └───────────────┘──┘       └─────────────────┘        recalculates
```

---

## 🎯 Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API Layer** | Express.js | REST endpoints |
| **Cache Layer** | Redis | 5-min TTL caching |
| **Service Layer** | TypeScript | Business logic |
| **Database** | PostgreSQL + Prisma | Data persistence |
| **Workers** | Node.js + Scheduler | Background jobs |
| **Frontend** | React + React Query | Auto-refreshing UI |

**Key Metrics Tracked:**
- Lead counts (total, active, qualified)
- Revenue (monthly, weekly, total)
- Rates (contact, qualification, close)
- Pipeline (velocity, health, bottlenecks)
- Activity (daily events, engagement)
- Scores (lead scoring, deal quality)

---

*Last Updated: December 2024 | DealflowOS v1.0*








