# Phase 2 Verification: Calendar → Reminders Integration

**Goal:** Verify that calendar events correctly create, update, and cancel in-app reminders.

---

## Prerequisites

1. **Phase 0 & 1 must pass:** Ensure server boots, reminders API works, and frontend polling is active.
2. **Backend running:** `cd server && npm run dev`
3. **Frontend running:** `cd web && npm run dev`
4. **Dev auth bypass enabled:** `DEV_AUTH_BYPASS=1` is set in backend

---

## Test Cases

### Test 1: Create Event with Reminder Enabled (Default)

**Goal:** Verify reminder is created when a new calendar event is created.

#### Steps:
1. Navigate to Calendar page in the UI
2. Click "Create Event"
3. Fill in:
   - Title: "Test Event with Reminder"
   - Date: Today
   - Start time: 2 hours from now (e.g., if it's 10:00, set 12:00)
   - End time: 3 hours from now (e.g., 13:00)
   - Notes: "Testing Phase 2"
   - **Reminder:** Keep "Remind me" checked, select "1 hour before"
4. Click "Save"

#### Backend Verification (Terminal):
```bash
# Check backend logs for:
# [CALENDAR CREATE] ✓ Event created successfully
# [CALENDAR CREATE] ✓ Reminder created for event

# Query the reminders API to confirm reminder exists
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

#### Expected:
- Event appears in calendar UI
- Backend logs show reminder created
- `/api/reminders/due` returns the reminder if it's already within 1 hour of the event start time (status: 'sent' if scheduler already processed it, or may be empty if reminder is still in 'pending' state and not yet due)

---

### Test 2: Create Event with Reminder Disabled

**Goal:** Verify no reminder is created when "Remind me" is unchecked.

#### Steps:
1. Click "Create Event"
2. Fill in:
   - Title: "Event without Reminder"
   - Date: Tomorrow
   - Start time: 14:00
   - End time: 15:00
   - **Reminder:** Uncheck "Remind me"
3. Click "Save"

#### Backend Verification:
```bash
# Check backend logs - should NOT show reminder creation message

# Query reminders - should NOT include this event
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

#### Expected:
- Event appears in calendar UI
- Backend logs do NOT show "✓ Reminder created"
- `/api/reminders/due` does not include a reminder for this event

---

### Test 3: Update Event Time (Reminder Updates)

**Goal:** Verify reminder `remindAt` updates when event start time changes.

#### Steps:
1. Create an event with reminder enabled for tomorrow at 10:00
2. Save the event
3. Note the event ID from backend logs (or UI)
4. Edit the event, change start time to 15:00 (same day)
5. Keep "Remind me" checked, keep offset at "1 hour before"
6. Click "Save"

#### Backend Verification:
```bash
# Check backend logs for:
# [CALENDAR UPDATE] ✓ Reminder updated for event

# If using DATABASE_URL, you can check Prisma DB directly
# Otherwise, reminders are in-memory and will be reflected in /api/reminders/due
```

#### Expected:
- Event time updates in UI
- Backend logs show "✓ Reminder updated for event"
- Reminder `remindAt` is now 1 hour before the new start time (14:00 in this example)

---

### Test 4: Disable Reminder on Update

**Goal:** Verify reminders are cancelled when "Remind me" is unchecked during edit.

#### Steps:
1. Create an event with reminder enabled
2. Edit the event
3. Uncheck "Remind me"
4. Click "Save"

#### Backend Verification:
```bash
# Check backend logs for:
# [CALENDAR UPDATE] ✓ Reminders cancelled for event

# Query reminders
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

#### Expected:
- Event remains in calendar
- Backend logs show "✓ Reminders cancelled"
- `/api/reminders/due` no longer includes this event's reminder

---

### Test 5: Delete Event Cancels Reminders

**Goal:** Verify reminders are cancelled when an event is deleted.

#### Steps:
1. Create an event with reminder enabled
2. Note the event ID
3. Delete the event from the UI

#### Backend Verification:
```bash
# Check backend logs for:
# [CALENDAR DELETE] (should show reminder cancellation attempt)

# Query reminders - should not include deleted event
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

#### Expected:
- Event removed from calendar UI
- Backend logs may show reminder cancellation (non-blocking)
- `/api/reminders/due` does not include reminders for deleted event

---

### Test 6: End-to-End Reminder Notification (Quick Test)

**Goal:** Verify scheduler processes reminder and frontend displays toast.

#### Steps:
1. Create an event with:
   - Start time: **2 minutes from now**
   - Reminder offset: **1 minute before** (select from dropdown; this is a dev/test option)
2. Save the event
3. Wait **1 minute** (reminder should become due)
4. Wait up to **60 seconds** for scheduler to mark reminder as `sent`
5. Wait up to **30 seconds** for frontend to poll and display the reminder toast

#### Backend Verification:
```bash
# Watch backend logs for scheduler output:
# [REMINDER SCHEDULER] Processed X due reminders.

# Check reminders/due before and after scheduler runs
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

#### Expected:
- Reminder appears in `/api/reminders/due` after scheduler processes it
- Frontend `useReminders` hook polls and displays a toast notification (via `NotificationTray`)
- Toast shows event reminder message
- After toast is shown, frontend calls `/api/reminders/:id/mark-delivered`
- Subsequent polls no longer return this reminder

---

## Edge Cases & Safety Checks

### Edge Case 1: Multiple Reminder Offsets

**Scenario:** User creates an event with "1 hour before", then edits it to "15 minutes before".

**Expected:** Only one reminder exists per event (idempotency key ensures upsert). The reminder `remindAt` is updated to 15 minutes before start.

**Verification:**
```bash
# After editing, query reminders
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool

# Confirm only ONE reminder for this event, with updated offset
```

---

### Edge Case 2: Org/User Scoping

**Scenario:** User A creates an event with reminder. User B should NOT see User A's reminder.

**Verification:**
```bash
# Query as User A
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool

# Query as User B (different user, same org)
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_other" | python3 -m json.tool

# User B should NOT see User A's reminders
```

---

### Edge Case 3: Calendar Event Deletion Race Condition

**Scenario:** Event is deleted while reminder is being processed by scheduler.

**Expected:** Reminder cancellation is best-effort. If scheduler already marked it `sent`, frontend may briefly show a stale reminder, but `mark-delivered` will succeed (idempotent).

**Verification:** Manually test by deleting an event immediately after creating it with a 1-minute reminder. Scheduler should not crash.

---

## Manual Backend Testing (Without UI)

If you want to test the backend routes directly without the UI:

### Create Event with Reminder
```bash
curl -i -X POST http://localhost:3010/api/calendar/create \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "title": "Backend Test Event",
    "date": "2026-01-06",
    "startTime": "14:00",
    "endTime": "15:00",
    "notes": "Testing reminders",
    "urgency": "medium",
    "enableReminder": true,
    "reminderOffset": -60
  }'
