# Calendar & Task Reminders: Codebase Analysis & Implementation Strategy

## 📍 1. CURRENT STATE DISCOVERY

### Calendar Implementation

**Frontend:**
- **File:** `web/src/pages/CalendarPage.tsx` (482 lines)
- **Components:**
  - `MonthGrid`, `DayTimeline`, `WeekTimeline` - view components
  - `EventModal` - create/edit modal
  - `CalendarViewSwitcher` - month/week/day switcher
- **State:** Events stored in React state, loaded via `get('/calendar/month?date=YYYY-MM')`
- **Event Structure:**
  ```typescript
  {
    id: number,
    title: string,
    date: string (YYYY-MM-DD),
    startTime: string (HH:mm),
    endTime: string (HH:mm),
    notes: string?,
    urgency: 'low' | 'medium' | 'critical'
  }
  ```
- **Timezone Handling:** Lines 48-72 convert UTC ISO timestamps from backend to local HH:mm format using browser's `Date.getHours()`/`getMinutes()`
- **NO reminders concept exists**

**Backend:**
- **File:** `server/src/routes/calendar.ts` (434 lines)
- **Routes:**
  - `POST /calendar/create` - create event
  - `GET /calendar/month?date=YYYY-MM` - fetch month events
  - `GET /calendar/day?date=YYYY-MM-DD` - fetch day events
  - `DELETE /calendar/:id` - delete event
  - `PATCH /calendar/update/:id` - update event
- **Database:** `CalendarEvent` model in Prisma (schema lines 69-83)
  ```prisma
  model CalendarEvent {
    id        Int      @id @default(autoincrement())
    title     String
    date      DateTime
    startTime DateTime  // Full UTC timestamp
    endTime   DateTime  // Full UTC timestamp
    notes     String?
    urgency   String    // low / medium / critical
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    userId    Int      // ⚠️ Int (not String) - mismatch with User.id
    @@index([userId, date])
    @@index([date])
  }
  ```
- **Auth:** Uses `requireAuth` middleware, extracts `req.user.id` (String)
- **BOLA Protection:** Lines 300-328, 352-379 - verifies ownership before delete/update
- **NO reminders concept exists**

---

### Tasks Implementation

**Frontend:**
- **File:** `web/src/pages/TasksPage.tsx` (95 lines)
- **Current State:** **NOT BACKED** - only local React state
- **Structure:**
  ```typescript
  {
    id: string,
    title: string,
    status: 'due soon' | 'today' | 'new'
  }
  ```
- **Line 92:** "Backend wiring TBD — tasks persist locally for now."
- **NO due dates, NO timestamps, NO reminders**

**Backend:**
- **NOT FOUND:** No `/api/tasks` routes exist
- **NOT FOUND:** No `Task` model in Prisma schema
- **Status:** Tasks are purely frontend concept (not persisted)

---

### Notification Infrastructure (Existing)

**Frontend:**
- **File:** `web/src/components/ui/NotificationTray.tsx` (226 lines)
  - Toast-based notifications (bottom-left, slide-in)
  - Auto-dismiss after 5 seconds
  - Categories: deal, automation, lead, warning, system
  - Icons + color coding
- **File:** `web/src/realtime/RealtimeProvider.tsx` (197 lines)
  - React Context for real-time events
  - WebSocket connection management
  - Event types: NOTIFICATION, AUTOMATION_TRIGGERED, KPI_DELTA, LEAD_CREATED, etc.
  - Integrates with React Query for cache invalidation
- **File:** `web/src/realtime/socket.ts` (157 lines)
  - WebSocket client (`ws://localhost:3000/ws`)
  - Auto-reconnect logic (10 attempts, 2s delay)
  - Pub/sub for messages, connect/disconnect events

**Backend:**
- **WebSocket Server:** NOT FOUND in `server/src/`
  - Searched for: `websocket`, `ws.`, `WebSocket`
  - Found references in comments/security logs but NO server implementation
  - **Status:** WebSocket endpoint `/ws` does NOT exist
- **Implication:** Notification infrastructure is frontend-only, no backend push capability

---

### Email/SMS Infrastructure

**Search Results:**
- `email`: Found in 9 files (auth, billing, imports) - NO email sending implementation
- `sendgrid`, `nodemailer`, `smtp`: NOT FOUND
- `sms`, `twilio`: Found in 2 files (leads.import.ts, leads.commit.ts) - only as data fields, no sending
- **Status:** NO email or SMS sending capability exists

---

### Job Queue / Scheduler Infrastructure

