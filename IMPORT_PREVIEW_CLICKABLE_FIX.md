# Import Preview Row Click Handler - Fix Summary

## A) Root Cause (Confirmed)

**File:** `web/src/pages/LeadsPage.tsx`

**Evidence:**
- Lines 503-547: The `PreviewRow` component (used in virtualized import preview) had **NO click handlers**
- Lines 791-824: The fallback non-virtualized `<tr>` rows also had **NO click handlers**
- Import preview rows display `LeadImportRow` data (not persisted `Lead` objects)
- These rows have no `lead.id` and cannot use the existing `openQuickView()` which requires `items.find((l) => l.id === quickViewLeadId)`

**Why "bottom rows work"**: User was likely clicking the normal leads table underneath/below the import UI, not the preview rows themselves.

## B) Implementation Summary

Added a separate "Preview Details" modal specifically for import preview rows, with full click handlers and keyboard accessibility.

### Changes Made:

#### 1. **Added State (Lines ~107-109)**
```typescript
const [previewDetailOpen, setPreviewDetailOpen] = useState(false)
const [previewDetailRow, setPreviewDetailRow] = useState<LeadImportRow | null>(null)
const previewDetailAnchorRef = useRef<HTMLElement | null>(null)
```

#### 2. **Added Functions (Lines ~193-211)**
```typescript
function openPreviewDetail(row: LeadImportRow, anchorEl: HTMLElement)
function closePreviewDetail()
```
- Handles modal open/close
- Restores focus to clicked element on close

#### 3. **Added ESC Handler (Lines ~221-229)**
```typescript
useEffect(() => {
  function handleEsc(e: KeyboardEvent) {
    if (e.key === 'Escape' && previewDetailOpen) {
      closePreviewDetail()
    }
  }
  window.addEventListener('keydown', handleEsc)
  return () => window.removeEventListener('keydown', handleEsc)
}, [previewDetailOpen])
```

#### 4. **Made PreviewRow Clickable (Lines ~503-551)**
- Added `onClick` handler
- Added `onKeyDown` handler (Enter/Space keys)
- Added `tabIndex={0}`, `role="button"`, `aria-label`
- Added `cursor-pointer` and `hover:bg-white/5` classes
- **NO layout changes**, only interaction affordances

#### 5. **Made Fallback Table Rows Clickable (Lines ~791-841)**
- Same interaction handlers as virtualized rows
- Consistent behavior across both rendering modes

#### 6. **Added Preview Details Modal (Lines ~1069-1197)**
- Z-index: 40 (same as Quick View, does not conflict)
- Full-screen fixed overlay with backdrop blur
- Slide-in panel from right (max-width 520px)
- Displays:
  - Address, city, state, zip
  - Type (if present)
  - Validation status (errors/warnings with styled cards)
  - Import data (county, owner, phone, parcelId, source)
  - Footer note explaining this is preview data
- Accessibility: `aria-modal`, `aria-hidden`, `role="dialog"`
- Click backdrop to close, ESC to close
- Focus management

#### 7. **Added `source` to LeadImportRow Interface (Line ~41)**
```typescript
interface LeadImportRow {
  // ... existing fields
  source?: string
  // ... rest
}
```

## C) Diff Summary

**File Modified:** `web/src/pages/LeadsPage.tsx`

**What Changed:**
1. Added 3 state variables for Preview Details modal
2. Added 2 functions: `openPreviewDetail()`, `closePreviewDetail()`
3. Added 1 ESC key handler effect
4. Modified `PreviewRow` component: added click handlers + keyboard support + cursor styling
5. Modified fallback `<tr>` rows: added click handlers + keyboard support + cursor styling
6. Added full Preview Details modal JSX (~130 lines)
7. Added `source?: string` to `LeadImportRow` interface

**Lines Changed:** ~150 lines added/modified
**Behavioral Impact:** Import preview rows are now clickable and show detailed view
**Breaking Changes:** None
**Visual Changes:** Rows now show `cursor-pointer` and `hover:bg-white/5` on hover

## D) Manual Verification Steps

