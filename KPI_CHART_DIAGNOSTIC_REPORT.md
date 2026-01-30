# KPI Chart Diagnostic Report

## Executive Summary
Based on code analysis of the KPI implementation, here are the findings for each diagnostic checkpoint:

---

## 1️⃣ Is the KPI chart component actually mounting?

**STATUS: ✅ MOUNTING CORRECTLY**

**Evidence:**
- `KpisPage.tsx` (line 92) unconditionally renders `<KpiChart />` after the data tiles
- No conditional logic wrapping the chart component
- The component is outside of any data-dependent render blocks

**Component Stack:**
```
KpisPage
  └─> KpiChart (line 92)
       ├─> NeonLineChart (line 354)
       ├─> NeonPieChart (line 366)
       └─> NeonVelocityGauge (line 372)
```

**To verify mounting (add temporary logs):**
```typescript
// In KpiChart.tsx line 138, add:
export function KpiChart() {
  console.log('[KPI CHART] Component mounted');
  const [range, setRange] = useState<"week" | "month" | "year">("month");
  // ... rest of code
```

**Verdict:** Component is mounting. If charts are blank, the issue is NOT routing/mounting.

---

## 2️⃣ Is the chart receiving valid data at render time?

**STATUS: ⚠️ POTENTIAL DATA ISSUES**

**Critical Findings:**

### A) Pie Chart Data Dependencies
- **File:** `KpiChart.tsx` line 316-341
- **Data Source:** `GET /kpis/lead-sources`
- **Failure Mode:** If backend returns `[]` or fails, `pieData = []`
- **Result:** NeonPieChart renders "No lead source data available" (line 24-28)

```typescript
// Line 316-317
const leadSources = leadSourcesData || [];
const totalLeadSources = leadSources.reduce((sum, s) => sum + s.count, 0);

// Line 330-341 - pieData will be EMPTY ARRAY if leadSourcesData is undefined/empty
const pieData = leadSources.map((s) => { ... });
```

**This matches your screenshot message: "No lead source data available"**

### B) Line Chart Data
- Has fallback mock data (line 178-183) - should always render something
- Uses synthetic data if backend returns < 2 points

### C) Velocity Gauge
- Always has a fallback score of 50 if no data (line 310)
- Should never be completely blank

**Key Questions to Check:**
1. Does `GET /kpis/lead-sources` return 200 with data?
2. Is the response structure `[{ source: string, count: number }]`?
3. Check browser console for query errors

**To diagnose, add:**
```typescript
// Line 148 in KpiChart.tsx
const { data: leadSourcesData } = useQuery<LeadSource[]>({
  queryKey: ["lead-sources"],
  queryFn: () => get<LeadSource[]>("/kpis/lead-sources"),
  retry: 1,
  staleTime: 30000,
});

console.log('[KPI CHART] leadSourcesData:', leadSourcesData);
console.log('[KPI CHART] pieData length:', pieData.length);
```

---

## 3️⃣ Is the chart rendering before layout size is known?

**STATUS: ✅ LIKELY NOT AN ISSUE**

**Evidence:**
- `NeonPieChart.tsx` uses `<ResponsiveContainer>` (line 128)
- ResponsiveContainer waits for parent size before rendering
- Parent container: `.chart-card.neon-glass` (line 362) has explicit padding

**Container Styles (line 411-418):**
```css
.neon-glass {
  background: rgba(10, 10, 10, 0.55);
  border: 1px solid rgba(255, 0, 60, 0.25);
  padding: 1.75rem;  /* ← NOT zero */
  border-radius: 18px;
  backdrop-filter: blur(6px);
}
```

**ResponsiveContainer Behavior:**
- Width: 100% (line 128)
- Height: 300px (line 128) - **EXPLICIT HEIGHT**

**Verdict:** Height is explicit (300px), so this is unlikely the issue. ResponsiveContainer will measure parent and render.

---

## 4️⃣ Did recent UI changes affect overflow / positioning?

**STATUS: ⚠️ POSSIBLE LEAK FROM LeadsPage**

**Recent Changes Analysis:**