**Search Results:**
- `cron`, `scheduler`, `bull`, `agenda`, `queue`, `worker`: NOT FOUND in `server/src/`
- **Dependencies (server/package.json):** No job queue libraries
  - Has: express, cors, multer, pg, stripe, firebase-admin, jsonwebtoken, zod, xlsx
  - Missing: BullMQ, Agenda, node-cron, node-schedule, etc.
- **Status:** NO background job runner exists

---

### Organization & Timezone

**Database:**
- **File:** `server/prisma/schema.prisma`, lines 14-24
  ```prisma
  model Organization {
    id            String   @id @default(cuid())
    name          String   @default("Demo Org")
    timezone      String   @default("America/New_York")  // ✅ Timezone exists!
    marketProfile String   @default("metro_sfr")
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    leads         Lead[]
    documents     LegalDocument[]
  }
  ```
- **Timezone Source:** Stored per-org in Postgres, default `"America/New_York"`
- **Usage:** NOT currently used in calendar logic (frontend uses browser timezone)

---

### Auth & Org Scoping

**Current Pattern (calendar.ts):**
```typescript
function getUserId(req: Request): string {
  if (!req.user?.id) throw new Error('User not authenticated');
  return req.user.id; // String from JWT
}
```
- ⚠️ **Type Mismatch:** `CalendarEvent.userId` is `Int`, but `req.user.id` is `String`
- **Lead Scoping:** Uses `orgId` (String) - multi-tenant per organization
- **Calendar Scoping:** Uses `userId` (String in JWT, Int in DB) - per-user, NOT per-org
- **Task Scoping:** Not implemented (no backend)

---

## 📐 2. FUNCTIONALITY DESIGN

### Unified Reminder Abstraction

**Recommended Model:**
```prisma
model Reminder {
  id              String   @id @default(cuid())
  orgId           String
  userId          String
  
  // Target (what to remind about)
  targetType      String   // 'calendar_event' | 'task'
  targetId        String   // CalendarEvent.id (as String) or Task.id
  
  // When to remind
  remindAt        DateTime @db.Timestamptz // UTC timestamp when reminder fires
  reminderOffset  Int      // Minutes before event (e.g., -60 for "1 hour before")
  
  // Delivery
  channel         String   // 'in_app' | 'email' | 'sms' | 'push'
  status          String   // 'pending' | 'sent' | 'failed' | 'cancelled'
  
  // Idempotency & retry
  idempotencyKey  String   @unique
  sentAt          DateTime?
  failedAt        DateTime?
  errorMessage    String?
  retryCount      Int      @default(0)
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Optional: link to target (soft references to avoid FK constraints)
  targetData      Json?    // Snapshot of event/task data for resilience
  
  @@index([orgId, remindAt, status])
  @@index([userId, remindAt, status])
  @@index([targetType, targetId])
  @@index([status, remindAt])
  @@unique([orgId, targetType, targetId, reminderOffset, channel])
}
```

**Design Decisions:**

1. **Derived vs Persisted:** **PERSISTED**
   - **Why:** Reminder delivery requires state (sent, failed, retry count)
   - Derived reminders would require scanning all events/tasks on every check
   - Persisted allows efficient query: `WHERE status='pending' AND remindAt <= NOW()`

2. **Minimum Fields Rationale:**
   - `targetType` + `targetId`: Polymorphic reference (event or task)
   - `remindAt`: Pre-computed UTC timestamp for efficient index scan
   - `reminderOffset`: Store offset (e.g., -60) to support "edit event time → recalc reminder"
   - `idempotencyKey`: `${orgId}:${targetType}:${targetId}:${offset}:${channel}` - prevents duplicates
   - `status`: State machine for delivery tracking
   - `retryCount`: Exponential backoff for failed deliveries

3. **"1 Hour Before" Computation:**
   ```typescript
   // Given: event.startTime (UTC DateTime), reminderOffset (-60 minutes)
   const remindAt = new Date(event.startTime.getTime() + (reminderOffset * 60 * 1000));
   ```
   - **Timezone Safety:** Store `remindAt` in UTC (Postgres `@db.Timestamptz`)
   - **Org Timezone:** Use `Organization.timezone` to compute "1 hour before" relative to org's local time
   - **Example:**
     - Event at 1:00 PM PST (21:00 UTC)
     - 1 hour before = 12:00 PM PST (20:00 UTC)
     - Store `remindAt = 2024-01-15T20:00:00Z`

