# Dashboard Geometry Spec v1
## "Top 0.1%" Finish Pass — Mathematical Consistency Plan

---

## 1) Invariant Contract Table (Current Truth)

| Constant | Value | Definition Location | Evidence |
|----------|-------|---------------------|----------|
| **Card Height Baseline** | `280px` (min-height) | `neon.css:52` | `.dashboard-card { min-height: 280px; }` |
| **Card Height Fixed** | `280px` (exact) | `DashboardPage.tsx:12,15` | `h-[280px]` on KpiCard and NeedsAttentionCard wrappers only |
| **Card Padding** | `24px` | `theme.css:65,95` | `--card-padding: 24px` → `var(--dfos-card-pad)` |
| **Card Radius** | `16px` | `theme.css:64,97` | `--card-radius: 16px` → `var(--dfos-radius-xl)` |
| **Card Border** | `1px` | `neon.css:49` | `border: 1px solid var(--glass-border)` |
| **Grid Outer Padding** | `24px` (all sides) | `DashboardPage.tsx:10` | `px-dfos-6 py-dfos-6` = `var(--dfos-space-6)` = 24px |
| **Grid Gap** | `16px` | `DashboardPage.tsx:11` | `gap-dfos-4` = `var(--dfos-space-4)` = 16px |
| **Grid Auto-Rows** | `minmax(280px, auto)` | `neon.css:460` | `.dashboard-grid-container { grid-auto-rows: minmax(280px, auto); }` |
| **Grid Child Min-Height** | `280px` | `neon.css:473` | `.dashboard-grid-container > * { min-height: 280px; }` |
| **Hover TranslateY** | `-2px` | `neon.css:110` | `.dashboard-card:hover { transform: translateY(-2px); }` |
| **Hover Z-Index** | `10` | `neon.css:115` | `.dashboard-card:hover { z-index: 10; }` |
| **Hover Transition** | `0.25s cubic-bezier(0.4, 0, 0.2, 1)` | `neon.css:63` | `transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), ...` |
| **Wrapper Padding Top** | `2px` | `DashboardPage.tsx:12,15` | `pt-[2px]` on KpiCard and NeedsAttentionCard wrappers only |
| **Wrapper Z-Index** | `0` | `DashboardPage.tsx:12,15` | `relative z-0` on KpiCard and NeedsAttentionCard wrappers only |
| **Card Overflow** | `hidden` | `neon.css:55` | `.dashboard-card { overflow: hidden; }` |
| **Card Display** | `flex` (column) | `neon.css:56-57` | `.dashboard-card { display: flex; flex-direction: column; }` |

---

## 2) Geometry Spec v1 (The Desired Perfect Spec)

### A) Outer Card Box Model

| Property | Spec Value | Justification |
|----------|------------|----------------|
| **Height** | **EXACT 280px** (not min-height) | All 6 cards must be identical height for grid alignment |
| **Padding** | `24px` (all sides) | `var(--card-padding)` = `var(--dfos-card-pad)` |
| **Radius** | `16px` | `var(--card-radius)` = `var(--dfos-radius-xl)` |
| **Border** | `1px solid` | `var(--glass-border)` |
| **Overflow** | `hidden` on card root | Maintains glass effect, prevents content spill |
| **Hover Transform** | `translateY(-2px)` | Consistent lift effect |
| **Hover Z-Index** | `10` | Ensures hovered card appears above neighbors |
| **Hover Transition** | `transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Smooth, consistent animation |

### B) Wrapper Policy (Prevent Glow Clipping)

**Decision: Option 1 — Apply wrapper class on every dashboard grid child**

**Rationale:**
- **Evidence**: `DashboardPage.tsx:12,15` already uses `h-[280px] pt-[2px] relative z-0` on 2 cards
- **Less Drift**: Reusing existing pattern is safer than introducing new CSS selectors
- **Fewer Exceptions**: All 6 wrappers will be identical, no per-card logic needed
- **Glow Handling**: `pt-[2px]` provides space for neon glow on hover, `relative z-0` ensures proper stacking

**Spec:**
- **Wrapper Class String**: `h-[280px] pt-[2px] relative z-0`
- **Applied To**: All 6 card wrapper divs in `DashboardPage.tsx`
- **Purpose**: 
  - `h-[280px]`: Enforces exact height (overrides CSS min-height)
  - `pt-[2px]`: Prevents hover glow clipping at top edge
  - `relative z-0`: Establishes stacking context for hover z-index behavior

### C) Internal Slot Rhythm (Mandatory)

**Standardized 3-Slot Pattern:**

| Slot | Min-Height | Flex Behavior | Overflow | Evidence-Based Calculation |
|------|------------|---------------|----------|----------------------------|
| **Header Slot** | `64px` | `flex-shrink: 0` | `visible` | NeonCard: sectionLabel (~20px) + title h2 (~28px) + mb-4 (16px) = ~64px |
| **Content Slot** | `0` (flex-1) | `flex: 1`, `min-h-0` | `overflow-y-auto` (if scrollable) | Must shrink to fit available space |
| **Footer Slot** | `40px` | `flex-shrink: 0` | `visible` | NeedsAttentionCard: mt-4 (16px) + pt-3 (12px) + content (~12px) = ~40px |

**Slot Math:**
- Card height: `280px`
- Card padding (top + bottom): `24px + 24px = 48px`
- Available content height: `280px - 48px = 232px`
- Header: `64px`
- Footer: `40px`
- Content available: `232px - 64px - 40px = 128px` (flexible, can grow if header/footer are smaller)

**Implementation Pattern:**
```css
.dashboard-card {
  /* Outer box model (from Spec A) */
  height: 280px; /* Override min-height */
  padding: 24px;
  /* ... */
}

