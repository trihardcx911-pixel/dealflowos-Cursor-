ed KpiSummary interface and normalization
2. **web/src/components/KpiCard.tsx** - Added new KPI tiles with Silver gating
3. **# Phase 4: Frontend UI + Silver Gating - Summary

## Changes Made

### Files Modified (5 files)

1. **web/src/api/hooks.ts** - Updatweb/src/features/leads/EditLeadModal.tsx** - Added Deal Milestones section
4. **web/src/pages/LeadsPage.tsx** - Updated handleSaveLead with whitelist payload
5. **web/src/i18n/translations.ts** - Added i18n keys for new KPIs

## Exact Diffs

### 1. KpiSummary Interface (web/src/api/hooks.ts)

```diff
--- a/web/src/api/hooks.ts
+++ b/web/src/api/hooks.ts
@@ -128,6 +128,8 @@ export interface KpiSummary {
   monthlyProfit: number;
   qualifiedLeads: number;
   monthlyQualifiedLeads: number;
+  assignmentsMTD: number;
+  inEscrow: number;
   // Previous period baselines (for semantic color tone computation)
   prevActiveLeads: number | null;
   prevConversionRate: number | null;
@@ -150,7 +152,13 @@ export function useKpisSummary() {
   return useQuery<KpiSummary>({
     queryKey: ["kpis-summary"],
-    queryFn: () => get<KpiSummary>("/api/kpis"),
+    queryFn: async () => {
+      const data = await get<any>("/api/kpis");
+      // Normalize new fields with safe defaults
+      return {
+        ...data,
+        assignmentsMTD: Number(data.assignmentsMTD) || 0,
+        inEscrow: Number(data.inEscrow) || 0,
+      } as KpiSummary;
+    },
   });
 }
```

### 2. KPI Card UI (web/src/components/KpiCard.tsx)

```diff
--- a/web/src/components/KpiCard.tsx
+++ b/web/src/components/KpiCard.tsx
@@ -79,6 +79,20 @@ export function KpiCard() {
     ? "neutral" 
     : computeTone(monthlyProfitNumeric, data?.prevMonthlyProfit);
 
+  // Silver gating for milestone KPIs
+  const isSilver = localStorage.getItem("DFOS_PLAN_TIER") === "silver";
+  const milestonesEnabled = isSilver || localStorage.getItem("DFOS_FEATURE_MILESTONES") === "1";
+
+  // Assignments MTD
+  const assignmentsMTDNumeric = data?.assignmentsMTD;
+  const assignmentsMTDDisplay = milestonesEnabled
+    ? (isBusy ? "—" : String(assignmentsMTDNumeric ?? 0))
+    : "—";
+  const assignmentsMTDTone = milestonesEnabled ? "neutral" : "neutral";
+
+  // In Escrow
+  const inEscrowNumeric = data?.inEscrow;
+  const inEscrowDisplay = milestonesEnabled
+    ? (isBusy ? "—" : String(inEscrowNumeric ?? 0))
+    : "—";
+  const inEscrowTone = milestonesEnabled ? "neutral" : "neutral";
+
   return (
     <NeonCard
       sectionLabel={t('dashboard.analytics')}
       title={t('dashboard.viewKpis')}
       onClick={() => navigate('/kpis')}
       colSpan={4}
     >
       <div className="flex-1 min-h-0">
-        <div className="grid grid-cols-2 grid-rows-2 gap-dfos-3 h-full">
+        <div className="grid grid-cols-2 grid-rows-3 gap-dfos-3 h-full">
           <KpiTile
             label={t('dashboard.activeLeads')}
             value={activeLeadsDisplay}
@@ -110,6 +124,16 @@ export function KpiCard() {
             tone={monthlyProfitTone}
             isLoading={isBusy}
           />
+          <KpiTile
+            label={milestonesEnabled ? t('dashboard.assignmentsMtd') : `${t('dashboard.assignmentsMtd')} (${t('dashboard.silverFeatureLocked')})`}
+            value={assignmentsMTDDisplay}
+            tone={assignmentsMTDTone}
+            isLoading={isBusy}
+          />
+          <KpiTile
+            label={milestonesEnabled ? t('dashboard.inEscrow') : `${t('dashboard.inEscrow')} (${t('dashboard.silverFeatureLocked')})`}
+            value={inEscrowDisplay}
+            tone={inEscrowTone}
+            isLoading={isBusy}
+          />
         </div>
       </div>
     </NeonCard>
```