4. **Unique Constraint:**
   - `@@unique([orgId, targetType, targetId, reminderOffset, channel])`
   - **Prevents:** Same event, same offset, same channel → duplicate reminders
   - **Allows:** Same event, different offsets (e.g., 1 hour + 15 minutes)
   - **Allows:** Same event, different channels (email + SMS)

---

## 🚀 3. DELIVERY MECHANISM OPTIONS

### Option 1: In-App Only (Polling or WebSocket) ⭐ **EASIEST**

**What You Get:**
- Toast notifications (existing `NotificationTray.tsx`)
- "Needs Attention" card (existing component structure)

**Implementation:**

**A. Short Polling (RECOMMENDED for MVP):**
- Frontend: `useEffect(() => { setInterval(fetchDueReminders, 60000) }, [])`
- Backend: `GET /api/reminders/due` → returns reminders with `remindAt <= NOW() AND status='pending'`
- Mark as sent: `PATCH /api/reminders/:id/mark-sent`

**B. WebSocket (Better UX, more complex):**
- Requires implementing WebSocket server (currently missing)
- Backend pushes reminder events to connected clients
- Real-time, no polling delay

**Pros:**
- No external dependencies
- Works in dev mode immediately
- No email/SMS provider costs
- No background workers needed

**Cons:**
- Only works when user has app open
- No offline notifications

**New Components Needed:**
- Backend: `GET /api/reminders/due`, `PATCH /api/reminders/:id/mark-sent`
- Frontend: Hook to poll/subscribe, logic to show toast + add to "Needs Attention"

**Infra Assumptions:**
- None (runs on current Node.js server)

**Failure Modes:**
- Missed reminders if user closes tab before `remindAt`
- Duplicate toasts if multiple tabs open (solve with `localStorage` coordination)
- Time drift if user's clock is wrong (use server time, not client)

---

### Option 2: OS Notifications (Web Push) ⚠️ **MODERATE COMPLEXITY**

**What You Get:**
- Desktop notifications even when browser tab is inactive
- Mobile notifications (if PWA installed)

**Requirements:**
1. **Service Worker** (`web/public/sw.js`)
2. **VAPID Keys** (public/private key pair for push)
3. **Push Subscription** (user grants permission, store subscription in DB)
4. **Web Push Library** (`web-push` npm package)

**Implementation:**
- User clicks "Enable Notifications" → request permission → store subscription
- Backend: `POST /api/reminders/:id/send-push` → uses `web-push` to send notification
- Service worker receives push → shows OS notification

**Pros:**
- Works when app is in background
- Native OS UX (macOS notification center, Windows action center)

**Cons:**
- Requires user permission (many decline)
- Complex setup (VAPID keys, service worker lifecycle)
- iOS Safari limitations (poor support until iOS 16.4+)
- Still requires app to be open on mobile (unless PWA installed)

**New Components Needed:**
- `web/public/sw.js` - service worker to handle push events
- Backend: `/api/push/subscribe`, `/api/push/unsubscribe`, push sending logic
- Frontend: Permission request UI, subscription management

**Infra Assumptions:**
- HTTPS required (push API security)
- VAPID keys stored in env vars

**Failure Modes:**
- Service worker bugs can break entire app
- Push subscriptions expire (need refresh logic)
- Rate limits from browser vendors (not well documented)

---

### Option 3: Email/SMS (Background Job Required) ⚠️ **HIGHEST COMPLEXITY**

**What You Get:**
- Reliable offline notifications
- Multi-channel delivery

**Requirements:**
1. **Email Provider:** SendGrid, AWS SES, Mailgun, Resend
2. **SMS Provider:** Twilio, AWS SNS
3. **Background Job Runner:** BullMQ + Redis, or Agenda + MongoDB, or node-cron
4. **Long-Running Worker Process** (separate from web server)

**Implementation:**

**A. Job Queue Approach (BullMQ + Redis):**
```typescript
// On event create/update:
await reminderQueue.add('send-reminder', {
  reminderId: reminder.id
}, {
  delay: reminder.remindAt.getTime() - Date.now()
});

// Worker process:
reminderQueue.process('send-reminder', async (job) => {
  const reminder = await prisma.reminder.findUnique({ where: { id: job.data.reminderId }});
  if (reminder.status === 'pending') {
    await sendEmail(reminder);
    await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'sent', sentAt: new Date() }});
  }
});
```

**B. Cron Approach (node-cron):**
```typescript
// Every minute:
cron.schedule('* * * * *', async () => {
  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: 'pending',
      remindAt: { lte: new Date() }
    },
    take: 100
  });
  
  for (const reminder of dueReminders) {
    await sendEmail(reminder);
    await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'sent', sentAt: new Date() }});
  }
});
```

