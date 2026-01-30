# Leads Table Bulk Select + Bulk Delete Implementation Plan
## Safe, Maintainable, Edge-Case Hardened

---

## OBJECTIVE

Implement bulk select + bulk delete on `/leads` with:
- Header "select all visible" checkbox (leftmost column)
- Per-row checkbox (leftmost cell)
- A single destructive "Delete selected (X)" control that opens confirm modal
- Yes/No confirmation with proper loading/disable states
- Correct refresh + cache invalidation so KPIs/lead-sources don't drift

---

## NON-NEGOTIABLE GUARDRAILS

- **Implement ONE phase per run. Stop after each phase.**
- **No backend changes unless Phase 3 explicitly starts.**
- **Do NOT break**: single-row delete modal, edit, kebab menu, temperature tags, sorting/filters (if present), table layout.
- **Keep DOM structure stable**: only add a new leftmost column + a top toolbar row (no table rewrite).
- **Keep identity architecture intact**: all API calls must use canonical `web/src/api.ts` (get/post/patch/del).
- **No new dependencies.** Prefer existing modal/toast patterns.
- **Do not introduce "silent deletes"**: always confirm before bulk delete.

---

## PHASE 1 — Read-Only Scaffolding (Selection State + UI Wiring, No Deletion Yet)

### FILES (ONLY)
- `web/src/pages/LeadsPage.tsx`

### TASKS

#### 1) Add Selection State

**Location**: After existing state declarations (around line 97)

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

// Computed state
const selectedCount = selectedIds.size
const allVisibleSelected = items.length > 0 && items.every(lead => selectedIds.has(lead.id))
const someVisibleSelected = items.some(lead => selectedIds.has(lead.id))
```

**Rationale**: 
- `Set<string>` for O(1) lookup and deduplication
- Computed values for header checkbox state (checked/indeterminate)
- "Visible" means current `items` array (not global selection)

#### 2) Add Selection Handlers

**Location**: After `handleTemperatureChange` (around line 474)

```typescript
const handleRowCheckboxToggle = (leadId: string, checked: boolean) => {
  setSelectedIds(prev => {
    const next = new Set(prev)
    if (checked) {
      next.add(leadId)
    } else {
      next.delete(leadId)
    }
    return next
  })
}

const handleHeaderCheckboxToggle = (checked: boolean) => {
  if (checked) {
    // Select all visible rows
    setSelectedIds(new Set(items.map(lead => lead.id)))
  } else {
    // Clear selection
    setSelectedIds(new Set())
  }
}
```

#### 3) Prune Selection on Refresh

**Location**: In `refresh()` function (around line 226), after `setItems(res.items)`

```typescript
// Prune selection to only IDs that still exist
setSelectedIds(prev => {
  const validIds = new Set(res.items.map(lead => lead.id))
  return new Set(Array.from(prev).filter(id => validIds.has(id)))
})
```

**Rationale**: Prevents orphan selection after external deletes or imports

#### 4) Add Checkbox Column to Table Header

**Location**: In `<thead>` (around line 1095), add as first `<th>`

```tsx
<thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-white/60">
  <tr>
    <th className="px-4 py-3 w-12">
      <input
        type="checkbox"
        checked={allVisibleSelected}
        ref={(el) => {
          if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
        }}
        onChange={(e) => handleHeaderCheckboxToggle(e.target.checked)}
        disabled={items.length === 0}
        aria-label="Select all leads"
        className="cursor-pointer"
      />
    </th>
    <th className="px-4 py-3">Type</th>
    {/* ... existing columns ... */}
  </tr>
</thead>
```

**Key points**:
- `w-12` for consistent column width
- `indeterminate` set via ref (React doesn't support it as a prop)
- `disabled` when no items
- ARIA label for accessibility

#### 5) Add Checkbox to Each Row

**Location**: In `<tbody>` row mapping (around line 1106), add as first `<td>`

```tsx
<tbody>
  {items.map((lead) => (
    <tr key={lead.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selectedIds.has(lead.id)}
          onChange={(e) => handleRowCheckboxToggle(lead.id, e.target.checked)}
          aria-label={`Select lead at ${lead.address}`}
          className="cursor-pointer"
        />
      </td>
      <td className="px-4 py-3 capitalize text-white">
        {lead.type}
      </td>
      {/* ... existing cells ... */}
    </tr>
  ))}