### 3. EditLeadModal (web/src/features/leads/EditLeadModal.tsx)

**Added:**
- Silver gating logic
- Deal Milestones section with 5 checkboxes + buyerName input + assignmentFee input
- Client-side validation for assignedAt + buyerName
- isSaving state to prevent double-submit
- Disabled states during save

**Key additions:**
- Lines 15-17: Silver gating
- Lines 21-25: Validation logic
- Lines 64-189: Deal Milestones UI section
- Lines 199-212: Async save handler with loading state

### 4. LeadsPage handleSaveLead (web/src/pages/LeadsPage.tsx)

```diff
--- a/web/src/pages/LeadsPage.tsx
+++ b/web/src/pages/LeadsPage.tsx
@@ -459,6 +459,48 @@ export default function LeadsPage() {
   async function handleSaveLead(updated: Lead) {
     try {
-      await patch(`/leads/${updated.id}`, updated);
+      // Whitelist payload: only send fields that can be updated
+      // Core lead fields
+      const payload: any = {
+        type: updated.type,
+        address: updated.address,
+        city: updated.city,
+        state: updated.state,
+        zip: updated.zip,
+      };
+
+      // Temperature (if present)
+      if (updated.temperature !== undefined) {
+        payload.temperature = updated.temperature;
+      }
+
+      // Milestone fields (if present)
+      if (updated.underContractAt !== undefined) {
+        payload.underContractAt = updated.underContractAt;
+      }
+      if (updated.assignedAt !== undefined) {
+        payload.assignedAt = updated.assignedAt;
+      }
+      if (updated.escrowOpenedAt !== undefined) {
+        payload.escrowOpenedAt = updated.escrowOpenedAt;
+      }
+      if (updated.closedAt !== undefined) {
+        payload.closedAt = updated.closedAt;
+      }
+      if (updated.cancelledAt !== undefined) {
+        payload.cancelledAt = updated.cancelledAt;
+      }
+      if (updated.buyerName !== undefined) {
+        payload.buyerName = updated.buyerName;
+      }
+      if (updated.assignmentFee !== undefined) {
+        payload.assignmentFee = updated.assignmentFee;
+      }
+
+      await patch(`/leads/${updated.id}`, payload);
       setEditingLead(null);
       notify("success", "Lead updated");
       await refresh();
       queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
+      queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
     } catch (e: any) {
       const msg = e?.error?.message || e?.message || "Unable to update lead";
-      notify("error", msg);
+      if (msg.includes("buyerName is required")) {
+        notify("error", "Buyer name is required when lead is assigned");
+      } else {
+        notify("error", msg);
+      }
     }
   }
```

### 5. i18n Translations (web/src/i18n/translations.ts)

**Added keys for EN/ES/PT:**
- `dashboard.assignmentsMtd`
- `dashboard.inEscrow`
- `dashboard.dealMilestonesSilver`
- `dashboard.silverFeatureLocked`

## Silver Gating Implementation

**Gating Logic:**
```typescript
const isSilver = localStorage.getItem("DFOS_PLAN_TIER") === "silver";
const milestonesEnabled = isSilver || localStorage.getItem("DFOS_FEATURE_MILESTONES") === "1";
```

**Dev Override:**
- To enable in dev: `localStorage.setItem("DFOS_FEATURE_MILESTONES", "1")`
- Or: `localStorage.setItem("DFOS_PLAN_TIER", "silver")`

**UI Behavior:**
- **Bronze (milestonesEnabled = false)**: 
  - KPI tiles show "—" with "(Silver)" label
  - EditLeadModal shows teaser text only
- **Silver (milestonesEnabled = true)**:
  - KPI tiles show actual values
  - EditLeadModal shows full milestone controls

## Manual Test Checklist

**Prerequisites:**
- Server running on `http://localhost:3010`
- Dev mode enabled (`DEV_AUTH_BYPASS=1`)
- At least one lead exists