.dashboard-card-header {
  min-height: 64px;
  flex-shrink: 0;
}

.dashboard-card-content {
  flex: 1;
  min-h-0; /* Critical for flex scrolling */
  overflow-y: auto; /* If scrollable */
}

.dashboard-card-footer {
  min-height: 40px;
  flex-shrink: 0;
}
```

### D) Inner Spacing Rhythm

| Spacing Type | Spec Value | Token | Usage |
|--------------|------------|-------|-------|
| **Row Gap (within cards)** | `12px` | `gap-dfos-3` | Consistent spacing between rows/items |
| **Module Gap (between cards)** | `16px` | `gap-dfos-4` | Grid gap (already correct) |
| **TaskRow Height** | `56px` | `h-[56px] min-h-[56px]` | Standard preview row height (fits 2-3 rows in 128px content area) |

**Calculation:**
- Content area: `128px` (from slot math)
- TaskRow height: `56px`
- Row gap: `12px` (space-y-2 = 8px, but standardize to 12px)
- Fits: `(128px - 12px) / 56px ≈ 2 rows` (with comfortable spacing)

---

## 3) Card-by-Card Compliance Table

| Card | Exact Height? | Wrapper Policy? | Header/Content/Footer? | min-h-0 Correct? | Scroll Region? | Inner Gaps? | Status |
|------|---------------|-----------------|------------------------|-------------------|----------------|-------------|--------|
| **KpiCard** | ✅ Yes (`h-[280px]` wrapper) | ✅ Yes (`pt-[2px] relative z-0`) | ⚠️ Partial (NeonCard header, no explicit footer) | ✅ Yes (line 31) | ❌ No (not needed) | ✅ Yes (`gap-dfos-3`) | **MOSTLY COMPLIANT** |
| **NeedsAttentionCard** | ✅ Yes (`h-[280px]` wrapper) | ✅ Yes (`pt-[2px] relative z-0`) | ✅ Yes (header line 327, content line 369, footer line 519) | ✅ Yes (line 369) | ✅ Yes (line 369) | ⚠️ Partial (`space-y-2` = 8px, should be 12px) | **MOSTLY COMPLIANT** |
| **LeadsOverviewCard** | ❌ No (no wrapper height) | ❌ No (no wrapper classes) | ⚠️ Partial (NeonCard header, no explicit footer) | ❌ No (line 23 missing `min-h-0`) | ❌ No (not needed) | ⚠️ Partial (`gap-4` = 16px, should be 12px) | **NON-COMPLIANT** |
| **ScheduleCard** | ❌ No (no wrapper height) | ❌ No (no wrapper classes) | ⚠️ Partial (NeonCard header, footer line 19) | ❌ No (line 13 missing `min-h-0`) | ❌ No (not needed) | ✅ Yes (`space-y-3` = 12px) | **NON-COMPLIANT** |
| **TodoCard** | ❌ No (no wrapper height) | ❌ No (no wrapper classes) | ⚠️ Partial (NeonCard header, footer line 140) | ❌ No (line 62 missing `min-h-0`) | ❌ No (not needed) | ⚠️ Partial (`space-y-2.5` = 10px, should be 12px) | **NON-COMPLIANT** |
| **ResourcesCard** | ❌ No (no wrapper height) | ❌ No (no wrapper classes) | ⚠️ Partial (NeonCard header, footer line 31) | ❌ No (line 20 missing `min-h-0`) | ❌ No (not needed) | ✅ Yes (`space-y-3` = 12px) | **NON-COMPLIANT** |

**Summary:**
- **Compliant**: 2/6 cards (KpiCard, NeedsAttentionCard)
- **Non-Compliant**: 4/6 cards (LeadsOverviewCard, ScheduleCard, TodoCard, ResourcesCard)

---

## 4) Violation-to-Fix Mapping (Exact File/Line Targets)

### Violation #1: Missing Wrapper Height on 4 Cards
**Impact**: Critical — Cards can grow beyond 280px, breaking grid alignment

| File | Line | Current | Required |
|------|------|---------|----------|
| `web/src/pages/DashboardPage.tsx` | 18 | `<div className="col-span-12 md:col-span-6 xl:col-span-4">` | `<div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] pt-[2px] relative z-0">` |
| `web/src/pages/DashboardPage.tsx` | 21 | `<div className="col-span-12 md:col-span-6 xl:col-span-4">` | `<div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] pt-[2px] relative z-0">` |
| `web/src/pages/DashboardPage.tsx` | 24 | `<div className="col-span-12 md:col-span-6 xl:col-span-4">` | `<div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] pt-[2px] relative z-0">` |
| `web/src/pages/DashboardPage.tsx` | 27 | `<div className="col-span-12 md:col-span-6 xl:col-span-4">` | `<div className="col-span-12 md:col-span-6 xl:col-span-4 h-[280px] pt-[2px] relative z-0">` |