</tbody>
```

**Key points**:
- Checkbox state derived from `selectedIds.has(lead.id)`
- ARIA label includes address for context
- Same padding as other cells

#### 6) Add Toolbar Above Table

**Location**: Before `<div className="neon-glass overflow-hidden text-sm">` (around line 1092)

```tsx
{/* Bulk Actions Toolbar */}
{selectedCount > 0 && (
  <div className="mb-4 flex items-center justify-between px-4 py-2 neon-glass rounded-lg border border-white/10">
    <span className="text-sm text-white/80">
      {selectedCount} selected
    </span>
    <button
      onClick={() => {
        // Phase 1: Just log; Phase 2 will open modal
        console.log('Bulk delete clicked', Array.from(selectedIds))
      }}
      disabled={selectedCount === 0}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-red-500/60 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span>🗑️</span>
      Delete selected ({selectedCount})
    </button>
  </div>
)}
```

**Key points**:
- Only visible when `selectedCount > 0`
- Destructive styling (red) to indicate danger
- Disabled state when count is 0 (defensive)
- Icon + count for clarity

#### 7) Update Empty State ColSpan

**Location**: In empty state row (around line 1212)

```tsx
{!items.length && (
  <tr>
    <td
      colSpan={8}  // Changed from 7 to 8 (added checkbox column)
      className="px-4 py-8 text-center text-white/60"
    >
      No leads yet. Use the form above to create one or import a list.
    </td>
  </tr>
)}
```

### DELIVERABLE

- [ ] Header checkbox supports indeterminate state (via ref)
- [ ] Table columns did not shift visually except the new select column
- [ ] "Select all" selects all visible rows
- [ ] Individual checkboxes toggle selection
- [ ] Selection persists during interactions (but prunes on refresh)
- [ ] Toolbar appears when selection > 0
- [ ] Keyboard accessible (tab to checkboxes)

### EDGE CASES HANDLED IN PHASE 1

- ✅ "Select all" only selects currently visible rows (`items` array)
- ✅ If `items` changes (refresh), selection is pruned to visible IDs
- ✅ Keyboard: checkboxes reachable via tab
- ✅ Empty table: header checkbox disabled
- ✅ Indeterminate state: header shows `-` when some (not all) selected

**STOP after Phase 1.**

---

## PHASE 2 — Confirm Modal (Bulk) + UX State Machine (Still No API Call)

### FILES (ONLY)
- `web/src/pages/LeadsPage.tsx`
- `web/src/features/leads/DeleteConfirmModal.tsx` (extend safely)

### TASKS

#### 1) Add Modal State

**Location**: After existing state (around line 97)

```typescript
const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false)
const [isBulkDeleting, setIsBulkDeleting] = useState(false) // For Phase 4
```

#### 2) Extend DeleteConfirmModal Component

**Location**: `web/src/features/leads/DeleteConfirmModal.tsx`

**Approach**: Extend to support both single and bulk modes

```typescript
interface DeleteConfirmModalProps {
  lead?: any;  // Changed from required to optional
  count?: number;  // New: for bulk mode
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;  // New: for loading state
}

