# KPI Semantic Colors Implementation Plan
## Green/Neutral/Red Delta System with Durable Baseline Math

---

## OBJECTIVE

Implement a consistent "semantic color" system for dashboard KPI tiles where the *primary value* turns:
- **GREEN** when performance is positive vs baseline
- **RED** when performance is negative vs baseline  
- **NEUTRAL** when baseline is missing/unknown or delta is 0

This uses a single, auditable "math system" with minimal code surface area, without breaking i18n, existing KPI counts, or the canonical API identity architecture.

---

## HARD GUARDRAILS

- **No new dependencies, no new CSS files, no neon.css edits unless absolutely required**
- **Do NOT regress identity unification**: all calls must remain on canonical `web/src/api.ts` + existing hooks
- **Keep query key stability**: `["kpis-summary"]` stays the single source of truth
- **Maintain i18n**: all labels must use translation keys (EN/ES/PT)

---

## PHASE 0 — CURRENT TRUTH (Inventory + Evidence)

### File Map

| File | Purpose | Key Sections |
|------|---------|--------------|
| `web/src/components/KpiCard.tsx` | Dashboard KPI card component | Lines 16-58: Renders 4 KpiTile components |
| `web/src/components/KpiTile.tsx` | Individual KPI tile component | Lines 1-24: Displays label, value, optional delta |
| `web/src/api/hooks.ts` | React Query hooks | Lines 128-150: `KpiSummary` interface + `useKpisSummary()` hook |
| `server/src/routes/kpis.ts` | Backend KPI endpoint | Lines 9-195: GET `/api/kpis` handler (dev + prod branches) |
| `web/src/api.ts` | Canonical API client | Lines 51-82: `resolveUrl()` + `get()` function |

### Current KPI Tile Inventory

| Tile Label | Current Field | Backend Definition | Current Formatting | Current Color Class | Current Delta |
|------------|---------------|-------------------|-------------------|-------------------|---------------|
| **Active Leads** | `data?.activeLeads` | Count of non-archived leads (equals `totalLeads` if no archived field) | `String(data?.activeLeads ?? 0)` | `text-[#ff0a45]` (hardcoded red) | `data?.monthlyQualifiedLeads` (misused: shows qualified leads, not period-over-period) |
| **Conversion Rate** | `data?.conversionRate` | `(closedWonDeals / totalLeads) * 100` | `${Number(data?.conversionRate ?? 0).toFixed(1)}%` | `text-[#ff0a45]` (hardcoded red) | None |
| **New Leads (MTD)** | `data?.monthlyNewLeads` | Count of leads created this month (UTC boundaries) | `String(data?.monthlyNewLeads ?? 0)` | `text-[#ff0a45]` (hardcoded red) | None |
| **Total Revenue** | N/A | Not implemented (hardcoded "—") | `"—"` (hardcoded) | `text-[#ff0a45]` (hardcoded red) | None |

### Current Backend Response Shape

**File**: `server/src/routes/kpis.ts:184-195`

```typescript
res.json({
  totalLeads: number,
  activeLeads: number,
  conversionRate: number,
  assignments: number,
  contractsInEscrow: number,
  contactRate: number,
  monthlyNewLeads: number,
  monthlyProfit: number,
  qualifiedLeads: number,
  monthlyQualifiedLeads: number,
});
```

### Current Frontend Contract

**File**: `web/src/api/hooks.ts:128-139`

```typescript
export interface KpiSummary {
  totalLeads: number;
  activeLeads: number;
  conversionRate: number;
  assignments: number;
  contractsInEscrow: number;
  contactRate: number;
  monthlyNewLeads: number;
  monthlyProfit: number;
  qualifiedLeads: number;
  monthlyQualifiedLeads: number;
}
```

### Current API Client Usage

**File**: `web/src/api/hooks.ts:145-150`

- Query key: `["kpis-summary"]` (single source of truth)
- Endpoint: `"/api/kpis"` (via `get<KpiSummary>("/api/kpis")`)
- Client: Canonical `get()` from `web/src/api.ts` (respects identity unification)