**Pros:**
- Works offline
- Reliable (email/SMS providers handle retries)
- Professional UX

**Cons:**
- **Expensive:** SendGrid ~$15/mo, Twilio ~$1/100 SMS
- **Complex deployment:** Requires worker process (separate from web server)
- **Hosting constraints:** Heroku/Render/Vercel support workers, but adds cost
- **Rate limiting:** Email providers rate limit (e.g., 100/hour on free tier)
- **Spam risk:** Poor email deliverability if not configured correctly

**New Components Needed:**
- Backend: Email/SMS templates, provider integration, worker process
- Database: `ReminderDeliveryLog` table for audit trail
- Infra: Redis (for BullMQ) or separate worker dyno

**Infra Assumptions:**
- **Critical:** Hosting platform supports long-running worker processes
- Redis or MongoDB for job queue
- Environment variables for API keys

**Failure Modes:**
- Worker crashes → reminders not sent (need process monitoring)
- Email bounces → user never sees reminder (need bounce handling)
- SMS failures → no fallback channel
- Time drift between web server and worker (use UTC everywhere)
- Duplicate sends if worker restarts mid-job (idempotency keys critical)

---

### **RANKING (for MVP):**

1. **Option 1A (Short Polling)** - Start here
   - Zero new dependencies
   - Works immediately
   - Iterate to WebSocket later if needed

2. **Option 2 (Web Push)** - If offline notifications are critical
   - Better UX than polling
   - Still no external costs
   - Higher complexity than Option 1

3. **Option 3 (Email/SMS)** - Only if required by product
   - Adds operational complexity
   - Requires budget for providers
   - Needs worker infra

---

## 🗓️ 4. SCHEDULING STRATEGY

### Option A: Server-Side Periodic Scan (Cron-Like) ⭐ **RECOMMENDED FOR MVP**

**How It Works:**
```typescript
// In server.ts (or separate scheduler.ts):
setInterval(async () => {
  const now = new Date();
  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: 'pending',
      remindAt: { lte: now }
    },
    take: 100, // Batch size
    orderBy: { remindAt: 'asc' }
  });
  
  for (const reminder of dueReminders) {
    try {
      // Mark as processing to prevent double-send
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'processing' }
      });
      
      // Send notification (in-app, push, email, SMS)
      await sendNotification(reminder);
      
      // Mark as sent
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { 
          status: 'sent',
          sentAt: new Date()
        }
      });
    } catch (error) {
      // Mark as failed, increment retry count
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          errorMessage: error.message,
          retryCount: { increment: 1 }
        }
      });
    }
  }
}, 60000); // Every 60 seconds
```

**Idempotency Strategy:**
1. **Unique Constraint:** Prevents duplicate reminder records
2. **Status State Machine:** `pending` → `processing` → `sent` | `failed`
3. **Idempotency Key in Notification:** If sending to external service, include key in payload

**Pros:**
- Simple to implement
- No new dependencies (just `setInterval`)
- Works with current hosting (no worker needed)
- Easy to debug (logs in same process)

**Cons:**
- Less precise (up to 60s delay)
- All reminders processed by single server instance (scaling issue)
- If server restarts, current batch is lost (status='processing' reminders stuck)

**Mitigations:**
- Run every 60s (acceptable for "1 hour before" use case)
- Add startup recovery: `UPDATE reminders SET status='pending' WHERE status='processing'`
- Add monitoring: log reminder count, failures, lag

---

### Option B: Job Queue (BullMQ/Redis) 🔧 **BEST FOR SCALE**

**How It Works:**
```typescript
// On event create:
const reminder = await prisma.reminder.create({ data: {...} });
await reminderQueue.add('send-reminder', {
  reminderId: reminder.id
}, {
  jobId: reminder.idempotencyKey, // Prevents duplicates
  delay: reminder.remindAt.getTime() - Date.now()
});

// Worker process (separate script):
reminderQueue.process('send-reminder', async (job) => {
  const reminder = await prisma.reminder.findUnique({ 
    where: { id: job.data.reminderId }
  });
  
  if (!reminder || reminder.status !== 'pending') {
    return; // Idempotency: skip if already processed
  }
  
  await sendNotification(reminder);
  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { status: 'sent', sentAt: new Date() }
  });
});
```

**Idempotency Strategy:**
1. **Job ID = Idempotency Key:** BullMQ deduplicates by job ID
2. **DB Status Check:** Worker checks `status='pending'` before processing
3. **Atomic Updates:** Use `UPDATE WHERE status='pending'` for race condition safety

