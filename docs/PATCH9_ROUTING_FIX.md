# 🔧 Patch 9 Complete - Frontend/Backend Routing Fix

## Problem Solved
Frontend was sending requests to `http://localhost:5173/api/...` instead of proxying to backend at `http://localhost:3010/api/...`.

## Changes Applied

### 1. ✅ Vite Proxy Configuration (`web/vite.config.ts`)

**Before:**
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3010',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),  // ❌ This was stripping /api
  },
}
```

**After:**
```typescript
proxy: {
  "/api": {
    target: "http://localhost:3010",
    changeOrigin: true,
    secure: false,
    // No rewrite - keeps /api in path ✅
  },
  "/ws": {
    target: "ws://localhost:3010",
    ws: true,
  },
}
```

### 2. ✅ API Base URL (`web/src/api/client.ts`)

```typescript
// Before
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// After
const API_BASE_URL = "/api";  // Relative path - uses Vite proxy
```

### 3. ✅ Hook Paths Already Correct (`web/src/api/hooks.ts`)

All hooks already use relative paths without `/api/` prefix:
- ✅ `api.get("/leads")` → becomes `/api/leads` via base URL
- ✅ `api.get("/kpis/full")` → becomes `/api/kpis/full`
- ✅ `api.post("/deals")` → becomes `/api/deals`

## Request Flow After Fix

```
Frontend Call:     useLeads()
                       ↓
Hook:              api.get("/leads")
                       ↓
Base URL:          "/api"
                       ↓
Full Path:         /api/leads
                       ↓
Browser:           http://localhost:5173/api/leads
                       ↓
Vite Proxy:        Forwards to http://localhost:3010/api/leads
                       ↓
Backend:           app.use("/api/leads", leadsRoutes)  ✅
```

## Testing Steps

### 1. Stop any running servers

```bash
# Stop frontend dev server (Ctrl+C)
# Stop backend dev server (Ctrl+C)
```

### 2. Start Backend (Terminal 1)

```bash
npm run dev
```

Should show:
```
[SERVER] listening on http://localhost:3010 (WebSocket on /ws)
```

### 3. Start Frontend (Terminal 2)

```bash
cd web && npm run dev
```

Should show:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4. Test API Call

Open browser console and test:

```javascript
// Should call http://localhost:5173/api/leads
// → Proxy forwards to http://localhost:3010/api/leads
fetch('/api/leads', {
  headers: {
    'x-dev-user-id': 'user_dev',
    'x-dev-org-id': 'org_dev'
  }
})
```

**Backend logs should show:**
```
[SERVER] GET /api/leads → 200 ✅
```

**NOT:**
```
[ERROR] Cannot GET /api/leads → 404 ❌
```

## Environment Requirements

Backend `.env` (create if it doesn't exist):
```env
DEV_AUTH_BYPASS=true
PORT=3010
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dealflowos
REDIS_URL=redis://localhost:6379
```

**Important:** The backend MUST run on port `3010` to match the Vite proxy configuration.

If you want to use a different port, update `web/vite.config.ts`:
```typescript
proxy: {
  "/api": {
    target: "http://localhost:YOUR_PORT",  // Change here
    // ...
  }
}
```

Frontend runs on port `5173` (default Vite)

## Summary

| Component | Port | Purpose |
|-----------|------|---------|
| Frontend (Vite) | 5173 | Dev server with proxy |
| Backend (Express) | 3010 | API server |
| Proxy | - | Routes `/api/*` and `/ws` to backend |

All API calls now correctly route through Vite proxy to the backend! 🎉

