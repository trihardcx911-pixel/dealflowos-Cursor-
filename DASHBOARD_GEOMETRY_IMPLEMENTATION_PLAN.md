# Dashboard Geometry Spec v1 Implementation Plan
## Phase-by-Phase, Zero Drift

---

## OBJECTIVE

Implement "Dashboard Geometry Spec v1" with minimal diffs, strict guardrails, and deterministic verification after each phase. Prioritize visual alignment + non-clipping hover glow + zero regressions.

---

## NON-NEGOTIABLE GUARDRAILS

- **Implement ONE phase per run. Do not bundle phases.**
- **Do NOT change component structure/DOM tree. ClassName-only edits unless a phase explicitly allows more.**
- **Do NOT touch**: routes, API logic, React Query, backend, auth, KPI logic, TaskRow, charts, or any non-dashboard pages.
- **Do NOT add new CSS files, tokens, or dependencies.**
- **Keep a tight diff**: only the files listed per phase may be edited.
- **After each phase**: run TypeScript check + manual UI verification checklist below.

---

## GLOBAL ACCEPTANCE TEST (run after EVERY phase)

- [ ] `/dashboard` loads with no console errors.
- [ ] All 6 cards align to identical height in the grid (visually + DevTools computed height).
- [ ] Hover glow on edge cards does NOT clip (top row + bottom row + left/right edges).
- [ ] NeedsAttention scroll works and does not expand the card.
- [ ] No layout overlap, no new scrollbars on the page body.

---

## PHASE G1 — Wrapper Height Normalization (Critical)

### Purpose
Enforce exact 280px for ALL 6 cards and apply the same "glow-safe" wrapper policy.

### ALLOWED FILES (ONLY)
- `web/src/pages/DashboardPage.tsx`

### CHANGES (className-only; do not reorder JSX)

1. **Create a single reusable wrapper class string INSIDE the component (constant):**
   ```typescript
   const CARD_WRAP = "h-[280px] pt-[2px] relative z-0";
   ```

2. **Apply CARD_WRAP to the FOUR wrappers that currently do NOT have it:**
   - LeadsOverviewCard wrapper (line 18)
   - ScheduleCard wrapper (line 21)
   - TodoCard wrapper (line 24)
   - ResourcesCard wrapper (line 27)

### Rules
- Do NOT modify the existing `col-span-*` classes.
- Append `CARD_WRAP` at the end to minimize risk.
- Do NOT touch KpiCard or NeedsAttentionCard wrappers (they already match).

### Expected Diff

**Before:**
```tsx
<div className="col-span-12 md:col-span-6 xl:col-span-4">
  <LeadsOverviewCard />
</div>
<div className="col-span-12 md:col-span-6 xl:col-span-4">
  <ScheduleCard />
</div>
<div className="col-span-12 md:col-span-6 xl:col-span-4">
  <TodoCard />
</div>
<div className="col-span-12 md:col-span-6 xl:col-span-4">
  <ResourcesCard />
</div>
```

**After:**
```tsx
const CARD_WRAP = "h-[280px] pt-[2px] relative z-0";

// ... in JSX:
<div className={`col-span-12 md:col-span-6 xl:col-span-4 ${CARD_WRAP}`}>
  <LeadsOverviewCard />
</div>
<div className={`col-span-12 md:col-span-6 xl:col-span-4 ${CARD_WRAP}`}>
  <ScheduleCard />
</div>
<div className={`col-span-12 md:col-span-6 xl:col-span-4 ${CARD_WRAP}`}>
  <TodoCard />
</div>
<div className={`col-span-12 md:col-span-6 xl:col-span-4 ${CARD_WRAP}`}>
  <ResourcesCard />
</div>
```

### VERIFICATION (manual)

- [ ] In DevTools, select each wrapper div and confirm computed height is 280px.
- [ ] Hover each card and confirm glow is not clipped at top edge.
- [ ] All 6 cards align perfectly at the bottom edge.
- [ ] No console errors.

### TEST PROCEDURE

1. **Static check:**
   - [ ] `cd web && npm run typecheck` (or equivalent TS check)
   - [ ] `cd web && npm run dev` (ensure hot reload is clean)

2. **Visual check (dashboard):**
   - [ ] Compare card bottoms: all align perfectly.
   - [ ] Hover top-row cards: glow visible at top edge.
   - [ ] Hover bottom-row cards: glow visible + not clipped.

3. **Regression check:**
   - [ ] `/leads` page still works (create lead).
   - [ ] `/kpis` page still loads.
   - [ ] No console errors.