### LeadsPage.tsx Body Manipulation (lines 159-164, 177-179):
```typescript
// In openQuickView():
document.body.style.overflow = 'hidden'
document.body.style.paddingRight = `${scrollbarWidth}px`

// In closeQuickView():
document.body.style.overflow = prevBodyOverflowRef.current
document.body.style.paddingRight = prevBodyPaddingRightRef.current
```

**Potential Leak Scenarios:**
1. User navigates from LeadsPage → KpisPage while Quick View is open
2. `closeQuickView()` cleanup never fires
3. `document.body.style.overflow = 'hidden'` persists globally
4. Charts render but are clipped/hidden

**To verify:**
```javascript
// In browser console on KPIs page:
console.log('body overflow:', document.body.style.overflow);
console.log('body paddingRight:', document.body.style.paddingRight);
// Expected: "" or "auto" or "visible"
// If "hidden", LeadsPage leaked!
```

**Recommended Fix:**
```typescript
// In LeadsPage.tsx, add cleanup on unmount:
useEffect(() => {
  return () => {
    // Component unmount cleanup
    if (quickViewOpen) {
      document.body.style.overflow = prevBodyOverflowRef.current
      document.body.style.paddingRight = prevBodyPaddingRightRef.current
    }
  }
}, [])
```

---

## 5️⃣ Is the chart library compatible with current React / Vite setup?

**STATUS: ✅ COMPATIBLE**

**Chart Library Stack:**
- **NeonPieChart:** Uses `recharts` (PieChart, Pie, Cell, Tooltip, ResponsiveContainer)
- **NeonLineChart:** Custom SVG (no external lib)
- **NeonVelocityGauge:** Custom SVG (no external lib)

**Recharts Compatibility:**
- Industry-standard React chart library
- Works with Vite out of the box
- No strict mode issues
- No ESM/CJS interop problems (unlike react-window you dealt with earlier)

**Verdict:** Library is compatible. Not the issue.

---

## 6️⃣ Are there runtime errors being swallowed?

**STATUS: ⚠️ NO ERROR BOUNDARIES DETECTED**

**Findings:**
- No try/catch blocks around chart renders in `KpiChart.tsx`
- No React Error Boundary wrapping the charts
- If `recharts` throws during render, it will bubble up to nearest boundary or crash

**To check for swallowed errors:**
```javascript
// Browser console:
1. Check Console tab for any warnings/errors
2. Check Network tab for failed /kpis or /kpis/lead-sources requests
3. Check React DevTools for component render errors
```

**Recommended: Add Error Boundary**
```typescript
// In KpisPage.tsx, wrap KpiChart:
<ErrorBoundary fallback={<div>Chart failed to load</div>}>
  <KpiChart />
</ErrorBoundary>
```

---

## 7️⃣ Does the chart render if hardcoded data is used?

**STATUS: 🔬 DIAGNOSTIC TEST NEEDED**

**Test Case for NeonPieChart:**
```typescript
// In KpiChart.tsx, line 366, temporarily replace:
<NeonPieChart
  data={[
    { name: "Cold Call", value: 45, percent: 45 },
    { name: "SMS", value: 30, percent: 30 },
    { name: "PPC", value: 15, percent: 15 },
    { name: "Referral", value: 10, percent: 10 },
  ]}
/>
```

**Expected Result:**
- If chart renders with hardcoded data → Issue is backend data pipeline
- If chart still blank → Issue is rendering/layout

**This test cleanly separates data vs render issues.**

---

## 8️⃣ Is the KPI page conditionally blocking render?

**STATUS: 🔴 HIGHLY LIKELY ROOT CAUSE**

**Critical Finding:**

### NeonPieChart.tsx Early Return (lines 23-29):
```typescript
if (!data || data.length === 0) {
  return (
    <div className="text-white/60 text-sm p-4">
      No lead source data available
    </div>
  );
}
```

**This matches your screenshot exactly!**

### Data Pipeline:
```
GET /kpis/lead-sources
  ↓
leadSourcesData (undefined or [])
  ↓
pieData = leadSourcesData.map(...) → []
  ↓
<NeonPieChart data={[]} />
  ↓
Early return: "No lead source data available"
```