**Pros:**
- Precise timing (fires at exact `remindAt`)
- Automatic retries (BullMQ built-in)
- Scales horizontally (multiple workers)
- Persistent (jobs survive server restart)

**Cons:**
- **Requires Redis** (new dependency + hosting cost)
- More complex deployment (worker process + web process)
- Harder to debug (jobs in Redis, not logs)
- Redis memory usage grows with reminder count

---

### Option C: Hybrid (Scan for Near-Term + Queue for Far-Future) 🎯 **PRAGMATIC**

**How It Works:**
- **Near-term (< 1 hour):** Periodic scan (Option A)
- **Far-future (> 1 hour):** Job queue (Option B) or skip

**Rationale:**
- Most reminders fire within 1-2 hours (calendar events are created shortly before)
- Scanning every 60s for reminders within next 2 hours is efficient
- Don't need job queue complexity for MVP

**Implementation:**
```typescript
// Scan only for reminders in next 2 hours
const dueReminders = await prisma.reminder.findMany({
  where: {
    status: 'pending',
    remindAt: {
      lte: new Date(Date.now() + 2 * 60 * 60 * 1000),
      gte: new Date(Date.now() - 5 * 60 * 1000) // Include 5min past (clock drift)
    }
  },
  take: 100
});
```

---

### **RECOMMENDATION:**

**Start with Option A (Periodic Scan):**
1. Implement in `server.ts` (same process as web server)
2. Run every 60 seconds
3. Query `WHERE status='pending' AND remindAt <= NOW()`
4. Process batch of 100 reminders
5. Update status to `sent` or `failed`

**Upgrade Path:**
- If > 1000 reminders/hour → Option B (Job Queue)
- If precise timing critical → Option B
- If multi-server deployment → Option B

**Why Option A First:**
- Zero infra changes
- Works in dev mode immediately
- Acceptable latency for MVP (60s vs exact second)
- Easy to delete if wrong approach

---

## 🔗 5. TASKS ↔ CALENDAR INTEROP

### Should Reminders Share Same Pipeline?

**YES** - Unified `Reminder` model supports both:
```prisma
targetType: 'calendar_event' | 'task'
targetId: String // event.id or task.id
```

**Shared Logic:**
- Reminder scheduling (same `remindAt` computation)
- Delivery (same notification channels)
- Status tracking (same state machine)

**Divergent Logic:**
- **Event Reminders:** Computed from `event.startTime - offset`
- **Task Reminders:** Computed from `task.dueAt - offset` (requires adding `dueAt` to Task model)

---

### Preventing Duplicate Reminders

**Scenario:** Task converted into calendar event (or vice versa)

**Solution 1: Unique Constraint (Recommended)**
```prisma
@@unique([orgId, targetType, targetId, reminderOffset, channel])
```
- If task becomes event → `targetType` changes → different record
- No duplicates because `targetType` is part of unique key

**Solution 2: Cascade Delete**
```typescript
// When converting task → event:
await prisma.reminder.updateMany({
  where: { targetType: 'task', targetId: taskId },
  data: { status: 'cancelled' }
});
```

**Solution 3: Smart Merge**
```typescript
// If task.dueAt === event.startTime:
// Transfer reminder instead of creating new one
await prisma.reminder.updateMany({
  where: { targetType: 'task', targetId: taskId },
  data: { 
    targetType: 'calendar_event',
    targetId: eventId
  }
});
```

---

### "Follow Up with Lead" Reminders

**Question:** Task vs Event vs Both?

**Recommendation: Task**
- Calendar events are time-bound (1:00 PM - 2:00 PM)
- "Follow up with lead" is deadline-oriented (do it by EOD, not at specific time)
- Tasks support open-ended "due by" without rigid time slot

**Model:**
```prisma
model Task {
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  title     String
  status    String   // 'pending' | 'completed' | 'cancelled'
  dueAt     DateTime? // Optional deadline
  leadId    String?  // Link to lead
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([orgId, userId, status])
  @@index([orgId, leadId])
}
```

**Reminder Creation:**
```typescript
// When task has dueAt:
if (task.dueAt) {
  await prisma.reminder.create({
    data: {
      orgId: task.orgId,
      userId: task.userId,
      targetType: 'task',
      targetId: task.id,
      remindAt: new Date(task.dueAt.getTime() - 60 * 60 * 1000), // 1 hour before
      reminderOffset: -60,
      channel: 'in_app',
      status: 'pending',
      idempotencyKey: `${task.orgId}:task:${task.id}:-60:in_app`
    }
  });
}
```