### Violation #2: Missing min-h-0 on Flex Children
**Impact**: High — Flex children may not shrink properly, breaking scroll behavior

| File | Line | Current | Required |
|------|------|---------|----------|
| `web/src/components/LeadsOverviewCard.tsx` | 23 | `<div className="flex-1 flex flex-col justify-center mt-1 space-y-4">` | `<div className="flex-1 min-h-0 flex flex-col justify-center mt-1 space-y-4">` |
| `web/src/components/ScheduleCard.tsx` | 13 | `<div className="space-y-3 flex-1 flex items-center justify-center">` | `<div className="space-y-3 flex-1 min-h-0 flex items-center justify-center">` |
| `web/src/components/TodoCard.tsx` | 62 | `<div className="space-y-2.5 flex-1">` | `<div className="space-y-2.5 flex-1 min-h-0">` |
| `web/src/components/ResourcesCard.tsx` | 20 | `<div className="space-y-3 flex-1">` | `<div className="space-y-3 flex-1 min-h-0">` |

### Violation #3: Inconsistent Inner Gap Values
**Impact**: Medium — Visual rhythm inconsistency

| File | Line | Current | Required | Token |
|------|------|---------|----------|-------|
| `web/src/components/NeedsAttentionCard.tsx` | 376 | `space-y-2` (8px) | `space-y-3` (12px) | `gap-dfos-3` |
| `web/src/components/LeadsOverviewCard.tsx` | 36 | `gap-4` (16px) | `gap-3` (12px) | `gap-dfos-3` |
| `web/src/components/TodoCard.tsx` | 62 | `space-y-2.5` (10px) | `space-y-3` (12px) | `gap-dfos-3` |

### Violation #4: Card Height Uses min-height Instead of height
**Impact**: Medium — Cards can grow beyond 280px if content overflows

| File | Line | Current | Required |
|------|------|---------|----------|
| `web/src/styles/neon.css` | 52 | `min-height: 280px;` | `height: 280px;` (or keep min-height but enforce via wrapper) |

**Note**: Since we're enforcing height via wrapper `h-[280px]`, we can keep `min-height: 280px` in CSS as a fallback, but the wrapper takes precedence.

### Violation #5: NeedsAttentionCard Row Gap Inconsistency
**Impact**: Low — Minor visual inconsistency

| File | Line | Current | Required |
|------|------|---------|----------|
| `web/src/components/NeedsAttentionCard.tsx` | 376 | `space-y-2` (8px) | `space-y-3` (12px) |

---

## 5) Phased Implementation Plan (G1–G4)

### Phase G1: Dashboard Wrapper Normalization
**Goal**: Unify all 6 wrappers to identical height + glow-safe classes