**Root Cause:**
- Backend endpoint `/kpis/lead-sources` is either:
  - Returning empty array `[]`
  - Returning 404/500
  - Not implemented in dev mode

**To diagnose:**
```bash
# Test backend directly:
curl -i http://localhost:3010/api/kpis/lead-sources \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev"
```

**Expected Response:**
```json
[
  { "source": "cold_call", "count": 45 },
  { "source": "sms", "count": 30 },
  { "source": "ppc", "count": 15 }
]
```

**Likely Issue:**
Backend is returning `[]` because:
1. No leads have been created with a `source` field
2. The `/kpis/lead-sources` route doesn't exist in dev mode
3. Query is filtering all leads out (e.g., orgId mismatch)

---

## 9️⃣ Did virtualization or scroll locking leak into KPIs?

**STATUS: ⚠️ POSSIBLE (see #4 above)**

**Side Effects from LeadsPage.tsx:**
1. `document.body.style.overflow = 'hidden'` (global mutation)
2. `document.body.style.paddingRight = '...px'` (global mutation)

**Leak Conditions:**
- User opens Quick View on LeadsPage
- User navigates to /kpis via browser back button or direct link
- Quick View cleanup doesn't fire
- KPIs page inherits `overflow: hidden`

**Diagnostic:**
```javascript
// On KPIs page, browser console:
getComputedStyle(document.body).overflow
// Should be: "visible" or "auto"
// If "hidden": LEAK CONFIRMED
```

**Fix:** Add unmount cleanup to LeadsPage (see #4)

---

## 🔟 Does the chart require a resize observer or effect rerun?

**STATUS: ✅ NOT REQUIRED**

**Evidence:**
- `ResponsiveContainer` has built-in resize observer
- Recharts handles resize automatically
- No manual `useEffect` resize logic needed

**Verdict:** Not the issue.

---

## 🎯 Prioritized Action Plan

### Highest Priority (90% likely)
**#8 - Backend Data Missing**
1. Test backend: `curl http://localhost:3010/api/kpis/lead-sources`
2. If returns `[]`, check if leads have `source` field populated
3. If route doesn't exist, implement it or use mock data in dev

### High Priority
**#2 - Add Diagnostic Logging**
```typescript
// KpiChart.tsx line 148
console.log('[KPI] leadSourcesData:', leadSourcesData);
console.log('[KPI] pieData:', pieData);
```

### Medium Priority
**#4 & #9 - Check for LeadsPage Leak**
```javascript
// Browser console on KPIs page:
console.log('body overflow:', document.body.style.overflow);
```

### Low Priority (Hardening)
**#7 - Hardcoded Data Test**
- Proves render path works independently of data

---

## Quick Fix for Immediate Testing

Add this to `KpiChart.tsx` line 316:

```typescript
// TEMPORARY: Dev fallback for empty lead sources
const leadSources = leadSourcesData && leadSourcesData.length > 0 
  ? leadSourcesData 
  : [
      { source: "cold_call", count: 45 },
      { source: "sms", count: 30 },
      { source: "ppc", count: 15 },
      { source: "referral", count: 10 },
    ];
```

**This will:**
- Prove the chart renders correctly (eliminating layout/render issues)
- Show whether backend data is the blocker
- Provide immediate visual feedback

---

## Backend Route to Check

**File:** `server/src/routes/kpis.ts` or `server/src/routes/kpis.dev.ts`

**Expected route:**
```typescript
router.get('/lead-sources', async (req, res) => {
  // Query leads grouped by source
  // Return: [{ source: string, count: number }]
});
```

**If route doesn't exist:** That's your smoking gun.

---

## Summary

**Most Likely Issue:** Backend `/kpis/lead-sources` endpoint is returning empty data or doesn't exist.

**Evidence:**
1. Chart shows exact message from early return condition
2. Other charts (gauge, line) likely work because they have fallbacks
3. Pie chart has NO fallback, only error message

**Next Steps:**
1. Check backend route exists
2. Verify leads have `source` field
3. Add dev fallback data if needed
4. Check for LeadsPage overflow leak as secondary issue