---

## ⚠️ 6. MAINTAINABILITY / SECOND-ORDER RISKS

### Likely Future Problems

#### 1. Drift Between Task/Event Models

**Risk:**
- Tasks and Events evolve separately
- Reminders work for events but break for tasks (or vice versa)

**Mitigation:**
- **Shared Interface:** Define `Remindable` interface
  ```typescript
  interface Remindable {
    id: string;
    orgId: string;
    userId: string;
    getRemindAt(offset: number): Date; // Abstract "when to remind"
  }
  ```
- **Unified Service:** `ReminderService.createForTarget(target: Remindable, offset: number)`

---

#### 2. Reminder Fan-Out Complexity

**Risk:**
- User creates 100 events → 100 reminders
- User deletes event → orphaned reminders
- User updates event time → stale `remindAt`

**Mitigation:**
- **Cascade Delete:** When event deleted, cancel reminders:
  ```typescript
  await prisma.reminder.updateMany({
    where: { targetType: 'calendar_event', targetId: eventId },
    data: { status: 'cancelled' }
  });
  ```
- **Recompute on Update:** When event time changes:
  ```typescript
  await prisma.reminder.updateMany({
    where: { targetType: 'calendar_event', targetId: eventId },
    data: {
      remindAt: new Date(event.startTime.getTime() + reminderOffset * 60 * 1000)
    }
  });
  ```