### Current Issues Identified

1. **Active Leads delta is misused**: Shows `monthlyQualifiedLeads` (qualified deals this month) instead of period-over-period active leads change
2. **No previous-period data**: Backend computes only current month values
3. **All tiles use red**: No semantic color differentiation
4. **Hardcoded labels**: "New Leads (MTD)" and "Total Revenue" are not i18n keys
5. **Total Revenue not implemented**: Hardcoded "—" value

---

## PHASE 1 — DEFINE THE MATH SYSTEM (Non-negotiable Spec)

### A) Baseline Policy (v1 Default)

**Policy**: Previous period comparison (period-over-period)

- **For MTD metrics**: Compare Month-To-Date vs *previous month same-to-date* (MTD vs prev MTD)
  - Example: If today is Jan 15, compare Jan 1–15 vs Dec 1–15
- **For non-MTD metrics**: Compare current month vs previous month (MoM)
- **Timezone**: UTC boundaries (matches existing `monthlyNewLeads` logic)

### B) Polarity Map (Higher-is-Better vs Lower-is-Better)

| KPI Tile | Polarity | Rationale |
|----------|----------|-----------|
| **Active Leads** | Higher is better | More active leads = better pipeline |
| **Conversion Rate** | Higher is better | Higher conversion = better performance |
| **New Leads (MTD)** | Higher is better | More new leads = better growth |
| **Total Revenue** | Higher is better | More revenue = better performance |

**Future-proofing**: Plan includes a `polarity` field in tone computation to support "lower is better" metrics (e.g., "Days to Close", "Churn Rate") in the future.

### C) Delta Rules (Strict Specification)

#### Delta Computation

```typescript
// For counts and absolute values
delta = current - baseline

// For rates (percentage points)
delta_pp = current_rate - baseline_rate
```

#### Tone Computation Rules

```typescript
function computeTone(
  current: number | null | undefined,
  baseline: number | null | undefined,
  polarity: "higher" | "lower" = "higher"
): "positive" | "negative" | "neutral" {
  // Rule 1: Missing baseline => neutral
  if (baseline === null || baseline === undefined) return "neutral";
  
  // Rule 2: Missing current => neutral
  if (current === null || current === undefined) return "neutral";
  
  // Rule 3: NaN/Infinity => neutral
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return "neutral";
  
  // Rule 4: Compute delta
  const delta = current - baseline;
  
  // Rule 5: Zero delta => neutral
  if (delta === 0) return "neutral";
  
  // Rule 6: Apply polarity
  if (polarity === "higher") {
    return delta > 0 ? "positive" : "negative";
  } else {
    // polarity === "lower"
    return delta < 0 ? "positive" : "negative";
  }
}
```

### D) Period Windows (UTC)

#### Current Month (UTC)

```typescript
const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth();
const monthStart = new Date(Date.UTC(year, month, 1));
const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));
```

#### Previous Month (UTC)

```typescript
const prevYear = month === 0 ? year - 1 : year;
const prevMonth = month === 0 ? 11 : month - 1;
const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth, 1));
const prevNextMonthStart = new Date(Date.UTC(prevYear, prevMonth + 1, 1));
```

#### Same-to-Date Rule (for MTD metrics)

```typescript
const dayOfMonth = now.getUTCDate();
const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0)); // Last day of prev month
const prevMonthMaxDay = prevMonthEnd.getUTCDate();
const prevMonthSameToDateEnd = new Date(Date.UTC(prevYear, prevMonth, Math.min(dayOfMonth, prevMonthMaxDay), 23, 59, 59, 999));
```

**Clamping logic**: If current month is day 31 but previous month has only 30 days, compare to day 30 of previous month.

### E) Tone Computation Function Signature

```typescript
/**
 * Computes semantic tone (positive/negative/neutral) from current and baseline values
 * @param current - Current period value
 * @param baseline - Previous period value (null if unavailable)
 * @param polarity - Whether higher is better ("higher") or lower is better ("lower")
 * @returns "positive" | "negative" | "neutral"
 */
function computeTone(
  current: number | null | undefined,
  baseline: number | null | undefined,
  polarity: "higher" | "lower" = "higher"
): "positive" | "negative" | "neutral"
```