```

### Update Event (Change Time)
```bash
# Replace {eventId} with actual ID from create response
curl -i -X PATCH http://localhost:3010/api/calendar/update/{eventId} \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "startTime": "16:00",
    "enableReminder": true,
    "reminderOffset": -15
  }'
```

### Delete Event
```bash
curl -i -X DELETE http://localhost:3010/api/calendar/{eventId} \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev"
```

---

## Debugging Tips

### Problem: Reminder not created
- Check backend logs for errors in `[CALENDAR CREATE]`
- Verify `enableReminder` field is being sent in request payload (check Network tab)
- Confirm `reminderService` functions are imported correctly

### Problem: Frontend toast not showing
- Verify `useReminders` hook is called in `App.tsx`
- Check browser console for polling errors
- Confirm `/api/reminders/due` returns data (use curl)
- Verify `NotificationTray` is rendered in `App.tsx`

### Problem: Duplicate reminders
- Check idempotency key generation in `reminderService.ts` → `buildIdempotencyKey`
- Verify upsert logic in `reminderStore.ts` → `upsertReminderByIdempotencyKey`
- Confirm Prisma schema has `@@unique([...])` constraint on idempotency fields

### Problem: Scheduler not processing reminders
- Check backend logs for `[REMINDER SCHEDULER]` messages
- Verify `startReminderScheduler()` is called in `server.ts` after `app.listen`
- Ensure reminders have `status='pending'` and `remindAt` is in the past

---

## Success Criteria Summary

- ✅ Creating event with reminder enabled → reminder persisted
- ✅ Creating event with reminder disabled → no reminder created
- ✅ Updating event time → reminder `remindAt` updated
- ✅ Disabling reminder on update → reminder cancelled
- ✅ Deleting event → reminders cancelled
- ✅ Scheduler marks due reminders as `sent`
- ✅ Frontend polls and displays toast notification
- ✅ Frontend marks reminder as delivered after toast shown
- ✅ Org/user scoping prevents cross-tenant reminder access
- ✅ Idempotency prevents duplicate reminders per event

---

**Phase 2 Status:** If all tests pass, Phase 2 is complete and safe for Phase 3 (Tasks integration).










