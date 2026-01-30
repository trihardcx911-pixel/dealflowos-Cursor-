# KPI Semantic Colors Baseline Contract v1
## LOCKED SPECIFICATION (No Code Changes)

---

## A) KPI Inventory (Current Truth)

| Tile | Current Field | Current Definition | Current Label | Current Delta/Misuse |
|------|---------------|-------------------|---------------|---------------------|
| **Active Leads** | `data?.activeLeads` | Count of non-archived leads (equals `totalLeads` if no archived field exists) | `t('dashboard.activeLeads')` → "Active Leads" | Misused: shows `monthlyQualifiedLeads` (qualified deals this month, not period-over-period) |
| **Conversion Rate** | `data?.conversionRate` | `(closedWonDeals / totalLeads) * 100` | `t('dashboard.conversionRate')` → "Conversion Rate" | None |
| **New Leads (MTD)** | `data?.monthlyNewLeads` | Count of leads created this month (UTC boundaries: `monthStart` to `nextMonthStart`) | Hardcoded: `"New Leads (MTD)"` | None (note: backend computes FULL month, not MTD; label is misleading) |
| **Total Revenue** | N/A (hardcoded `"—"`) | Not implemented | Hardcoded: `"Total Revenue"` | N/A (backend has `monthlyProfit` but tile shows placeholder) |

**Backend Response Fields** (`server/src/routes/kpis.ts:184-195`):
- `totalLeads`, `activeLeads`, `conversionRate`, `assignments`, `contractsInEscrow`, `contactRate`, `monthlyNewLeads`, `monthlyProfit`, `qualifiedLeads`, `monthlyQualifiedLeads`

**Current monthlyNewLeads Computation** (UTC):
- Dev: `createdTime >= monthStart.getTime() && createdTime < nextMonthStart.getTime()`
- Prod: `createdAt >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AND createdAt < DATE_TRUNC('month', (NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month')`

---

## B) Baseline Contract v1 (LOCKED)

| Tile | Current Window (UTC) | Baseline Window (UTC) | Required Backend Baseline Field | Delta Formula | Polarity | Tone Enabled? | Notes |
|------|---------------------|----------------------|-------------------------------|---------------|----------|---------------|-------|
| **Active Leads** | Current month total (all leads created before `nextMonthStart`) | Previous month total (all leads created before previous month's `nextMonthStart`) | `prevActiveLeads: number \| null` | `delta = activeLeads - prevActiveLeads` | Higher is better | **Y** | Schema limitation: `activeLeads === totalLeads` until archived/status field exists |
| **Conversion Rate** | Current month rate: `(closedWonDeals / totalLeads) * 100` | Previous month rate: `(prevMonthClosedWon / prevMonthTotalLeads) * 100` | `prevConversionRate: number \| null` | `delta_pp = conversionRate - prevConversionRate` (percentage points) | Higher is better | **Y** | Tone enabled if `prevConversionRate !== null`; neutral if `prevMonthTotalLeads === 0` |
| **New Leads** | Current month total (UTC: `monthStart` to `nextMonthStart`) | Previous month total (UTC: previous `monthStart` to previous `nextMonthStart`) | `prevMonthlyNewLeads: number \| null` | `delta = monthlyNewLeads - prevMonthlyNewLeads` | Higher is better | **Y** | Label says "MTD" but backend computes full month; v1 uses full month comparison (MoM) for simplicity |
| **Profit** | Current month: `sum(assignmentFeeActual)` for `CLOSED_WON` deals this month | Previous month: `sum(assignmentFeeActual)` for `CLOSED_WON` deals previous month | `prevMonthlyProfit: number \| null` | `delta = monthlyProfit - prevMonthlyProfit` | Higher is better | **Y** | Label must change from "Total Revenue" to "Profit (MTD)" to match `monthlyProfit` field |

**Global Tone Rules** (apply to all tiles):
- `baseline === null || baseline === undefined` → **neutral**
- `delta === 0` → **neutral**
- `current === null || current === undefined || !Number.isFinite(current)` → **neutral**
- `baseline === null || baseline === undefined || !Number.isFinite(baseline)` → **neutral**
- Value displayed as `"—"` → **neutral** (regardless of baseline)
- **No literal negative counts displayed**: negative delta only affects tone (red), not the displayed number

---

## C) Label + i18n Keys (LOCKED)

| Tile | i18n Key | EN | ES | PT |
|------|----------|----|----|----|
| **Active Leads** | `dashboard.activeLeads` | "Active Leads" | "Leads Activos" | "Leads Ativos" |
| **Conversion Rate** | `dashboard.conversionRate` | "Conversion Rate" | "Tasa de Conversión" | "Taxa de Conversão" |
| **New Leads** | `dashboard.newLeadsMtd` | "New Leads (MTD)" | "Nuevos Leads (MTD)" | "Novos Leads (MTD)" |
| **Profit** | `dashboard.profitMtd` | "Profit (MTD)" | "Ganancia (MTD)" | "Lucro (MTD)" |

**Label Decision Rationale**:
- **New Leads**: Keep "MTD" label (user-facing convention) but use full month comparison (MoM) in backend for v1 simplicity. Future enhancement: true MTD vs prev MTD if needed.
- **Profit**: Change from "Total Revenue" to "Profit (MTD)" to match `monthlyProfit` field truthfully.

**Translation Constraints**:
- All labels ≤ 20 characters (EN) to prevent layout overflow
- MTD abbreviation kept in all languages (universal)
- Parentheses preserved for consistency

---

## D) Acceptance Criteria (PASS/FAIL)

After implementation, all must be TRUE:

- [ ] **CR-1**: Active Leads tile shows green when `activeLeads > prevActiveLeads`, red when `activeLeads < prevActiveLeads`, neutral when `prevActiveLeads === null`
- [ ] **CR-2**: Conversion Rate tile shows green when `conversionRate > prevConversionRate`, red when `conversionRate < prevConversionRate`, neutral when `prevConversionRate === null` or `prevMonthTotalLeads === 0`
- [ ] **CR-3**: New Leads tile shows green when `monthlyNewLeads > prevMonthlyNewLeads`, red when `monthlyNewLeads < prevMonthlyNewLeads`, neutral when `prevMonthlyNewLeads === null`
- [ ] **CR-4**: Profit tile shows green when `monthlyProfit > prevMonthlyProfit`, red when `monthlyProfit < prevMonthlyProfit`, neutral when `prevMonthlyProfit === null` or value is `"—"`
- [ ] **CR-5**: All tiles show neutral tone when `delta === 0` (exact match with baseline)
- [ ] **CR-6**: All tiles show neutral tone when displayed value is `"—"` (loading/error state), regardless of baseline existence
- [ ] **CR-7**: Month boundary handling: On first day of month (e.g., Jan 1), previous month baseline correctly references December (no crash, correct comparison)
- [ ] **CR-8**: First month / no previous data: All `prev*` fields return `null`, all tiles show neutral tone (no false red/green)
- [ ] **CR-9**: i18n labels: Switching EN → ES → PT updates all 4 tile labels correctly, no layout overflow
- [ ] **CR-10**: Misused delta removed: Active Leads tile no longer shows `monthlyQualifiedLeads` as delta (removed from KpiCard.tsx line 36)

---

**END OF BASELINE CONTRACT v1**