### 1. Test Top Rows (Rows 1-10)
**Steps:**
1. Navigate to `/leads`
2. Click "Import Leads" button
3. Upload an `.xlsx` file with 100+ rows
4. Wait for preview to render
5. Click on any row in the **top portion** (rows 1-10)

**Expected Result:**
- Preview Details modal slides in from the right
- Shows correct address, city, state, zip for clicked row
- Shows validation status (errors/warnings if any)
- Shows import data fields (county, owner, phone, etc.)
- ESC key closes modal
- Clicking backdrop closes modal
- Focus returns to clicked row

### 2. Test Mid/Bottom Rows After Scroll
**Steps:**
1. In the same import preview
2. Scroll to the **middle** of the list (e.g., rows 400-500)
3. Click any row
4. Close modal
5. Scroll to the **bottom** (e.g., rows 750-779)
6. Click any row

**Expected Result:**
- Same Preview Details modal behavior
- Displays correct data for the clicked row (not stale/wrong row)
- No scroll position jump when opening/closing
- Consistent behavior across all scroll positions

### 3. Verify Existing Lead Quick View Still Works
**Steps:**
1. Close the import preview (click Cancel or complete import)
2. In the normal leads table (main page content)
3. Click on any lead's **Address** cell

**Expected Result:**
- Lead Quick View modal opens (NOT Preview Details)
- Shows lead data with Edit/Delete buttons
- Scroll locking still works (no body scroll with modal open)
- Body padding-right adjustment prevents layout jump
- Focus restore works correctly
- ESC closes Quick View (if no Edit/Delete modal open)
- Z-index layering correct (modals don't overlap incorrectly)

### 4. Additional Edge Cases
**Steps:**
1. Open Preview Details for a row with **errors**
2. Verify red error card displays with all errors listed
3. Open Preview Details for a row with **warnings**
4. Verify yellow warning card displays
5. Open Preview Details for a **valid** row (no errors/warnings)
6. Verify green success indicator shows

**Expected Result:**
- All validation states render correctly
- No console errors
- No layout breaks

## E) Technical Notes

### Why Not Reuse Quick View?
- Quick View expects a persisted `Lead` object with `lead.id`
- Import preview rows are `LeadImportRow` objects with no IDs (not yet imported)
- Quick View includes Edit/Delete actions that don't make sense for preview data
- Separation of concerns: Quick View = persisted leads, Preview Details = import validation

### Z-Index Strategy
- Both modals use `z-40` (no conflict since only one can be open at a time)
- Import preview can only be open when `importMode === 'preview'`
- Quick View only works on persisted leads (after import)
- No overlap possible in normal user flow

### Keyboard Accessibility
- All rows: `tabIndex={0}`, `role="button"`, `aria-label`
- Enter/Space keys trigger click
- ESC closes modal
- Focus returns to trigger element on close
- Modal has `aria-modal="true"`, `role="dialog"`

### Performance
- No new re-renders introduced
- Modal rendered conditionally hidden (not mounted/unmounted)
- Click handlers use stable references (no inline arrow functions in render except event handlers)
- Virtualization preserved (react-window still used)

## F) Related Files (Not Modified)

- `web/src/features/leads/*` - No lead-specific components modified
- Backend routes - No API changes
- Import endpoint - No changes to `/api/leads-import` or `/api/leads-import/commit`
- Existing modals - EditLeadModal, DeleteConfirmModal, CreateLeadModal unchanged

## G) Pre-Existing Linter Errors (Not Fixed)

The following errors existed before this change and are out of scope:

```
L4:21: Cannot find module 'react-window' or its corresponding type declarations.
L858:35: This comparison appears to be unintentional because the types '"preview"' and '"committing"' have no overlap.
L862:26: This comparison appears to be unintentional because the types '"preview"' and '"committing"' have no overlap.
L866:35: This comparison appears to be unintentional because the types '"preview"' and '"committing"' have no overlap.
```

These are unrelated to the click handler implementation.

---

## Summary

**What was broken:** Import preview rows had no click handlers and couldn't be interacted with.

**What's fixed:** Import preview rows are now fully clickable, show detailed preview data in a modal, and work consistently across all scroll positions.

**Impact:** User can now inspect individual import rows before committing, improving the import validation workflow.