**Test 1: Silver enabled - set Assigned + buyerName → Save → reopen modal shows persisted**
```bash
# Enable Silver
localStorage.setItem("DFOS_FEATURE_MILESTONES", "1")
# Reload page, edit lead, check "Assigned", enter buyerName, Save
# Reopen modal → should show Assigned checked with buyerName and timestamp
```
**Expected:** Milestone persists after save and modal reopen

**Test 2: Silver enabled - set Escrow Opened → Save → KPI inEscrow increments**
```bash
# Edit lead, check "Escrow Opened", Save
# Check dashboard KPI card → inEscrow should increment
```
**Expected:** `inEscrow` KPI increases by 1

**Test 3: Validation - Assigned checked without buyerName → cannot save + shows error**
```bash
# Edit lead, check "Assigned", leave buyerName empty
# Try to click Save → button should be disabled
# Error message should appear: "Buyer name is required when lead is assigned"
```
**Expected:** Save button disabled, error message shown

**Test 4: Bronze - cannot interact with milestone controls; KPI tiles show locked state**
```bash
# Clear Silver flag
localStorage.removeItem("DFOS_FEATURE_MILESTONES")
localStorage.removeItem("DFOS_PLAN_TIER")
# Reload page
# Edit lead → should see "Deal Milestones (Silver tier feature)" teaser only
# Dashboard → KPI tiles should show "—" with "(Silver)" label
```
**Expected:** No interactive controls, locked KPI tiles

**Test 5: No legacy api/client imports introduced**
```bash
# Search for any imports from '../api/client' or '../../api/client'
rg -n "from.*api/client" web/src
```
**Expected:** No matches (all imports use canonical `web/src/api.ts`)

## Verification Commands

**Test A: Set assignedAt and verify assignmentsMTD increments**
```bash
# Enable Silver
localStorage.setItem("DFOS_FEATURE_MILESTONES", "1")
# Reload, edit lead, set Assigned + buyerName, Save
# Check dashboard → assignmentsMTD should increment if assignedAt is in current month
```
**Expected:** HTTP 200, KPI increments

**Test B: Set escrowOpenedAt, verify inEscrow increments**
```bash
# Edit lead, set Escrow Opened, Save
# Check dashboard → inEscrow should increment
```
**Expected:** HTTP 200, KPI increments

**Test C: Set closedAt, verify inEscrow decrements**
```bash
# Edit lead (already in escrow), set Closed, Save
# Check dashboard → inEscrow should decrement
```
**Expected:** HTTP 200, KPI decrements

**Test D: Regression - existing KPIs still work**
```bash
# Check dashboard → all existing KPI tiles should still display correctly
```
**Expected:** All existing KPIs (activeLeads, conversionRate, newLeadsMtd, profitMtd) still work

## Implementation Notes

### Whitelist Payload
- Only sends fields that are explicitly in the form state
- Prevents accidental overwrites of fields not being edited
- Backend handles undefined vs null correctly (undefined = don't touch, null = clear)

### Cache Invalidation
- After successful PATCH: invalidates `["kpis-summary"]` and `["lead-sources"]`
- Uses existing `refresh()` for leads list
- No manual `fetchQuery` - relies on React Query's automatic refetch on invalidation

### Silver Gating
- Feature flag: `DFOS_FEATURE_MILESTONES === "1"` (dev override)
- Plan tier: `DFOS_PLAN_TIER === "silver"` (production)
- Bronze users see locked/teaser state
- No backend enforcement in this phase (UI-only gating)

### Validation
- Client-side: Save button disabled if assignedAt set without buyerName
- Server-side: Returns 400 if validation fails (handled in error message)

## Files Touched Summary

1. **web/src/api/hooks.ts** - KpiSummary interface + normalization
2. **web/src/components/KpiCard.tsx** - New KPI tiles + Silver gating
3. **web/src/features/leads/EditLeadModal.tsx** - Deal Milestones section
4. **web/src/pages/LeadsPage.tsx** - Whitelist payload + KPI invalidation
5. **web/src/i18n/translations.ts** - i18n keys (EN/ES/PT)

**Total: 5 files** (minimal, focused changes)