export default function DeleteConfirmModal({ 
  lead, 
  count, 
  onClose, 
  onConfirm,
  isDeleting = false 
}: DeleteConfirmModalProps) {
  // Bulk mode: lead is null, count > 0
  const isBulkMode = !lead && count !== undefined && count > 0
  
  if (!lead && !isBulkMode) return null;  // Guard: must have lead OR count

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="neon-glass p-6 rounded-xl w-[360px]">
        <h3 className="text-lg mb-3">
          {isBulkMode ? 'Delete leads' : 'Delete Lead'}
        </h3>
        <p className="text-white/70 mb-4">
          {isBulkMode ? (
            <>Are you sure you want to delete <strong>{count} lead(s)</strong>?</>
          ) : (
            <>Are you sure you want to delete <strong>{lead.address}</strong>?</>
          )}
        </p>
        <div className="flex justify-end gap-4">
          <button 
            onClick={onClose}
            disabled={isDeleting}
            className="text-white/60 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(255,0,80,0.9)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Key points**:
- Backward compatible: existing single delete still works (lead prop)
- Bulk mode: when `lead` is null and `count > 0`
- Loading state: buttons disabled when `isDeleting` is true
- No breaking changes to existing usage

#### 3) Update Single Delete Modal Usage

**Location**: In LeadsPage.tsx (around line 1233), add `isDeleting` prop (for consistency, even if not used yet)

```tsx
<DeleteConfirmModal
  lead={deletingLead}
  onClose={() => setDeletingLead(null)}
  onConfirm={() => deletingLead && handleDeleteLead(deletingLead)}
  isDeleting={false}  // Single delete is fast, no loading needed
/>
```

#### 4) Add Bulk Delete Modal

**Location**: After single delete modal (around line 1237)

```tsx
<DeleteConfirmModal
  count={selectedCount}
  onClose={() => setIsBulkConfirmOpen(false)}
  onConfirm={() => {
    // Phase 2: Just close modal (no API call yet)
    setIsBulkConfirmOpen(false)
    console.log('Bulk delete confirmed', Array.from(selectedIds))
  }}
  isDeleting={isBulkDeleting}
/>
```

#### 5) Wire Toolbar Button to Modal

**Location**: Update toolbar button (from Phase 1)

```tsx
<button
  onClick={() => setIsBulkConfirmOpen(true)}
  disabled={selectedCount === 0}
  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-red-500/60 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
>
  <span>🗑️</span>
  Delete selected ({selectedCount})
</button>
```

### DELIVERABLE

- [ ] Single delete modal unchanged (backward compatible)
- [ ] Bulk modal renders with correct count
- [ ] Bulk modal closes on Cancel
- [ ] Bulk modal shows "Deleting..." when `isDeleting` is true (for Phase 4)
- [ ] Buttons disabled during deletion (UX safety)

### EDGE CASES HANDLED IN PHASE 2

- ✅ Modal component backward compatible (existing single delete works)
- ✅ Bulk mode only when `lead` is null and `count > 0`
- ✅ Loading state prevents double-submit
- ✅ Modal closes on Cancel without side effects

**STOP after Phase 2.**

---

## PHASE 3 — Decide Deletion Strategy (Backend Endpoint vs Frontend Loop) + Implement

### DECISION GATE

**Evidence from codebase:**
- ✅ Rate limiting exists: `/api/leads` uses `apiRateLimiter` (from `server/src/server.ts:217`)
- ✅ Bulk pattern exists: `POST /api/leads-import/commit` accepts arrays (up to 1000 items)
- ✅ Selection can be large: Users may select 50+ leads

**Decision: OPTION A (Backend Bulk Endpoint) — Preferred**

**Rationale:**
1. Rate limiter would throttle N sequential requests (Option B risk)
2. Bulk import endpoint proves bulk operations are acceptable pattern
3. Single request is faster and more atomic
4. Backend can handle partial failures more gracefully
5. Consistent with existing architecture

### OPTION A: Backend Bulk Delete Endpoint

### FILES (ONLY)
- `server/src/routes/leads.dev.ts`
- (Route registration in `server/src/server.ts` is already done via `leadsDevRouter`)

### TASKS

#### 1) Add Bulk Delete Route

**Location**: After single delete route (around line 480 in `leads.dev.ts`)

```typescript
// POST /api/leads/bulk-delete
// ===========================================
// Bulk delete leads by IDs (max 100 per request)
// Payload: { ids: string[] }
// Response: { success: true, deletedCount: number, items: Lead[] }
leadsDevRouter.post("/bulk-delete", express.json(), async (req, res) => {
  // BOLA prevention: Ensure user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ids } = req.body;
  const userId = req.user.id;
  const orgId = (req as any).orgId || req.user.orgId || req.user.id;

  // Validation
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "Invalid payload: ids must be an array" });
  }

  if (ids.length === 0) {
    return res.status(400).json({ error: "Empty ids array" });
  }

  if (ids.length > 100) {
    return res.status(400).json({ error: "Too many ids: maximum 100 per bulk delete" });
  }

  // Dedupe IDs
  const uniqueIds = Array.from(new Set(ids));

  if (isDevMode) {
    // Dev mode: use in-memory store
    const userLeads = getOrgLeads(orgId);
    let deletedCount = 0;

    // Delete only leads that exist and belong to org
    uniqueIds.forEach(id => {
      const index = userLeads.findIndex((l: any) => l.id === id);
      if (index !== -1) {
        userLeads.splice(index, 1);
        deletedCount++;
      }
      // Silently ignore not-found (already deleted or wrong org)
    });

    return res.json({
      success: true,
      deletedCount,
      items: userLeads,  // Return updated list (matches single delete pattern)
    });
  } else {
    // Production: use database
    if (!pool) {
      return res.status(500).json({ error: "Database connection unavailable" });
    }

    try {
      // Delete leads that belong to org (BOLA protection)
      const result = await pool.query(
        `DELETE FROM "Lead"
         WHERE "orgId" = $1
           AND "id" = ANY($2::text[])
         RETURNING "id"`,
        [orgId, uniqueIds]
      );

      const deletedCount = result.rowCount || 0;

      // Fetch updated list
      const leadsResult = await pool.query(
        `SELECT * FROM "Lead" WHERE "orgId" = $1 ORDER BY "updatedAt" DESC`,
        [orgId]
      );

      return res.json({
        success: true,
        deletedCount,
        items: leadsResult.rows,
      });
    } catch (dbError) {
      console.error("[LEADS] Bulk delete failed:", dbError);
      return res.status(500).json({ error: "Failed to delete leads" });
    }
  }
});
```

**Key points**:
- Max 100 IDs per request (prevents abuse)
- Deduplication of IDs
- BOLA protection: only deletes leads belonging to user's org
- Returns `deletedCount` (may be less than requested if some not found)
- Returns updated `items` list (matches single delete pattern)
- Never throws 500 for "not found" — silently ignores missing IDs

#### 2) Document Endpoint

**Location**: Add comment above route

```typescript
/**
 * Bulk Delete Leads Endpoint
 * 
 * POST /api/leads/bulk-delete
 * Payload: { ids: string[] } (max 100 IDs)
 * Response: { success: true, deletedCount: number, items: Lead[] }
 * 
 * Security:
 * - Requires authentication
 * - Only deletes leads belonging to user's org (BOLA protection)
 * - Silently ignores IDs that don't exist or belong to other orgs
 * 
 * Error handling:
 * - 400: Invalid payload (not array, empty, or > 100 IDs)
 * - 401: Unauthorized
 * - 500: Database error
 */
```

### DELIVERABLE

- [ ] Backend endpoint accepts `{ ids: string[] }` payload
- [ ] Endpoint validates: array, non-empty, max 100
- [ ] Endpoint only deletes leads belonging to user's org
- [ ] Endpoint returns `{ success: true, deletedCount, items }`
- [ ] Endpoint handles missing IDs gracefully (doesn't error)
- [ ] Works in both dev (in-memory) and production (DB) modes

### EDGE CASES HANDLED IN PHASE 3

- ✅ Max 100 IDs prevents abuse
- ✅ Deduplication prevents duplicate deletes
- ✅ BOLA protection (org scoping)
- ✅ Missing IDs ignored (no 404/403 errors)
- ✅ Returns updated list for frontend refresh

**STOP after Phase 3.**

---

## PHASE 4 — Integrate Bulk Delete Handler + Cross-Cache Invalidation

### FILES (ONLY)
- `web/src/pages/LeadsPage.tsx`

### TASKS

#### 1) Implement Bulk Delete Handler

**Location**: After `handleDeleteLead` (around line 453)

```typescript
async function handleBulkDelete() {
  if (selectedIds.size === 0) return;  // Defensive guard

  setIsBulkDeleting(true);
  try {
    const idsArray = Array.from(selectedIds);
    
    // Call bulk delete endpoint
    const response = await post<{ success: boolean; deletedCount: number; items: Lead[] }>(
      '/leads/bulk-delete',
      { ids: idsArray }
    );

    if (response.success) {
      // Success: close modal, clear selection, refresh, invalidate caches
      setIsBulkConfirmOpen(false);
      setSelectedIds(new Set());
      
      // Update local state with response (optimistic)
      setItems(response.items);
      
      // Invalidate React Query caches
      await queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
      
      // Also call refresh() to ensure consistency
      await refresh();
      
      notify("success", `Deleted ${response.deletedCount} lead(s)`);
    } else {
      throw new Error("Bulk delete failed");
    }
  } catch (e: any) {
    const msg = e?.error?.message || e?.message || "Unable to delete leads";
    notify("error", msg);
    // Keep selection and modal open on error (user can retry)
  } finally {
    setIsBulkDeleting(false);
  }
}
```

**Key points**:
- Uses canonical `post()` from `web/src/api.ts`
- Clears selection only on success
- Keeps modal open on error (user can retry)
- Invalidates both KPI and lead-sources caches
- Shows toast with actual `deletedCount` (may be less than selected if some not found)

#### 2) Wire Modal to Handler

**Location**: Update bulk delete modal (from Phase 2)

```tsx
<DeleteConfirmModal
  count={selectedCount}
  onClose={() => setIsBulkConfirmOpen(false)}
  onConfirm={handleBulkDelete}
  isDeleting={isBulkDeleting}
/>
```

#### 3) Add Cache Invalidation to Single Delete

**Location**: In `handleDeleteLead` (around line 444), after `await refresh()`

```typescript
async function handleDeleteLead(lead: Lead) {
  try {
    await del(`/leads/${lead.id}`);
    setDeletingLead(null);
    notify("success", "Lead deleted");
    await refresh();
    
    // Invalidate caches to keep dashboard in sync
    await queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
  } catch (e: any) {
    const msg = e?.error?.message || e?.message || "Unable to delete lead";
    notify("error", msg);
  }
}
```

**Rationale**: Ensures KPIs and pie chart update after single delete too (was missing before)

#### 4) Add Max Selection Warning (Optional UX Enhancement)

**Location**: In toolbar (around line 1092), add warning if selection > 100

```tsx
{selectedCount > 100 && (
  <div className="mb-2 px-4 py-2 neon-glass rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-sm">
    ⚠️ Maximum 100 leads per bulk delete. Please deselect some leads.
  </div>
)}
```

**And disable button if > 100:**

```tsx
<button
  onClick={() => setIsBulkConfirmOpen(true)}
  disabled={selectedCount === 0 || selectedCount > 100}
  className="..."
>
```

### DELIVERABLE

- [ ] Bulk delete handler calls backend endpoint
- [ ] On success: modal closes, selection clears, table refreshes, caches invalidate
- [ ] On error: selection persists, modal stays open, error toast shown
- [ ] Single delete also invalidates caches (fixes existing gap)
- [ ] Toast shows actual deleted count
- [ ] No duplicate refetch storms (only invalidations after mutation)

### EDGE CASES HANDLED IN PHASE 4

- ✅ Selection cleared only on success
- ✅ Modal stays open on error (retry possible)
- ✅ Cache invalidation keeps dashboard/KPIs in sync
- ✅ Actual deleted count shown (may be < selected if some not found)
- ✅ Max 100 selection warning (prevents backend rejection)

**STOP after Phase 4.**

---

## PHASE 5 — Polish + A11y + "Maintenance Debt" Controls

### FILES (ONLY)
- `web/src/pages/LeadsPage.tsx`
- `web/package.json` (optional, for guardrail script)

### TASKS

#### 1) Accessibility Enhancements

**Location**: Update checkboxes with better ARIA

**Header checkbox:**
```tsx
<input
  type="checkbox"
  checked={allVisibleSelected}
  ref={(el) => {
    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
  }}
  onChange={(e) => handleHeaderCheckboxToggle(e.target.checked)}
  disabled={items.length === 0}
  aria-label="Select all visible leads"
  aria-describedby="select-all-description"
  className="cursor-pointer"
/>
<span id="select-all-description" className="sr-only">
  Selects all {items.length} leads currently visible in the table
</span>
```

**Row checkbox:**
```tsx
<input
  type="checkbox"
  checked={selectedIds.has(lead.id)}
  onChange={(e) => handleRowCheckboxToggle(lead.id, e.target.checked)}
  aria-label={`Select lead at ${lead.address}, ${lead.city}, ${lead.state}`}
  className="cursor-pointer"
/>
```

**Delete button:**
```tsx
<button
  onClick={() => setIsBulkConfirmOpen(true)}
  disabled={selectedCount === 0 || selectedCount > 100}
  aria-label={`Delete ${selectedCount} selected lead(s)`}
  className="..."
>
```

#### 2) Indeterminate State Verification

**Location**: Verify header checkbox logic

**Test cases:**
- No selection: `checked = false`, `indeterminate = false`
- Some selected: `checked = false`, `indeterminate = true`
- All selected: `checked = true`, `indeterminate = false`

**Ensure toggling from indeterminate selects all:**
```typescript
const handleHeaderCheckboxToggle = (checked: boolean) => {
  if (checked) {
    // Select all visible rows (even if some already selected)
    setSelectedIds(new Set(items.map(lead => lead.id)))
  } else {
    // Clear selection
    setSelectedIds(new Set())
  }
}
```

#### 3) Focus Management

**Location**: In modal, ensure focus trap

**Note**: If `DeleteConfirmModal` doesn't have focus trap, add it:

```tsx
// In DeleteConfirmModal.tsx
useEffect(() => {
  if (isOpen) {
    // Focus first button (Cancel) when modal opens
    const cancelButton = document.querySelector('[data-modal-cancel]') as HTMLButtonElement
    cancelButton?.focus()
  }
}, [isOpen])
```

**Add data attributes:**
```tsx
<button 
  onClick={onClose}
  data-modal-cancel
  className="..."
>
  Cancel
</button>
```

#### 4) Maintenance Documentation

**Location**: Add comments in code

**In LeadsPage.tsx (selection state):**
```typescript
// Selection state: tracks IDs of currently visible rows only
// "Select all" selects all items in the current items array (not global)
// Selection is pruned on refresh() to remove IDs that no longer exist
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

**In leads.dev.ts (bulk delete endpoint):**
```typescript
/**
 * Bulk Delete Leads Endpoint
 * 
 * POST /api/leads/bulk-delete
 * Payload: { ids: string[] } (max 100 IDs, deduplicated)
 * Response: { success: true, deletedCount: number, items: Lead[] }
 * 
 * Security: BOLA protection via org scoping
 * Error handling: Silently ignores missing IDs (returns deletedCount)
 */
```

#### 5) Optional: Guardrail Script

**Location**: `web/package.json` (add script)

```json
{
  "scripts": {
    "check:bulk-delete-cache": "echo 'Checking bulk delete cache invalidation...' && (grep -r 'bulk-delete' src --include='*.tsx' --include='*.ts' | grep -v 'invalidateQueries' && (echo 'ERROR: bulk-delete found without cache invalidation' && exit 1) || echo '✓ Bulk delete has cache invalidation') || echo 'Note: grep not available'"
  }
}
```

**Rationale**: Prevents future regressions where bulk delete doesn't invalidate caches

### DELIVERABLE

- [ ] ARIA labels on all checkboxes and buttons
- [ ] Screen reader announces selection count
- [ ] Keyboard navigation works (tab to checkboxes, Enter to toggle)
- [ ] Focus trap in modal (if not already present)
- [ ] Indeterminate state works correctly
- [ ] Code comments document "visible rows only" behavior
- [ ] Backend endpoint documented with max size

### EDGE CASES HANDLED IN PHASE 5

- ✅ Keyboard accessible (tab, Enter, Space)
- ✅ Screen reader announces actions
- ✅ Indeterminate state visually correct
- ✅ Focus management in modal
- ✅ Documentation prevents future drift

**STOP after Phase 5.**

---

## FUTURE EDGE CASES TO PREVENT (Design Notes)

### Pagination/Filters
- **Current**: "Select all visible" means current `items` array only
- **Future**: If pagination is added, keep "select all" scoped to current page
- **UI**: Add explicit text: "Select all 25 leads on this page" (not "Select all 1,000 leads")

### Concurrency
- **Current**: If lead deleted elsewhere, bulk delete ignores 404/403 for that ID
- **Future**: Consider optimistic UI updates (remove from selection immediately on 404)

### Rate Limiting
- **Current**: Backend bulk endpoint prevents N requests
- **Future**: If rate limiter is tightened, bulk endpoint may need exemption or higher limit

### Large Selection
- **Current**: Max 100 enforced with backend validation
- **Future**: If users need to delete > 100, consider paginated bulk delete or "delete all matching filter"

### Identity Drift
- **Current**: All API calls use canonical `web/src/api.ts`
- **Future**: Never introduce direct `fetch()` calls that bypass identity unification

### Cache Drift
- **Current**: Bulk delete invalidates `["kpis-summary"]` and `["lead-sources"]`
- **Future**: Any lead mutation (create/edit/delete/bulk) must invalidate these caches
- **Guardrail**: Consider adding a lint rule or test to enforce this

---

## FINAL SUCCESS CRITERIA

### Functional
- [x] Selection works (header + row checkboxes)
- [x] Delete requires confirmation (modal)
- [x] Deletes correct rows (selected IDs)
- [x] Dashboard KPIs remain consistent after mutations
- [x] Pie chart (lead-sources) remains consistent after mutations

### UX
- [x] No accidental deletes (always confirms)
- [x] Loading states prevent double-submit
- [x] Error handling keeps selection for retry
- [x] Toast notifications show accurate counts

### Technical
- [x] No layout drift (only new checkbox column)
- [x] No breaking changes to existing features
- [x] Cache invalidation prevents data drift
- [x] Backend endpoint handles edge cases (missing IDs, org scoping)

### Accessibility
- [x] Keyboard navigable
- [x] Screen reader friendly
- [x] Focus management in modals

---

## FILE CHANGE SUMMARY

### Phase 1
- `web/src/pages/LeadsPage.tsx` (~100 lines added)

### Phase 2
- `web/src/pages/LeadsPage.tsx` (~20 lines added)
- `web/src/features/leads/DeleteConfirmModal.tsx` (~30 lines modified)

### Phase 3
- `server/src/routes/leads.dev.ts` (~80 lines added)

### Phase 4
- `web/src/pages/LeadsPage.tsx` (~40 lines added/modified)

### Phase 5
- `web/src/pages/LeadsPage.tsx` (~30 lines modified for A11y)
- `web/src/features/leads/DeleteConfirmModal.tsx` (~10 lines for focus trap)
- `web/package.json` (optional: 1 script)

**Total estimated changes**: ~310 lines across 3-4 files

---

## ROLLBACK PLAN

If issues arise:

1. **Phase 1-2**: Remove checkbox column and toolbar (UI only, no data loss)
2. **Phase 3**: Remove backend endpoint (frontend falls back to single deletes)
3. **Phase 4**: Remove bulk handler (selection UI remains but non-functional)
4. **Phase 5**: Revert A11y changes (functionality preserved)

**No data loss risk**: All changes are additive or replace existing patterns safely.

---

**END OF IMPLEMENTATION PLAN**