- **Soft Delete:** Keep reminders for audit trail (don't hard delete)

---

#### 3. Notification Provider Coupling

**Risk:**
- Hardcode SendGrid logic everywhere
- Switch to Resend → rewrite all email code

**Mitigation:**
- **Adapter Pattern:**
  ```typescript
  interface NotificationProvider {
    send(reminder: Reminder): Promise<void>;
  }
  
  class InAppProvider implements NotificationProvider { ... }
  class EmailProvider implements NotificationProvider { ... }
  class SMSProvider implements NotificationProvider { ... }
  
  // Factory:
  function getProvider(channel: string): NotificationProvider {
    switch (channel) {
      case 'in_app': return new InAppProvider();
      case 'email': return new EmailProvider();
      case 'sms': return new SMSProvider();
    }
  }
  ```

---

#### 4. Timezone Bugs

**Risk:**
- Event created in PST, user in EST → reminder fires at wrong time
- Daylight Saving Time transitions → reminder off by 1 hour
- Server clock drift → reminders fire early/late

**Mitigation:**
- **Always Use UTC in DB:** Store `remindAt` as `@db.Timestamptz` (Postgres stores as UTC)
- **Compute in Org Timezone:**
  ```typescript
  import { zonedTimeToUtc } from 'date-fns-tz';
  
  const orgTimezone = org.timezone; // e.g., "America/Los_Angeles"
  const eventLocalTime = "2024-01-15 13:00:00"; // 1:00 PM local
  const eventUTC = zonedTimeToUtc(eventLocalTime, orgTimezone);
  const remindAtUTC = new Date(eventUTC.getTime() - 60 * 60 * 1000);
  ```
- **Test Across Timezones:** Unit tests for EST, PST, UTC
- **Handle DST:** Use `date-fns-tz` or `luxon` (handles DST automatically)

---

#### 5. Dev vs Prod Behavior Mismatch

**Current State:**
- Dev mode: No database, in-memory leads store
- Prod mode: Postgres database

**Risk:**
- Reminders work in prod but not dev (or vice versa)

**Mitigation:**
- **Shared Code Path:**
  ```typescript
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  
  if (hasDatabase) {
    await prisma.reminder.create({ data: {...} });
  } else {
    // In-memory fallback (dev mode):
    remindersByOrg[orgId] = remindersByOrg[orgId] || [];
    remindersByOrg[orgId].push(reminder);
  }
  ```
- **Test Both Modes:** CI runs tests in dev mode (no DB) and prod mode (with DB)

---

### Recommended Modular Boundaries

```
server/src/
├── reminders/
│   ├── reminderService.ts      // CRUD operations
│   ├── reminderScheduler.ts    // Periodic scan logic
│   ├── reminderNotifier.ts     // Send notifications
│   ├── providers/
│   │   ├── InAppProvider.ts
│   │   ├── EmailProvider.ts
│   │   ├── SMSProvider.ts
│   │   └── PushProvider.ts
│   └── utils/
│       ├── timezoneHelper.ts
│       └── idempotencyHelper.ts
├── routes/
│   ├── reminders.ts            // API endpoints
│   ├── calendar.ts             // (existing)
│   └── tasks.ts                // (new)
└── models/
    └── reminder.ts             // Prisma model + types
```

**Benefits:**
- Clear separation of concerns
- Easy to swap providers
- Testable in isolation
- Safe to delete if wrong approach

---

## 📋 7. MINIMAL IMPLEMENTATION PLAN

### Phase 1: Foundation (No Notifications Yet)

**Goal:** Add `Reminder` model, link to events

1. **Update Prisma Schema:**
   - Add `Reminder` model (see section 2)
   - Run migration: `npx prisma migrate dev --name add_reminders`

2. **Create Reminder Service:**
   - `server/src/reminders/reminderService.ts`
   - Functions: `createReminder()`, `cancelReminder()`, `updateReminder()`, `getDueReminders()`

3. **Update Calendar Routes:**
   - On `POST /calendar/create`: Create reminder (if user wants one)
   - On `PATCH /calendar/update/:id`: Update/recompute reminder `remindAt`
   - On `DELETE /calendar/:id`: Cancel reminder

4. **Add API Endpoints:**
   - `GET /api/reminders/due` - fetch pending reminders
   - `PATCH /api/reminders/:id/mark-sent` - mark as sent (for in-app)

**Deliverable:** Reminders stored in DB, no delivery yet

---

### Phase 2: In-App Notifications (MVP)

**Goal:** Show reminders as toasts when user has app open

5. **Add Reminder Scheduler:**
   - `server/src/reminders/reminderScheduler.ts`
   - Periodic scan (every 60s) for due reminders
   - Call `InAppProvider.send()` for each

6. **Create In-App Provider:**
   - `server/src/reminders/providers/InAppProvider.ts`
   - Store notification in DB table or in-memory queue
   - Frontend polls `GET /api/reminders/due` every 30s

7. **Frontend Integration:**
   - Hook: `useReminders()` - polls `/api/reminders/due`
   - Show toast via existing `NotificationTray.tsx`
   - Add to "Needs Attention" card

**Deliverable:** User sees reminder toast 1 hour before event

---

### Phase 3: Reminder UI (Calendar)

**Goal:** User can configure reminders when creating/editing events

8. **Add UI to EventModal:**
   - Checkbox: "Remind me 1 hour before"
   - Dropdown: "15 minutes / 1 hour / 1 day before"
   - Multi-select: channels (in-app, email, SMS)

9. **Update Event Create/Edit:**
   - Send `reminderOffset` and `channels` in request
   - Backend creates/updates reminders accordingly

**Deliverable:** User controls reminder timing per event

---

### Phase 4: Tasks Backend

**Goal:** Implement Tasks API (currently missing)

10. **Add Task Model to Prisma:**
    - See section 5 for schema

11. **Create Task Routes:**
    - `GET /api/tasks` - list tasks
    - `POST /api/tasks` - create task
    - `PATCH /api/tasks/:id` - update task
    - `DELETE /api/tasks/:id` - delete task

12. **Link Tasks to Reminders:**
    - On task create with `dueAt`: create reminder
    - Support same reminder offsets as events

**Deliverable:** Tasks persisted, reminders work for tasks

---

### Phase 5: Advanced Channels (Optional)

**Goal:** Email, SMS, Push (if required)

13. **Add Email Provider:**
    - Choose SendGrid/Resend/AWS SES
    - Implement `EmailProvider.send()`
    - Add email templates

14. **Add SMS Provider:**
    - Choose Twilio/AWS SNS
    - Implement `SMSProvider.send()`

15. **Add Push Provider:**
    - Implement service worker
    - Add VAPID keys
    - Implement `PushProvider.send()`

**Deliverable:** Multi-channel notifications

---

### Step-by-Step Summary

1. ✅ Add `Reminder` model to Prisma
2. ✅ Create `reminderService.ts` (CRUD)
3. ✅ Update calendar routes to create/cancel reminders
4. ✅ Add `GET /api/reminders/due` endpoint
5. ✅ Add `reminderScheduler.ts` (periodic scan)
6. ✅ Create `InAppProvider.ts`
7. ✅ Frontend: `useReminders()` hook + toast integration
8. ✅ UI: Add reminder controls to EventModal
9. ✅ Add `Task` model to Prisma
10. ✅ Create `/api/tasks` routes
11. ✅ Link tasks to reminders
12. ⚠️ (Optional) Add email/SMS/push providers

**Each step is independently testable and reversible.**

---

## 🎯 RECOMMENDED ARCHITECTURE (MVP)

### Stack
- **Database:** Postgres (existing) + `Reminder` model
- **Scheduler:** `setInterval` in `server.ts` (every 60s)
- **Channels:** In-app only (toast notifications)
- **Polling:** Frontend polls `GET /api/reminders/due` every 30s

### Data Flow
```
1. User creates event (1:00 PM today)
2. Backend creates CalendarEvent + Reminder (remindAt = 12:00 PM)
3. Every 60s, scheduler checks: SELECT * FROM reminders WHERE remindAt <= NOW()
4. Found reminder → call InAppProvider.send(reminder)
5. InAppProvider stores notification in DB or in-memory
6. Frontend polls GET /api/reminders/due every 30s
7. Frontend shows toast via NotificationTray.tsx
8. User clicks toast → navigate to /calendar
```

### Why This Works
- **No new infra:** Uses existing Postgres + Node.js server
- **No external costs:** No SendGrid/Twilio
- **Works in dev mode:** Polling works without DATABASE_URL (in-memory fallback)
- **Scalable enough:** Handles 1000s of reminders/day
- **Easy to delete:** All code in `server/src/reminders/` folder

---

## 🚀 FUTURE-PROOF UPGRADE PATH

### When to Upgrade

**Option 1A → Option 1B (WebSocket):**
- **When:** Polling feels slow (>1000 users)
- **How:** Implement WebSocket server, push reminders to connected clients

**Option 1 → Option 2 (Web Push):**
- **When:** Users request offline notifications
- **How:** Add service worker, VAPID keys, push subscriptions

**Option 1 → Option 3 (Email/SMS):**
- **When:** Product requires email/SMS (B2B customers)
- **How:** Add SendGrid/Twilio, job queue (BullMQ + Redis)

**Periodic Scan → Job Queue:**
- **When:** >10,000 reminders/hour or need precise timing
- **How:** Replace `setInterval` with BullMQ, add Redis, separate worker process

### Migration Path

**All upgrades are additive:**
1. Keep `Reminder` model (no schema changes)
2. Add new provider (`EmailProvider.ts`, `PushProvider.ts`)
3. Update `channel` enum (`in_app` | `email` | `sms` | `push`)
4. User chooses channels in UI

**No breaking changes to existing in-app reminders.**

---

## 📊 SECOND-ORDER EFFECTS / FAILURE MODES

### 1. Reminder Spam
**Scenario:** User creates 50 events → 50 reminders fire at once
**Mitigation:** Rate limit notifications (max 5 toasts/minute)

### 2. Timezone Hell
**Scenario:** User travels PST → EST, reminders fire at wrong time
**Mitigation:** Store reminders in UTC, display in user's current timezone

### 3. Stale Reminders
**Scenario:** Event deleted, reminder still fires
**Mitigation:** Cascade delete (section 6.2)

### 4. Double Notifications
**Scenario:** User has 2 tabs open, both poll, both show toast
**Mitigation:** Use `localStorage` to coordinate (`localStorage.setItem('lastShown:' + reminderId, Date.now())`)

### 5. Clock Drift
**Scenario:** User's clock is 10 minutes fast, reminder fires early
**Mitigation:** Use server time (`remindAt` stored in DB is authoritative)

### 6. Missed Reminders (Server Down)
**Scenario:** Server restarts at 12:00 PM, reminder was due at 11:59 AM
**Mitigation:** On startup, scan for reminders with `remindAt < NOW() AND status='pending'`, send immediately

### 7. Reminder Fatigue
**Scenario:** Too many reminders, user ignores all
**Mitigation:** Smart defaults (only 1 hour before), user can disable per-event

### 8. Dev Mode Confusion
**Scenario:** Reminders work in prod but not dev (no DATABASE_URL)
**Mitigation:** In-memory fallback for dev mode (see section 6.5)

---

## ✅ CONCLUSION

**Start with:**
1. Add `Reminder` model to Prisma
2. Implement periodic scan scheduler (60s interval)
3. In-app notifications via polling (existing toast UI)
4. Add reminder controls to calendar event modal

**This gives you:**
- Working reminders in < 1 week
- Zero new dependencies
- Testable in dev mode
- Upgrade path to email/SMS/push later

**Avoid:**
- Job queues (premature optimization)
- Email/SMS (adds cost + complexity)
- WebSocket server (can add later if needed)

**Safe to proceed:** All code is additive, easily reversible, and follows existing patterns in the codebase.










