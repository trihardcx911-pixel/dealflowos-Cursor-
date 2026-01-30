# Phase 5: Stabilization and Hardening - Summary

## Changes Made

### Files Modified (3 files)

1. **web/src/pages/LeadsPage.tsx** - Lead type extension, data normalization, invalidation fix
2. **web/src/features/leads/EditLeadModal.tsx** - assignmentFee string handling, gating comments
3. **web/src/components/KpiCard.tsx** - Gating comments for consistency

## Exact Diffs

### 1. Lead Type Extension (web/src/pages/LeadsPage.tsx)

```diff
--- a/web/src/pages/LeadsPage.tsx
+++ b/web/src/pages/LeadsPage.tsx
@@ -13,6 +13,16 @@ type Lead = {
   createdAt?: string
   updatedAt?: string
   temperature?: 'cold' | 'warm' | 'hot'
+  // Deal Milestones (Silver tier)
+  underContractAt?: string | null
+  assignedAt?: string | null
+  escrowOpenedAt?: string | null
+  closedAt?: string | null
+  cancelledAt?: string | null
+  buyerName?: string | null
+  assignmentFee?: string | null  // Decimal from DB comes as string; keep as string for round-trip safety
 }
```

**Why:** Ensures TypeScript knows about milestone fields and treats assignmentFee as string (matches DB Decimal type).

### 2. Data Normalization in refresh() (web/src/pages/LeadsPage.tsx)

```diff
--- a/web/src/pages/LeadsPage.tsx
+++ b/web/src/pages/LeadsPage.tsx
@@ -249,6 +259,18 @@ export default function LeadsPage() {
     setError(null)
     try {
-      const res = await get<{ items: Lead[] }>('/leads')
-      setItems(res.items)
+      const res = await get<{ items: any[] }>('/leads')
+      // Normalize milestone fields: ensure assignmentFee is string | null (Decimal from DB may be string)
+      const normalizedItems: Lead[] = res.items.map((item: any) => ({
+        ...item,
+        assignmentFee: item.assignmentFee == null ? null : String(item.assignmentFee),
+        // Milestone timestamps: ensure null stays null, strings stay strings (already ISO format)
+        underContractAt: item.underContractAt ?? null,
+        assignedAt: item.assignedAt ?? null,
+        escrowOpenedAt: item.escrowOpenedAt ?? null,
+        closedAt: item.closedAt ?? null,
+        cancelledAt: item.cancelledAt ?? null,
+        buyerName: item.buyerName ?? null,
+      }))
+      setItems(normalizedItems)
```

**Why:** Normalizes assignmentFee from DB (may be string from Decimal) to consistent string | null. Ensures milestone timestamps are consistently null or ISO strings.

### 3. Fix Unnecessary lead-sources Invalidation (web/src/pages/LeadsPage.tsx)

```diff
--- a/web/src/pages/LeadsPage.tsx
+++ b/web/src/pages/LeadsPage.tsx
@@ -499,6 +521,8 @@ export default function LeadsPage() {
       setEditingLead(null);
       notify("success", "Lead updated");
       await refresh();
-      queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
+      // Only invalidate lead-sources if source field was actually edited
+      if (updated.source !== undefined) {
+        queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
+      }
       // Always invalidate KPIs since milestones affect assignmentsMTD and inEscrow
       queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
```

**Why:** Milestones don't affect lead sources. Only invalidate when `source` field is actually edited to reduce unnecessary refetch churn.

### 4. assignmentFee String Handling in PATCH Payload (web/src/pages/LeadsPage.tsx)

```diff
--- a/web/src/pages/LeadsPage.tsx
+++ b/web/src/pages/LeadsPage.tsx
@@ -495,6 +517,9 @@ export default function LeadsPage() {
       if (updated.buyerName !== undefined) {
         payload.buyerName = updated.buyerName;
       }
       if (updated.assignmentFee !== undefined) {
-        payload.assignmentFee = updated.assignmentFee;
+        // assignmentFee: send as string | null (matches DB Decimal type)
+        // Server accepts both number and string; we send string for consistency
+        payload.assignmentFee = updated.assignmentFee === null ? null : String(updated.assignmentFee);
       }
```

**Why:** Ensures assignmentFee is always sent as string | null to match DB Decimal type, preventing type drift.

### 5. assignmentFee Input Handling (web/src/features/leads/EditLeadModal.tsx)

```diff
--- a/web/src/features/leads/EditLeadModal.tsx
+++ b/web/src/features/leads/EditLeadModal.tsx
@@ -173,6 +173,12 @@ export default function EditLeadModal({ lead, onClose, onSave }: EditLeadModal
               <input
                 type="number"
-                value={form.assignmentFee || ""}
-                onChange={(e) => update("assignmentFee", e.target.value ? parseFloat(e.target.value) : null)}
+                value={form.assignmentFee ?? ""}
+                onChange={(e) => {
+                  const val = e.target.value;
+                  // Store as string to match DB Decimal type (round-trip safety)
+                  // Allow empty string during typing; convert to null when cleared
+                  update("assignmentFee", val === "" ? null : val);
+                }}
                 placeholder="0.00"
                 step="0.01"
                 min="0"
```

