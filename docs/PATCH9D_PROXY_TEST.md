# 🧪 Patch 9D - Proxy Verification Test

## Vite Config Verified ✅

Current `web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3010",
        changeOrigin: true,
        secure: false,
        // IMPORTANT: NO rewrite - keeps /api in path
      },
      "/ws": {
        target: "ws://localhost:3010",
        ws: true
      }
    }
  }
});
```

**Configuration is correct!** ✅

## Test Route Added

Added test endpoint in `src/app.ts`:

```typescript
app.get("/api/test-proxy", (_req, res) => {
  res.json({ 
    ok: true, 
    message: "Proxy is working! Backend received request at /api/test-proxy",
    timestamp: new Date().toISOString()
  });
});
```

## Testing Instructions

### Step 1: Restart Backend

```bash
# Stop backend if running (Ctrl+C)
npm run dev
```

**Expected output:**
```
[SERVER] listening on http://localhost:3010 (WebSocket on /ws)
```

### Step 2: Restart Frontend

```bash
# Stop frontend if running (Ctrl+C)
cd web
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### Step 3: Test Proxy in Browser Console

Open http://localhost:5173 and run in console:

```javascript
fetch("/api/test-proxy")
  .then(r => r.json())
  .then(console.log)
```

**✅ Expected Success Result:**
```javascript
{
  ok: true,
  message: "Proxy is working! Backend received request at /api/test-proxy",
  timestamp: "2024-12-06T..."
}
```

**❌ If you get 404:**
```javascript
Cannot GET /api/test-proxy
```

This means the proxy is NOT forwarding correctly.

### Step 4: Check Backend Logs

Backend terminal should show:
```
[SERVER] GET /api/test-proxy → 200
```

If the backend shows nothing, the proxy is not forwarding.

### Step 5: Test Real Endpoints

Once the test proxy works, try real endpoints:

```javascript
// Test 1: Leads endpoint
fetch("/api/leads", {
  headers: {
    "x-dev-user-id": "user_dev",
    "x-dev-org-id": "org_dev"
  }
})
.then(r => r.json())
.then(console.log)

// Test 2: KPIs endpoint  
fetch("/api/kpis/full", {
  headers: {
    "x-dev-user-id": "user_dev",
    "x-dev-org-id": "org_dev"
  }
})
.then(r => r.json())
.then(console.log)
```

## Troubleshooting

### Issue: 404 on /api/test-proxy

**Possible causes:**

1. **Backend not running on port 3010**
   ```bash
   # Check what's on port 3010
   netstat -ano | findstr :3010
   ```
   
   **Fix:** Make sure `.env` has `PORT=3010` and restart backend

2. **Frontend not using proxy**
   ```bash
   # Check frontend port
   netstat -ano | findstr :5173
   ```
   
   **Fix:** Make sure frontend is running on 5173

3. **Vite not reloaded with new config**
   ```bash
   # Hard restart
   cd web
   rm -rf node_modules/.vite
   npm run dev
   ```

4. **Browser cache**
   - Open DevTools
   - Right-click refresh button → "Empty Cache and Hard Reload"

### Issue: CORS Error

**Symptom:** Console shows CORS policy error

**Cause:** Request is going directly to backend, not through proxy

**Check:**
```javascript
// In browser console
console.log(window.location.origin)  // Should be http://localhost:5173
```

**Fix:** Ensure `API_BASE_URL = "/api"` in `web/src/api/client.ts`

### Issue: Connection Refused

**Symptom:** `net::ERR_CONNECTION_REFUSED`

**Cause:** Backend is not running

**Fix:**
```bash
# Make sure backend is running
npm run dev
```

## Expected Flow Diagram

```
Browser Console:        fetch("/api/test-proxy")
                              ↓
Browser URL:           http://localhost:5173/api/test-proxy
                              ↓
Vite Dev Server:       Receives request on port 5173
                              ↓
Vite Proxy Config:     Matches "/api" pattern
                              ↓
Proxy Target:          Forwards to http://localhost:3010/api/test-proxy
                              ↓
Backend Express:       app.get("/api/test-proxy", ...)
                              ↓
Response:              { ok: true, message: "..." }
                              ↓
Browser Console:       Logs success object ✅
```

## Success Criteria

- [ ] Backend runs on port 3010
- [ ] Frontend runs on port 5173
- [ ] `fetch("/api/test-proxy")` returns 200
- [ ] Response contains `{ ok: true }`
- [ ] Backend logs show `GET /api/test-proxy`
- [ ] No CORS errors in console
- [ ] No 404 errors

## Next Steps

Once the test proxy works:

1. ✅ Remove the test route (or keep it for future testing)
2. ✅ Test real API endpoints (`/api/leads`, `/api/kpis`, etc.)
3. ✅ Test React Query hooks in components
4. ✅ Verify WebSocket connection (`/ws`)

## Summary

- **Test route added:** `GET /api/test-proxy`
- **Purpose:** Verify Vite proxy forwards to backend correctly
- **Expected result:** 200 OK with JSON response
- **If it works:** Your proxy configuration is correct! 🎉
- **If it doesn't:** Check troubleshooting section above

Run the test now and let me know the result!







