# Phase 3 Verification: Tasks Backend + Task Reminders

**Goal:** Verify that tasks can be created, updated, deleted via API with full reminder integration.

---

## Prerequisites

1. **Phase 0, 1, & 2 must pass:** Reminders infrastructure and calendar reminders working
2. **Prisma migration required:** Task model must be added to database
3. **Backend running:** `cd server && npm run dev`
4. **Frontend running:** `cd web && npm run dev`
5. **Dev auth bypass enabled:** `DEV_AUTH_BYPASS=1` is set in backend

---

## STEP 1: Apply Prisma Migration

### 1.1 Create Migration

```bash
cd /Users/imceobitch/dev/dealflowos-Cursor-/server

# Create migration for Task model
npx prisma migrate dev --name add_tasks

# Regenerate Prisma client
npx prisma generate
```

**Expected Output:**
- Migration file created in `prisma/migrations/` directory
- Prisma client regenerated with `prisma.task.*` methods available

### 1.2 Verify Backend Boots

```bash
# Restart backend
pkill -f "tsx watch" 2>/dev/null || true
npm run dev
```

**Expected Boot Logs:**
```
>>> Tasks router mounted at /api/tasks (using in-memory store)
```

OR (if DATABASE_URL is set):
```
>>> Tasks router mounted at /api/tasks (using database)
```

---

## Test Cases

### Test 1: Create Task Without dueAt (No Reminder)

**Goal:** Verify basic task creation without reminder.

#### Command:
```bash
curl -i -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "title": "Test Task No Due Date",
    "description": "This task has no due date"
  }'
```

#### Expected:
- Status: `201 Created`
- Body: JSON with task object including `id`, `title`, `status: "pending"`, `dueAt: null`
- Backend logs:
  - `[TASKS API] ✓ Task created` (or similar - no reminder log)

#### Verification:
```bash
# List tasks
curl -s http://localhost:3010/api/tasks \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

**Expected:**
- Task appears in list with `dueAt: null`

---

### Test 2: Create Task With dueAt + Reminder (Fast Test)

**Goal:** Verify reminder is created and delivered for task.

#### Command:
```bash
# Create task due in 2 minutes with -1 minute reminder (fires in 1 minute)
DUE_AT=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")

curl -i -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d "{
    \"title\": \"Test Task With Reminder\",
    \"description\": \"Due in 2 minutes\",
    \"dueAt\": \"$DUE_AT\",
    \"enableReminder\": true,
    \"reminderOffset\": -1
  }"
```

#### Expected:
- Status: `201 Created`
- Backend logs:
  - `[TASKS API] ✓ Reminder created for task`

#### Verification (Check Reminder Created):
```bash
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

**Expected (after ~1 minute + scheduler run):**
- Reminder appears with `targetType: "task"`, `status: "sent"`

#### Verification (Frontend Toast):
- Wait 1-2 minutes
- Frontend should poll and display toast notification
- Toast should show task reminder message

---

### Test 3: Update Task dueAt → Reminder Updates

**Goal:** Verify reminder `remindAt` updates when task dueAt changes.

#### Command:
```bash
# Get task ID from previous test, then update dueAt
TASK_ID="<task_id_from_test_2>"
NEW_DUE_AT=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")

curl -i -X PATCH "http://localhost:3010/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d "{
    \"dueAt\": \"$NEW_DUE_AT\",
    \"reminderOffset\": -60
  }"
```

#### Expected:
- Status: `200 OK`
- Backend logs:
  - `[TASKS API] ✓ Reminder updated for task`

#### Verification:
```bash
# Check reminder was updated (remindAt should be 1 hour before new dueAt)
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

**Expected:**
- Reminder for this task has updated `remindAt` timestamp

---

### Test 4: Complete Task → Reminder Cancelled

**Goal:** Verify reminders are cancelled when task is completed.

#### Command:
```bash
TASK_ID="<task_id_from_test_2>"

curl -i -X PATCH "http://localhost:3010/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "status": "completed"
  }'
```

#### Expected:
- Status: `200 OK`
- Backend logs:
  - `[TASKS API] ✓ Reminders cancelled for task`

#### Verification:
```bash
curl -s http://localhost:3010/api/reminders/due \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

**Expected:**
- Reminder for this task no longer appears (status changed to 'cancelled')

---

### Test 5: Remove dueAt → Reminder Cancelled

**Goal:** Verify reminders are cancelled when dueAt is removed.

#### Command:
```bash
# Create task with dueAt first
DUE_AT=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")

TASK_ID=$(curl -s -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d "{
    \"title\": \"Task With DueAt To Remove\",
    \"dueAt\": \"$DUE_AT\",
    \"enableReminder\": true
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Now remove dueAt
curl -i -X PATCH "http://localhost:3010/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "dueAt": null
  }'
```

#### Expected:
- Status: `200 OK`
- Backend logs:
  - `[TASKS API] ✓ Reminders cancelled for task`

---

### Test 6: Delete Task → Reminders Cancelled

**Goal:** Verify reminders are cancelled when task is deleted.