### STOP after Phase G1.

---

## PHASE G2 — Flex Shrink Correctness (min-h-0) (High)

### Purpose
Ensure content areas behave properly under fixed height and prevent latent overflow/scroll bugs.

### ALLOWED FILES (ONLY)
- `web/src/components/LeadsOverviewCard.tsx`
- `web/src/components/ScheduleCard.tsx`
- `web/src/components/TodoCard.tsx`
- `web/src/components/ResourcesCard.tsx`

### CHANGES (className-only)

Add `min-h-0` ONLY to the primary flex child that is intended to stretch (usually the `flex-1` container).

### Exact rules:
- Do NOT add new wrappers.
- Do NOT change spacing, typography, or content.
- If a div already has `flex-1`, add `min-h-0` right after `flex-1` for readability:
  e.g., `className="... flex-1 min-h-0 ..."`

### Expected Diffs

#### 1. LeadsOverviewCard.tsx (line 23)

**Before:**
```tsx
<div className="flex-1 flex flex-col justify-center mt-1 space-y-4">
```

**After:**
```tsx
<div className="flex-1 min-h-0 flex flex-col justify-center mt-1 space-y-4">
```

#### 2. ScheduleCard.tsx (line 13)

**Before:**
```tsx
<div className="space-y-3 flex-1 flex items-center justify-center">
```

**After:**
```tsx
<div className="space-y-3 flex-1 min-h-0 flex items-center justify-center">
```

#### 3. TodoCard.tsx (line 62)

**Before:**
```tsx
<div className="space-y-2.5 flex-1">
```

**After:**
```tsx
<div className="space-y-2.5 flex-1 min-h-0">
```

#### 4. ResourcesCard.tsx (line 20)

**Before:**
```tsx
<div className="space-y-3 flex-1">
```

**After:**
```tsx
<div className="space-y-3 flex-1 min-h-0">
```

### VERIFICATION (manual)

- [ ] Dashboard still aligns, no card grows.
- [ ] NeedsAttention scroll still works (regression check).
- [ ] No content spills out of cards at normal viewport widths.
- [ ] All 6 cards maintain 280px height.

### TEST PROCEDURE

1. **Static check:**
   - [ ] `cd web && npm run typecheck`
   - [ ] `cd web && npm run dev` (ensure hot reload is clean)

2. **Visual check (dashboard):**
   - [ ] Compare card bottoms: all align perfectly.
   - [ ] NeedsAttention: 2–3 rows visible, scroll works, footer visible.
   - [ ] No content overflow or clipping.

3. **Regression check:**
   - [ ] `/leads` page still works (create lead).
   - [ ] `/kpis` page still loads.
   - [ ] No console errors.

### STOP after Phase G2.

---

## PHASE G4 — Spacing Rhythm Standardization (12px Rule) (Medium)

### Purpose
Unify within-card spacing to a consistent 12px rhythm where it impacts scanability.

### ALLOWED FILES (ONLY)
- `web/src/components/NeedsAttentionCard.tsx`
- `web/src/components/LeadsOverviewCard.tsx`
- `web/src/components/TodoCard.tsx`

### CHANGES (value-only edits; do not modify structure)

1. **NeedsAttentionCard**: change list container spacing:
   - `space-y-2` -> `space-y-3`
   - **Guardrail**: do NOT change TaskRow overrides or scroll container.

2. **LeadsOverviewCard**: change inner grid gap:
   - `gap-4` -> `gap-3`
   - **Guardrail**: do NOT change data mapping or query/hook usage.

3. **TodoCard**: change vertical spacing:
   - `space-y-2.5` -> `space-y-3`
   - **Guardrail**: do NOT change chart/urgency distribution logic.

### Expected Diffs

#### 1. NeedsAttentionCard.tsx (line 376)

**Before:**
```tsx
<div className="space-y-2">
```

**After:**
```tsx
<div className="space-y-3">
```

#### 2. LeadsOverviewCard.tsx (line 36)

**Before:**
```tsx
<div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
```

**After:**
```tsx
<div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
```

#### 3. TodoCard.tsx (line 62)

**Before:**
```tsx
<div className="space-y-2.5 flex-1 min-h-0">
```

**After:**
```tsx
<div className="space-y-3 flex-1 min-h-0">
```

### VERIFICATION (manual)

- [ ] Rhythm looks consistent: scan all cards and confirm comparable spacing density.
- [ ] NeedsAttention still shows 2–3 rows as intended (no accidental shrink).
- [ ] Visual rhythm is uniform across dashboard.
- [ ] No layout shifts or content overflow.

