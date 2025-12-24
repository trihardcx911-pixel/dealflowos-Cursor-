# ✅ Updated server.ts Routes - All Use /api Prefix

## Changes Applied to `src/server.ts`

| Before | After |
|--------|-------|
| `/auth` | `/api/auth` |
| `/calendar` | `/api/calendar` |
| `/kpis` | `/api/kpis` |

## Updated Routes in server.ts

```typescript
// Auth routes
app.use("/api/auth", makeAuthRouter(pool));

// Calendar routes
app.use("/api/calendar", calendarRouter);

// Test route
app.get("/api/kpis", (_req, res) => {
  res.json({ ok: true, message: "KPI endpoint reachable" });
});
```

## Available Auth Endpoints

After this update:

```
POST /api/auth/login    → Login endpoint
POST /api/auth/signup   → Signup endpoint
```

## Testing

**Test auth login:**
```bash
curl -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Expected response:**
```json
{
  "token": "dev_token_..."
}
```

**Test auth signup:**
```bash
curl -X POST http://localhost:3010/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Expected response:**
```json
{
  "message": "User created"
}
```

## Note About server.ts vs app.ts

There appear to be **two entry points** in your codebase:

1. **`src/server.ts`** - Older/simpler server with:
   - `/api/auth`
   - `/api/calendar`
   - `/api/kpis` (test route)

2. **`src/app.ts`** - Main application server with:
   - All the `/api/*` routes we previously updated
   - WebSocket support
   - Full middleware stack
   - KPI, leads, deals, dashboard, etc.

### Which One Are You Running?

Check which file your `package.json` scripts are using:

```bash
# Look for:
"dev": "tsx watch src/app.ts"
# or
"dev": "tsx watch src/server.ts"
```

**Recommendation:** If both exist, you should:
- Use `app.ts` as the main server (it has more features)
- Consider removing `server.ts` or merging its routes into `app.ts`

## Summary

✅ All routes in `server.ts` now use `/api` prefix
✅ Consistent with the Vite proxy configuration
✅ Auth endpoints now accessible at `/api/auth/*`

If you're using `server.ts`, restart it:
```bash
npm run dev
```

Then test:
```bash
curl http://localhost:3010/api/auth/login
```