---

## PHASE 2 — DATA REQUIREMENTS + BACKEND CONTRACT

### Preferred Approach: Option A (Baseline Fields)

**Rationale**: 
- More auditable (frontend can verify math)
- UI-agnostic (backend doesn't know about colors)
- Easier to test (can verify baseline values independently)

### Required Backend Fields

Add to `/api/kpis` response:

| Field Name | Type | Definition | Edge Cases |
|------------|------|------------|------------|
| `prevActiveLeads` | `number \| null` | Active leads count at end of previous month | `null` if no previous month data |
| `prevConversionRate` | `number \| null` | Conversion rate for previous month (same formula as current) | `null` if no previous month data or `totalLeads === 0` in prev month |
| `prevMonthlyNewLeadsMTD` | `number \| null` | New leads for previous month (same-to-date, clamped to month length) | `null` if no previous month data |
| `prevMonthlyProfit` | `number \| null` | Monthly profit for previous month | `null` if no previous month data or revenue not implemented |

### Backend Implementation Approach

#### Dev Mode (`server/src/routes/kpis.ts:40-108`)

**Current month calculation** (already exists):
- Uses `monthStart` and `nextMonthStart` (UTC)
- Filters leads/deals by date ranges

**Previous month calculation** (to add):
```typescript
// Compute previous month boundaries (UTC)
const prevYear = month === 0 ? year - 1 : year;
const prevMonth = month === 0 ? 11 : month - 1;
const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth, 1));
const prevNextMonthStart = new Date(Date.UTC(prevYear, prevMonth + 1, 1));

// prevActiveLeads: count at end of previous month
// (Use leads that existed before prevNextMonthStart)
const prevActiveLeads = leads.filter((l: any) => {
  if (!l.createdAt) return false;
  const createdTime = Date.parse(l.createdAt);
  return Number.isFinite(createdTime) && createdTime < prevNextMonthStart.getTime();
}).length;

// prevMonthlyNewLeadsMTD: same-to-date comparison
const dayOfMonth = now.getUTCDate();
const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0));
const prevMonthMaxDay = prevMonthEnd.getUTCDate();
const prevMonthSameToDateEnd = new Date(Date.UTC(prevYear, prevMonth, Math.min(dayOfMonth, prevMonthMaxDay), 23, 59, 59, 999));

const prevMonthlyNewLeadsMTD = leads.filter((l: any) => {
  if (!l.createdAt) return false;
  const createdTime = Date.parse(l.createdAt);
  return Number.isFinite(createdTime) && 
         createdTime >= prevMonthStart.getTime() && 
         createdTime <= prevMonthSameToDateEnd.getTime();
}).length;

// prevConversionRate: compute for previous month
const prevMonthDeals = deals.filter((d) => {
  if (!d.closedAt) return false;
  const closedDate = new Date(d.closedAt);
  return closedDate >= prevMonthStart && closedDate < prevNextMonthStart;
});
const prevMonthClosedWon = prevMonthDeals.filter((d) => d.stage === "CLOSED_WON").length;
const prevMonthTotalLeads = leads.filter((l: any) => {
  if (!l.createdAt) return false;
  const createdTime = Date.parse(l.createdAt);
  return Number.isFinite(createdTime) && createdTime < prevNextMonthStart.getTime();
}).length;
const prevConversionRate = prevMonthTotalLeads > 0 
  ? (prevMonthClosedWon / prevMonthTotalLeads) * 100 
  : null;

// prevMonthlyProfit: sum for previous month
const prevMonthlyProfit = prevMonthDeals
  .filter((d) => d.stage === "CLOSED_WON")
  .reduce((sum, d) => {
    const fee = Number(d.assignmentFeeActual || 0);
    return sum + (Number.isFinite(fee) ? fee : 0);
  }, 0);
```

#### Production Mode (`server/src/routes/kpis.ts:110-181`)

**SQL approach** (add queries):

```sql
-- prevActiveLeads: count leads created before previous month end
SELECT COUNT(*) as "prevActiveLeads"
FROM "Lead"
WHERE "orgId" = $1
  AND "createdAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC');

-- prevMonthlyNewLeadsMTD: same-to-date (clamped)
WITH current_day AS (
  SELECT EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC')::int as day_num
),
prev_month_end AS (
  SELECT (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day')::date as last_day,
         EXTRACT(DAY FROM (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day'))::int as max_day
)
SELECT COUNT(*) as "prevMonthlyNewLeadsMTD"
FROM "Lead", current_day, prev_month_end
WHERE "orgId" = $1
  AND "createdAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
  AND "createdAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month' + 
      INTERVAL '1 day' * LEAST(current_day.day_num, prev_month_end.max_day);

-- prevConversionRate: compute for previous month
WITH prev_month_deals AS (
  SELECT 
    COUNT(CASE WHEN stage = 'CLOSED_WON' THEN 1 END) as closed_won,
    COUNT(*) as total_deals
  FROM "Deal"
  WHERE "orgId" = $1
    AND "closedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
    AND "closedAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
),
prev_month_leads AS (
  SELECT COUNT(*) as total_leads
  FROM "Lead"
  WHERE "orgId" = $1
    AND "createdAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
)
SELECT 
  CASE 
    WHEN prev_month_leads.total_leads > 0 
    THEN (prev_month_deals.closed_won::float / prev_month_leads.total_leads) * 100
    ELSE NULL
  END as "prevConversionRate"
FROM prev_month_deals, prev_month_leads;

-- prevMonthlyProfit: sum for previous month
SELECT COALESCE(SUM("assignmentFeeActual"), 0) as "prevMonthlyProfit"
FROM "Deal"
WHERE "orgId" = $1
  AND stage = 'CLOSED_WON'
  AND "closedAt" >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
  AND "closedAt" < DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC');
```

### Edge Cases to Handle

1. **First month / no previous period**: Return `null` for all `prev*` fields (forces neutral tone)
2. **Month boundary**: Test on first day of month (previous month should be last month)
3. **Missing createdAt**: Ignore leads with missing `createdAt` in MTD counts (already handled in current code)
4. **Month length mismatch**: Clamp same-to-date end date (e.g., Jan 31 vs Feb 28 → compare Jan 1–31 vs Feb 1–28)
5. **Zero totalLeads in previous month**: Return `null` for `prevConversionRate` (cannot compute rate)

### Performance Notes

- All queries filter by `orgId` (indexed)
- Date filters use `DATE_TRUNC` (index-friendly)
- Queries are bounded (single month ranges)
- Consider combining queries if performance becomes an issue (but keep separate for v1 clarity)

---

## PHASE 3 — FRONTEND INTEGRATION

### A) Extend KpiSummary Interface

**File**: `web/src/api/hooks.ts:128-139`

**Change**:
```typescript
export interface KpiSummary {
  totalLeads: number;
  activeLeads: number;
  conversionRate: number;
  assignments: number;
  contractsInEscrow: number;
  contactRate: number;
  monthlyNewLeads: number;
  monthlyProfit: number;
  qualifiedLeads: number;
  monthlyQualifiedLeads: number;
  // NEW: Previous period baselines
  prevActiveLeads: number | null;
  prevConversionRate: number | null;
  prevMonthlyNewLeadsMTD: number | null;
  prevMonthlyProfit: number | null;
}
```

**Query key**: Keep `["kpis-summary"]` unchanged (single source of truth)

**Endpoint**: Keep `"/api/kpis"` unchanged (canonical client)

### B) Add Tone Computation Helper

**Location**: Add to `web/src/components/KpiCard.tsx` (same file, no new files)

**Function**:
```typescript
/**
 * Computes semantic tone from current and baseline values
 */
function computeTone(
  current: number | null | undefined,
  baseline: number | null | undefined,
  polarity: "higher" | "lower" = "higher"
): "positive" | "negative" | "neutral" {
  // Missing baseline => neutral
  if (baseline === null || baseline === undefined) return "neutral";
  
  // Missing current => neutral
  if (current === null || current === undefined) return "neutral";
  
  // NaN/Infinity => neutral
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return "neutral";
  
  // Compute delta
  const delta = current - baseline;
  
  // Zero delta => neutral
  if (delta === 0) return "neutral";
  
  // Apply polarity
  if (polarity === "higher") {
    return delta > 0 ? "positive" : "negative";
  } else {
    return delta < 0 ? "positive" : "negative";
  }
}
```

### C) Update KpiTile Props

**File**: `web/src/components/KpiTile.tsx:1-6`

**Change**:
```typescript
interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";  // NEW
  isLoading?: boolean;
}
```

**Rendering logic** (line 13):
```typescript
// Map tone to color class
const valueColorClass = 
  tone === "positive" ? "text-emerald-400" :
  tone === "negative" ? "text-[#ff0a45]" :
  "text-white/80";  // neutral (or current default)

// Force neutral if value is "—"
const finalTone = value === "—" ? "neutral" : tone;
const finalColorClass = finalTone === "positive" ? "text-emerald-400" :
                        finalTone === "negative" ? "text-[#ff0a45]" :
                        "text-white/80";
```

### D) Update KpiCard to Compute and Pass Tones

**File**: `web/src/components/KpiCard.tsx:16-58`

**Changes**:

1. **Compute tones for each tile**:
```typescript
const activeLeadsTone = computeTone(
  data?.activeLeads,
  data?.prevActiveLeads,
  "higher"
);

const conversionRateTone = computeTone(
  data?.conversionRate,
  data?.prevConversionRate,
  "higher"
);

const monthlyNewLeadsTone = computeTone(
  data?.monthlyNewLeads,
  data?.prevMonthlyNewLeadsMTD,
  "higher"
);

const monthlyProfitTone = computeTone(
  data?.monthlyProfit,
  data?.prevMonthlyProfit,
  "higher"
);
```

2. **Pass tone prop to each KpiTile**:
```typescript
<KpiTile
  label={t('dashboard.activeLeads')}
  value={isBusy ? '—' : String(data?.activeLeads ?? 0)}
  tone={activeLeadsTone}
  isLoading={isBusy}
/>
```

3. **Remove misused delta** (line 36):
```typescript
// REMOVE: delta={data?.monthlyQualifiedLeads ? `+${data.monthlyQualifiedLeads}` : undefined}
// This was showing qualified leads, not period-over-period change
```

### E) i18n Requirements

**File**: `web/src/components/KpiCard.tsx:45, 50`

**Current hardcoded labels**:
- Line 45: `label="New Leads (MTD)"` → Should be `t('dashboard.newLeadsMtd')`
- Line 50: `label="Total Revenue"` → Should be `t('dashboard.totalRevenue')`

**Add to translations** (`web/src/i18n/translations.ts`):

```typescript
dashboard: {
  // ... existing keys ...
  newLeadsMtd: "New Leads (MTD)",  // EN
  totalRevenue: "Total Revenue",   // EN
  // ... ES and PT translations ...
}
```

**Number formatting**: Already uses `Intl.NumberFormat` in `formatCurrency()` (line 7-14), but conversion rate uses `.toFixed(1)`. Consider using locale-aware formatting for percentages if needed.

---

## PHASE 4 — VERIFICATION MATRIX + SECOND-ORDER EFFECTS

### Verification Test Cases

| Test Case | Input | Expected Outcome | Verification Method |
|-----------|-------|------------------|---------------------|
| **Baseline missing** | `current = 10`, `baseline = null` | Neutral tone, `text-white/80` | Visual inspection + DevTools computed style |
| **Positive delta** | `current = 15`, `baseline = 10` | Positive tone, `text-emerald-400` | Visual inspection + DevTools computed style |
| **Negative delta** | `current = 5`, `baseline = 10` | Negative tone, `text-[#ff0a45]` | Visual inspection + DevTools computed style |
| **Zero delta** | `current = 10`, `baseline = 10` | Neutral tone, `text-white/80` | Visual inspection + DevTools computed style |
| **Same-to-date clamp** | Create leads on Jan 31, compare to Feb (28 days) | No crash, compares Jan 1–31 vs Feb 1–28 | Manual test on month boundary |
| **Language switch** | Switch EN → ES → PT | Labels change, numbers formatted correctly, no layout overflow | Manual test + i18n toggle |
| **Identity modes** | JWT mode vs forced dev identity | Consistent org counts, same baseline values | Manual test + localStorage toggle |
| **Value is "—"** | `value = "—"`, `tone = "positive"` | Neutral color (forced), `text-white/80` | Visual inspection |
| **NaN values** | `current = NaN`, `baseline = 10` | Neutral tone | Unit test + visual inspection |
| **First month** | No previous month data | All `prev*` fields = `null`, all tiles neutral | Manual test with new org |
| **Loading state** | `isLoading = true` | Value shows "—", neutral color | Visual inspection |

### Second-Order Effects Prevention

1. **Avoid "false red" when baseline missing**:
   - ✅ Rule: `baseline === null` → `neutral` (enforced in `computeTone()`)
   - ✅ Verification: Test with `prevActiveLeads = null`

2. **Avoid "green = good" for lower-is-better metrics**:
   - ✅ Rule: `polarity` parameter in `computeTone()` (future-proof)
   - ✅ Verification: All current metrics use `"higher"` polarity

3. **Avoid extra API calls**:
   - ✅ Rule: Reuse `["kpis-summary"]` only, no new queries
   - ✅ Verification: Network tab shows exactly one GET `/api/kpis` per dashboard load

4. **Avoid accessibility regressions**:
   - ⚠️ **Risk**: Color-only signal (WCAG 2.1 Level A requires non-color indicator)
   - **Mitigation**: 
     - For v1: Ensure sufficient contrast (emerald-400 on dark bg meets WCAG AA)
     - **Future enhancement**: Add delta text indicator (e.g., "▲ +2 vs last month") in Phase 5

5. **Avoid i18n regressions**:
   - ✅ Rule: All labels use `t()` function
   - ✅ Verification: Add missing translation keys for "New Leads (MTD)" and "Total Revenue"

6. **Avoid identity unification regression**:
   - ✅ Rule: All API calls use canonical `get()` from `web/src/api.ts`
   - ✅ Verification: No new imports from `../api/client`

### Rollback Plan (Per Phase)

#### Phase 1 Rollback (Backend)
- Revert `server/src/routes/kpis.ts` to remove `prev*` field calculations
- Remove `prev*` fields from response JSON
- **Risk**: Low (additive changes only)

#### Phase 2 Rollback (Frontend Types)
- Revert `web/src/api/hooks.ts` to remove `prev*` fields from `KpiSummary` interface
- **Risk**: Low (TypeScript will catch any usage)

#### Phase 3 Rollback (Frontend Logic)
- Revert `web/src/components/KpiCard.tsx` to remove tone computation
- Revert `web/src/components/KpiTile.tsx` to remove `tone` prop
- **Risk**: Low (component-level changes)

#### Phase 4 Rollback (i18n)
- Revert translation key additions
- Revert hardcoded label replacements
- **Risk**: Low (additive changes)

---

## IMPLEMENTATION PHASES SUMMARY

### Phase 1: Backend — Add Previous Period Fields
**Files**: `server/src/routes/kpis.ts`
- Add 4 `prev*` variables
- Implement dev mode calculations (UTC month boundaries, same-to-date clamping)
- Implement production SQL queries (with same-to-date logic)
- Add fields to response JSON
- **Estimated changes**: ~100 lines (dev + prod branches)

### Phase 2: Frontend Types — Extend KpiSummary Interface
**Files**: `web/src/api/hooks.ts`
- Add 4 optional `prev*` fields to `KpiSummary` interface
- **Estimated changes**: 4 lines

### Phase 3: Frontend Logic — Tone Computation + Rendering
**Files**: 
- `web/src/components/KpiCard.tsx` (add `computeTone()` + pass tones)
- `web/src/components/KpiTile.tsx` (add `tone` prop + color mapping)
- **Estimated changes**: ~30 lines

### Phase 4: i18n — Add Missing Translation Keys
**Files**: `web/src/i18n/translations.ts`
- Add `dashboard.newLeadsMtd` (EN/ES/PT)
- Add `dashboard.totalRevenue` (EN/ES/PT)
- Update `KpiCard.tsx` to use translation keys
- **Estimated changes**: ~10 lines

### Phase 5: QA + Edge Cases
**Manual testing**:
- All verification test cases
- Month boundary testing
- Language switching
- Identity mode switching

---

## STRICT DEFINITION OF "NEGATIVE" PER KPI

### Universal Rules

1. **Negative only exists when comparing to baseline**
2. **If baseline is missing** (`null`/`undefined`) → **Neutral** (never red/green)
3. **If delta is exactly 0** → **Neutral**
4. **If value is "—"** → **Neutral** (regardless of baseline)
5. **If value is NaN/Infinity** → **Neutral**

### Per-KPI Definitions

#### Active Leads
- **Negative**: `activeLeads < prevActiveLeads` (declining active pipeline)
- **Positive**: `activeLeads > prevActiveLeads` (growing active pipeline)
- **Neutral**: `activeLeads === prevActiveLeads` OR `prevActiveLeads === null`

#### Conversion Rate
- **Negative**: `conversionRate < prevConversionRate` (declining conversion)
- **Positive**: `conversionRate > prevConversionRate` (improving conversion)
- **Neutral**: `conversionRate === prevConversionRate` OR `prevConversionRate === null`

#### New Leads (MTD)
- **Negative**: `monthlyNewLeads < prevMonthlyNewLeadsMTD` (fewer new leads this month)
- **Positive**: `monthlyNewLeads > prevMonthlyNewLeadsMTD` (more new leads this month)
- **Neutral**: `monthlyNewLeads === prevMonthlyNewLeadsMTD` OR `prevMonthlyNewLeadsMTD === null`

#### Total Revenue
- **Negative**: `monthlyProfit < prevMonthlyProfit` (declining revenue)
- **Positive**: `monthlyProfit > prevMonthlyProfit` (growing revenue)
- **Neutral**: `monthlyProfit === prevMonthlyProfit` OR `prevMonthlyProfit === null`

---

## FILE CHANGE SUMMARY

### Files to Modify

| File | Changes | Lines Affected | Risk Level |
|------|---------|----------------|------------|
| `server/src/routes/kpis.ts` | Add 4 `prev*` field calculations (dev + prod) | ~100 lines | Medium (backend logic) |
| `web/src/api/hooks.ts` | Extend `KpiSummary` interface | 4 lines | Low (type-only) |
| `web/src/components/KpiCard.tsx` | Add `computeTone()` + compute/pass tones | ~20 lines | Low (component logic) |
| `web/src/components/KpiTile.tsx` | Add `tone` prop + color mapping | ~10 lines | Low (component props) |
| `web/src/i18n/translations.ts` | Add 2 translation keys (EN/ES/PT) | ~6 lines | Low (additive) |

### Files NOT Modified

- `web/src/api.ts` (canonical client unchanged)
- `web/src/styles/neon.css` (no CSS changes needed)
- `web/src/styles/theme.css` (using existing Tailwind classes)
- `web/src/pages/KpisPage.tsx` (separate page, out of scope)

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] All 4 tiles show correct colors based on delta (green/red/neutral)
- [ ] Neutral when baseline missing (`prev* = null`)
- [ ] Neutral when delta is 0
- [ ] Neutral when value is "—"
- [ ] Same-to-date comparison works correctly (test on different days of month)
- [ ] Month boundary handling (test on first day of month)
- [ ] Language switching works (EN/ES/PT labels change)
- [ ] Identity modes work (JWT vs dev identity)
- [ ] No console errors
- [ ] No network regressions (single GET `/api/kpis` call)
- [ ] No i18n regressions (all labels use translation keys)
- [ ] Accessibility: sufficient color contrast (emerald-400 on dark bg)

---

**END OF IMPLEMENTATION PLAN**