### TEST PROCEDURE

1. **Static check:**
   - [ ] `cd web && npm run typecheck`
   - [ ] `cd web && npm run dev` (ensure hot reload is clean)

2. **Visual check (dashboard):**
   - [ ] Compare card bottoms: all align perfectly.
   - [ ] Inner spacing looks consistent across all cards (12px rhythm).
   - [ ] NeedsAttention: 2–3 rows visible, scroll works, footer visible.

3. **Regression check:**
   - [ ] `/leads` page still works (create lead).
   - [ ] `/kpis` page still loads.
   - [ ] No console errors.

### STOP after Phase G4.

---

## PHASE G5 — Hover/Clipping Edge Audit (Only if needed)

### Purpose
Only if hover glow still clips on edges after G1–G4.

### ALLOWED FILES (ONLY)
- `web/src/styles/neon.css`

### CHANGES (only if evidence requires)

- Inspect whether `.dashboard-grid-container` or ancestors have overflow rules clipping hover glow.
- If clipping is confirmed, adjust ONLY the minimal overflow rule that causes clipping:
  - Prefer setting `overflow: visible` on the grid container, not global.
- Do NOT change animations, colors, borders, or layout grid columns.

### Potential Change (only if needed)

**Location**: `web/src/styles/neon.css` (around line 457)

**Before (if clipping exists):**
```css
.dashboard-grid-container {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: minmax(280px, auto);
  gap: var(--dfos-space-4);
  padding: 0;
  align-items: stretch;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
  /* If overflow: hidden exists here, it may clip hover glow */
}
```

**After (only if clipping confirmed):**
```css
.dashboard-grid-container {
  /* ... existing properties ... */
  overflow: visible; /* Only if clipping is confirmed */
}
```

### VERIFICATION (manual)

- [ ] Hover glow does not clip anywhere (top, bottom, left, right edges).
- [ ] No unexpected overlap issues between cards.
- [ ] No performance regressions from z-index stacking.
- [ ] All 6 cards maintain proper alignment.

### TEST PROCEDURE

1. **Static check:**
   - [ ] `cd web && npm run typecheck`
   - [ ] `cd web && npm run dev` (ensure hot reload is clean)

2. **Visual check (dashboard):**
   - [ ] Hover top-row cards: glow visible at top edge, not clipped.
   - [ ] Hover bottom-row cards: glow visible, not clipped.
   - [ ] Hover left/right edge cards: glow visible, not clipped.
   - [ ] No unexpected overlap or z-index issues.

3. **Regression check:**
   - [ ] `/leads` page still works (create lead).
   - [ ] `/kpis` page still loads.
   - [ ] No console errors.

### STOP after Phase G5.

---

## IMPLEMENTATION SUMMARY

### Total Changes Across All Phases

- **Phase G1**: 1 constant + 4 wrapper className additions (5 lines)
- **Phase G2**: 4 `min-h-0` additions (4 lines)
- **Phase G4**: 3 spacing value changes (3 lines)
- **Phase G5**: 0-1 overflow rule (only if needed)

**Total**: ~12 lines across 5-6 files

### Risk Level
**Low** — All changes are:
- Additive (adding classes/values)
- Non-structural (no DOM changes)
- Isolated (one phase at a time)
- Reversible (easy rollback)

### Files Modified (by phase)

- **G1**: `web/src/pages/DashboardPage.tsx`
- **G2**: `web/src/components/LeadsOverviewCard.tsx`, `ScheduleCard.tsx`, `TodoCard.tsx`, `ResourcesCard.tsx`
- **G4**: `web/src/components/NeedsAttentionCard.tsx`, `LeadsOverviewCard.tsx`, `TodoCard.tsx`
- **G5**: `web/src/styles/neon.css` (only if needed)

---

## ROLLBACK STRATEGY

If any phase introduces issues:

1. **Phase G1 Rollback**: Remove `CARD_WRAP` constant and revert 4 wrapper className changes.
2. **Phase G2 Rollback**: Remove `min-h-0` from 4 flex containers.
3. **Phase G4 Rollback**: Revert spacing values to original (3 lines).
4. **Phase G5 Rollback**: Revert overflow rule (if changed).

All changes are isolated and can be rolled back independently.

---

## DELIVERABLE PER PHASE

After each phase, output:
- ✅ Files changed (must match allowed list)
- ✅ Exact className diffs (before/after snippets)
- ✅ Verification checklist results placeholders (so user can tick them)

**DO NOT proceed to the next phase in the same run.**

---

**END OF IMPLEMENTATION PLAN**