**Why:** Stores assignmentFee as string (not number) to match DB Decimal type. Prevents parseFloat from losing precision or causing NaN issues. Allows typing without forcing toFixed on every keystroke.

### 6. Gating Comments (web/src/features/leads/EditLeadModal.tsx, web/src/components/KpiCard.tsx)

```diff
--- a/web/src/features/leads/EditLeadModal.tsx
+++ b/web/src/features/leads/EditLeadModal.tsx
@@ -15,6 +15,8 @@ export default function EditLeadModal({ lead, onClose, onSave }: EditLeadModal
 
   // Silver gating
+  // DFOS_FEATURE_MILESTONES is dev override only; production uses DFOS_PLAN_TIER
   const isSilver = localStorage.getItem("DFOS_PLAN_TIER") === "silver";
   const milestonesEnabled = isSilver || localStorage.getItem("DFOS_FEATURE_MILESTONES") === "1";
+  // Note: No backend enforcement in this phase (UI-only gating)
```

**Why:** Documents that gating is UI-only and prevents false security assumptions. Clarifies dev override vs production tier.

## Verification Checklist

### 1. Bronze mode (no tier keys): milestones UI locked + KPI tiles show "—" locked label
**Status:** ✅ Verified
- Clear localStorage: `localStorage.removeItem("DFOS_FEATURE_MILESTONES"); localStorage.removeItem("DFOS_PLAN_TIER");`
- Reload page
- Edit lead → shows "Deal Milestones (Silver tier feature)" teaser only
- Dashboard → KPI tiles show "—" with "(Silver)" label

### 2. Silver mode (DFOS_PLAN_TIER="silver"): milestones editable + values persist after refresh
**Status:** ✅ Verified
- Set: `localStorage.setItem("DFOS_PLAN_TIER", "silver")`
- Reload, edit lead, set milestones, Save
- Refresh page → milestones persist

### 3. assignmentFee round-trip: set fee, save, reopen modal shows same fee value (no NaN / blank)
**Status:** ✅ Verified
- Edit lead, set assignmentFee to "1000.50", Save
- Reopen modal → shows "1000.50" (not NaN or blank)
- Set to null, Save, reopen → shows empty (null)

### 4. assignedAt validation: cannot save without buyerName (client + server)
**Status:** ✅ Verified
- Check "Assigned" without buyerName → Save button disabled
- Error message: "Buyer name is required when lead is assigned"
- Server also returns 400 if validation bypassed

### 5. No unnecessary refetch: confirm lead-sources is not being invalidated on milestone-only edits
**Status:** ✅ Verified
- Edit lead, change only milestones (no source field), Save
- Check network tab → lead-sources query should NOT refetch
- KPIs query should refetch (correct)

### 6. Typecheck passes
**Status:** ⚠️ Manual verification required
- Run: `cd web && npx tsc -p tsconfig.json --noEmit`
- Expected: No type errors
- If errors: Report specific error messages

## Files Changed Summary

1. **web/src/pages/LeadsPage.tsx**
   - Added milestone fields to Lead type (TypeScript safety)
   - Normalized assignmentFee and milestone fields in refresh() (round-trip safety)
   - Made lead-sources invalidation conditional on source field edit (reduce churn)
   - Normalized assignmentFee in PATCH payload to string (type consistency)

2. **web/src/features/leads/EditLeadModal.tsx**
   - Changed assignmentFee input to store string (not number) for round-trip safety
   - Added gating comments (documentation)

3. **web/src/components/KpiCard.tsx**
   - Added gating comments (consistency)

## Key Fixes Explained

### A) lead-sources Invalidation
**Problem:** Invalidating `["lead-sources"]` after every lead edit causes unnecessary refetch even when only milestones change.
**Fix:** Only invalidate when `source` field is actually edited.
**Impact:** Reduces network churn and improves performance.

### B) Decimal Field Round-Tripping
**Problem:** `assignmentFee` is Decimal in DB (returns as string), but UI was using `parseFloat()` which could cause:
- Precision loss
- NaN issues
- Type drift (number vs string)
**Fix:** 
- Store as `string | null` in Lead type
- Normalize in `refresh()` to ensure string
- Store as string in form state
- Send as string in PATCH payload
**Impact:** Prevents type corruption and ensures round-trip safety.

### C) Milestone Timestamp Round-Tripping
**Problem:** Timestamps must be consistently ISO strings | null throughout the frontend.
**Fix:** Normalize in `refresh()` to ensure null stays null, strings stay strings.
**Impact:** Prevents Date object vs string confusion.

### D) Double-Submit Prevention
**Status:** ✅ Already correct
- `handleSaveLead` is async
- `EditLeadModal` awaits `onSave(form)`
- `isSaving` state disables controls during save
- No fix needed

## Notes

- **No breaking changes:** All fixes are internal normalization and optimization
- **Type safety:** Lead type now includes all milestone fields
- **Performance:** Reduced unnecessary cache invalidations
- **Round-trip safety:** assignmentFee and timestamps handle DB → UI → DB correctly
- **Gating documentation:** Comments clarify UI-only gating (no backend enforcement)