**Changes:**
1. **File**: `web/src/pages/DashboardPage.tsx`
   - **Line 18**: Add `h-[280px] pt-[2px] relative z-0` to LeadsOverviewCard wrapper
   - **Line 21**: Add `h-[280px] pt-[2px] relative z-0` to ScheduleCard wrapper
   - **Line 24**: Add `h-[280px] pt-[2px] relative z-0` to TodoCard wrapper
   - **Line 27**: Add `h-[280px] pt-[2px] relative z-0` to ResourcesCard wrapper

**Verification:**
- All 6 wrapper divs have identical className pattern
- Grid rows are perfectly aligned at 280px
- Hover glow doesn't clip at top edge

**Rollback**: Revert wrapper className changes (4 lines)

---

### Phase G2: Card Internal Slot Rhythm Normalization
**Goal**: Ensure every card follows header/content/footer pattern with correct flex behavior

**Changes:**
1. **File**: `web/src/components/LeadsOverviewCard.tsx`
   - **Line 23**: Add `min-h-0` to flex container: `flex-1 min-h-0 flex flex-col justify-center mt-1 space-y-4`

2. **File**: `web/src/components/ScheduleCard.tsx`
   - **Line 13**: Add `min-h-0` to flex container: `space-y-3 flex-1 min-h-0 flex items-center justify-center`

3. **File**: `web/src/components/TodoCard.tsx**
   - **Line 62**: Add `min-h-0` to flex container: `space-y-3 flex-1 min-h-0` (also fix gap)

4. **File**: `web/src/components/ResourcesCard.tsx`
   - **Line 20**: Add `min-h-0` to flex container: `space-y-3 flex-1 min-h-0`

**Note**: NeonCard already provides `.dashboard-card-content` with `flex: 1` and `height: 100%` (neon.css:126-131), so children just need `min-h-0` for proper flex shrinking.

**Verification:**
- All flex children have `min-h-0` where needed
- Scroll regions work correctly (if applicable)
- Cards maintain 280px height regardless of content

**Rollback**: Remove `min-h-0` from 4 files (4 lines)

---

### Phase G3: Scroll Correctness Audit
**Goal**: Verify scroll regions are correctly configured

**Changes:**
1. **File**: `web/src/components/NeedsAttentionCard.tsx`
   - **Line 369**: Already correct — `flex-1 overflow-y-auto neon-scrollbar pr-2 -mr-2 min-h-0` ✅
   - No changes needed

**Verification:**
- NeedsAttentionCard scroll region works correctly
- Other cards don't need scrolling (content fits in 128px available area)

**Rollback**: N/A (no changes)

---

### Phase G4: Micro-Geometry Polish
**Goal**: Standardize inner spacing to 12px rhythm

**Changes:**
1. **File**: `web/src/components/NeedsAttentionCard.tsx`
   - **Line 376**: Change `space-y-2` → `space-y-3` (8px → 12px)

2. **File**: `web/src/components/LeadsOverviewCard.tsx`
   - **Line 36**: Change `gap-4` → `gap-3` (16px → 12px)

3. **File**: `web/src/components/TodoCard.tsx**
   - **Line 62**: Change `space-y-2.5` → `space-y-3` (10px → 12px)

**Verification:**
- All inner gaps use 12px (`gap-dfos-3` or `space-y-3`)
- Visual rhythm is consistent across all cards

**Rollback**: Revert gap changes (3 lines)

---

## Implementation Summary

**Total Changes:**
- **Phase G1**: 4 lines (wrapper classes)
- **Phase G2**: 4 lines (min-h-0 additions)
- **Phase G3**: 0 lines (already correct)
- **Phase G4**: 3 lines (gap standardization)

**Total**: 11 lines across 5 files

**Risk Level**: Low — All changes are additive (adding classes) or value-only (gap numbers), no structural changes

**Testing Checklist:**
1. ✅ All 6 cards are exactly 280px height
2. ✅ Grid rows are perfectly aligned
3. ✅ Hover glow doesn't clip at edges
4. ✅ Scroll regions work (NeedsAttentionCard)
5. ✅ Cards don't grow beyond 280px with long content
6. ✅ Inner gaps are consistent (12px)
7. ✅ Visual rhythm is uniform across dashboard

---

## Rollback Strategy

If any phase introduces issues:

1. **Phase G1 Rollback**: Remove `h-[280px] pt-[2px] relative z-0` from 4 wrapper divs
2. **Phase G2 Rollback**: Remove `min-h-0` from 4 flex containers
3. **Phase G3 Rollback**: N/A (no changes)
4. **Phase G4 Rollback**: Revert gap values to original (3 lines)

All changes are isolated and can be rolled back independently.

---

**END OF SPEC**