#### Command:
```bash
# Create task with reminder
DUE_AT=$(python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")

TASK_ID=$(curl -s -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d "{
    \"title\": \"Task To Delete\",
    \"dueAt\": \"$DUE_AT\",
    \"enableReminder\": true
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Delete task
curl -i -X DELETE "http://localhost:3010/api/tasks/$TASK_ID" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev"
```

#### Expected:
- Status: `200 OK`
- Body: `{"success": true}`
- Backend logs show reminder cancellation attempt

#### Verification:
```bash
# Task should not appear in list
curl -s http://localhost:3010/api/tasks \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

**Expected:**
- Task with that ID is gone

---

### Test 7: Org/User Isolation

**Goal:** Verify tasks are scoped per org+user.

#### Command:
```bash
# Create task as user_dev
curl -s -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "title": "User Dev Task"
  }' | python3 -m json.tool

# Try to list as different user
curl -s http://localhost:3010/api/tasks \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_other" | python3 -m json.tool
```

#### Expected:
- `user_other` does NOT see `user_dev`'s tasks

---

## Frontend UI Tests

### Test 8: TasksPage Displays Tasks

**Goal:** Verify TasksPage loads and displays tasks from API.

#### Steps:
1. Navigate to `http://localhost:5173/tasks` in browser
2. Wait for page to load

#### Expected:
- Loading message briefly appears: "Loading tasks..."
- Tasks created via curl appear in the list
- Each task shows title and status badge
- No "local" badge (replaced with "due" or "pending")
- Footer text: "Tasks now persist via backend API (Phase 3)."

---

### Test 9: Create Task via UI

**Goal:** Verify task creation works from frontend.

#### Steps:
1. On TasksPage, click in the input field
2. Type: "UI Test Task"
3. Press Enter OR click the "+" button

#### Expected:
- Task appears at top of list immediately
- Network tab shows `POST /api/tasks` with 201 response
- Backend logs show task creation

#### Verification (Backend):
```bash
curl -s http://localhost:3010/api/tasks \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" | python3 -m json.tool
```

**Expected:**
- "UI Test Task" appears in response

---

### Test 10: Refresh Persistence

**Goal:** Verify tasks persist across page refresh.

#### Steps:
1. Create task via UI
2. Refresh browser (Cmd+R / Ctrl+R)
3. Wait for page to reload

#### Expected:
- Task still appears in list after refresh
- No loss of data

---

## Edge Cases

### Edge Case 1: Invalid dueAt Format

```bash
curl -i -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "title": "Invalid Date Task",
    "dueAt": "not-a-date"
  }'
```

**Expected:**
- Status: `400 Bad Request`
- Error message about invalid date format

---

### Edge Case 2: Empty Title

```bash
curl -i -X POST http://localhost:3010/api/tasks \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "title": ""
  }'
```

**Expected:**
- Status: `400 Bad Request`
- Validation error about title being required

---

### Edge Case 3: Update Non-Existent Task

```bash
curl -i -X PATCH http://localhost:3010/api/tasks/nonexistent-id \
  -H "Content-Type: application/json" \
  -H "x-dev-org-id: org_dev" \
  -H "x-dev-user-id: user_dev" \
  -d '{
    "title": "Updated"
  }'
```

**Expected:**
- Status: `404 Not Found`

---

## Rollback Instructions

If Phase 3 needs to be reverted:

### 1. Remove Task Model from Prisma

```bash
cd /Users/imceobitch/dev/dealflowos-Cursor-/server

# Edit prisma/schema.prisma and remove the Task model block
# Then create a rollback migration
npx prisma migrate dev --name remove_tasks

# Regenerate Prisma client
npx prisma generate
```

### 2. Remove Backend Files

```bash
# Delete task-specific files
rm server/src/tasks/taskStore.ts
rm server/src/routes/tasks.ts

# Remove task reminder helpers from reminderService.ts
# (manually edit to remove createOrUpdateReminderForTask and cancelRemindersForTask)
```

### 3. Remove Server Mount

Edit `server/src/server.ts`:
- Remove `import tasksRouter from "./routes/tasks.js";`
- Remove the tasks router mount block

### 4. Revert Frontend

Revert `web/src/pages/TasksPage.tsx` to use local state (git checkout previous version).

### 5. Restart Services

```bash
cd server && npm run dev
cd web && npm run dev
```

---

## Success Criteria Summary

- ✅ Tasks can be created via API (with and without dueAt)
- ✅ Tasks persist across backend restarts (if DATABASE_URL set)
- ✅ Tasks can be updated, completed, cancelled, deleted
- ✅ Reminders created automatically when task has dueAt + enableReminder=true
- ✅ Reminders updated when task dueAt changes
- ✅ Reminders cancelled when task completed/cancelled/deleted or dueAt removed
- ✅ TasksPage loads and displays tasks from API
- ✅ TasksPage allows creating tasks via UI
- ✅ Org/user scoping prevents cross-tenant access
- ✅ Scheduler processes task reminders and frontend displays toasts
- ✅ All existing features (leads, calendar, reminders) remain unaffected

---

**Phase 3 Status:** If all tests pass, Phase 3 is complete and tasks + task reminders are fully integrated.










