/**
 * Reminder Service - Business logic for reminders
 * 
 * Handles idempotency, validation, and orchestration of reminder operations.
 */

import {
  createReminder as storeCreateReminder,
  getDuePendingReminders,
  getSentRemindersForUser,
  getMissedRemindersForUser as getMissedRemindersForUserFromStore,
  markReminderSent,
  markReminderMissed,
  markReminderDelivered as storeMarkDelivered,
  getReminderById,
  cancelRemindersByTarget,
  upsertReminderByIdempotencyKey,
  type Reminder,
  type ReminderInput
} from './reminderStore.js';

/**
 * Build idempotency key for a reminder
 */
export function buildIdempotencyKey(
  orgId: string,
  userId: string,
  targetType: string,
  targetId: string,
  reminderOffset: number,
  channel: string
): string {
  return `${orgId}:${userId}:${targetType}:${targetId}:${reminderOffset}:${channel}`;
}

/**
 * Create a new reminder with validation
 */
export async function createReminder(params: {
  orgId: string;
  userId: string;
  targetType: string;
  targetId: string;
  remindAt: Date;
  reminderOffset?: number;
  channel?: string;
  timezone?: string | null;
}): Promise<Reminder> {
  const {
    orgId,
    userId,
    targetType,
    targetId,
    remindAt,
    reminderOffset = -60, // Default: 1 hour before
    channel = 'in_app',
    timezone = null
  } = params;

  // Validate remindAt is in the future
  if (remindAt <= new Date()) {
    throw new Error('remindAt must be in the future');
  }

  const idempotencyKey = buildIdempotencyKey(
    orgId,
    userId,
    targetType,
    targetId,
    reminderOffset,
    channel
  );

  const input: ReminderInput = {
    orgId,
    userId,
    targetType,
    targetId,
    remindAt,
    reminderOffset,
    channel,
    timezone: timezone || null,
    status: 'pending',
    idempotencyKey
  };

  return await storeCreateReminder(input);
}

/**
 * Get due sent reminders for a user (for frontend polling)
 */
export async function getDueSentRemindersForUser(
  orgId: string,
  userId: string,
  limit: number = 50
): Promise<Reminder[]> {
  return await getSentRemindersForUser(orgId, userId, limit);
}

/**
 * Get missed reminders for a user (for frontend polling with includeMissed=1)
 */
export async function getMissedRemindersForUser(
  orgId: string,
  userId: string,
  limit: number = 50
): Promise<Reminder[]> {
  return await getMissedRemindersForUserFromStore(orgId, userId, limit);
}

/**
 * Mark reminder as delivered (idempotent)
 */
export async function markDelivered(
  reminderId: string,
  orgId: string,
  userId: string
): Promise<{ success: boolean; reminder?: Reminder; error?: string }> {
  // Verify ownership
  const existing = await getReminderById(reminderId, orgId, userId);
  
  if (!existing) {
    return { success: false, error: 'Reminder not found or access denied' };
  }

  // Idempotent: if already delivered, return success
  if (existing.status === 'delivered' && existing.deliveredAt) {
    return { success: true, reminder: existing };
  }

  const updated = await storeMarkDelivered(reminderId, orgId, userId);
  
  if (!updated) {
    return { success: false, error: 'Failed to mark delivered' };
  }

  return { success: true, reminder: updated };
}

/**
 * Scan for due pending reminders and mark them as sent or missed
 * Called by scheduler every 60s
 * Implements grace period: reminders within grace window become "sent", outside become "missed"
 */
export async function scanAndMarkDueAsSent(now: Date): Promise<number> {
  // Grace period config (60 minutes default, can be overridden by env)
  const GRACE_MINUTES = parseInt(process.env.REMINDER_GRACE_MINUTES || '60', 10);
  const GRACE_MS = GRACE_MINUTES * 60 * 1000;
  
  const dueReminders = await getDuePendingReminders(now, 100);
  
  let markedCount = 0;
  
  for (const reminder of dueReminders) {
    // Only transition from pending/scheduled status (idempotency)
    if (reminder.status !== 'pending' && reminder.status !== 'scheduled') {
      continue;
    }
    
    // Calculate how late the reminder is
    const delayMs = now.getTime() - reminder.remindAt.getTime();
    
    // If within grace period, mark as sent (eligible for toast)
    if (delayMs <= GRACE_MS) {
      const updated = await markReminderSent(reminder.id);
      if (updated) {
        markedCount++;
      }
    } else {
      // Outside grace period, mark as missed (no toast, appears in missed inbox)
      const updated = await markReminderMissed(reminder.id);
      if (updated) {
        markedCount++;
      }
    }
  }
  
  return markedCount;
}

/**
 * Create or update reminder for a calendar event
 * Idempotent: uses upsert by idempotency key
 */
export async function createOrUpdateReminderForCalendarEvent(params: {
  orgId: string;
  userId: string;
  eventId: string | number;
  eventStartTimeUtc: Date;
  reminderOffset?: number;
  timezone?: string | null;
}): Promise<Reminder> {
  const {
    orgId,
    userId,
    eventId,
    eventStartTimeUtc,
    reminderOffset = -60, // Default: 1 hour before
    timezone = null
  } = params;

  const eventIdStr = String(eventId);
  const channel = 'in_app';
  
  // Compute remindAt
  const remindAt = new Date(eventStartTimeUtc.getTime() + reminderOffset * 60 * 1000);

  // Validate remindAt is in the future (or allow past for testing in dev)
  // For Phase 2, we allow past times to support testing
  // if (remindAt <= new Date()) {
  //   throw new Error('remindAt must be in the future');
  // }

  const idempotencyKey = buildIdempotencyKey(
    orgId,
    userId,
    'calendar_event',
    eventIdStr,
    reminderOffset,
    channel
  );

  const input: ReminderInput = {
    orgId,
    userId,
    targetType: 'calendar_event',
    targetId: eventIdStr,
    remindAt,
    reminderOffset,
    channel,
    timezone: timezone || null,
    status: 'pending',
    idempotencyKey
  };

  return await upsertReminderByIdempotencyKey(input, { remindAt, reminderOffset });
}

/**
 * Cancel all reminders for a calendar event
 */
export async function cancelRemindersForCalendarEvent(params: {
  orgId: string;
  userId: string;
  eventId: string | number;
}): Promise<number> {
  const { orgId, userId, eventId } = params;
  const eventIdStr = String(eventId);
  
  return await cancelRemindersByTarget(
    orgId,
    userId,
    'calendar_event',
    eventIdStr
  );
}

/**
 * Create or update reminder for a task
 * Idempotent: uses upsert by idempotency key
 */
export async function createOrUpdateReminderForTask(params: {
  orgId: string;
  userId: string;
  taskId: string;
  taskDueAt: Date;
  reminderOffset?: number;
  timezone?: string | null;
}): Promise<Reminder> {
  const {
    orgId,
    userId,
    taskId,
    taskDueAt,
    reminderOffset = -60, // Default: 1 hour before
    timezone = null
  } = params;

  const channel = 'in_app';
  
  // Compute remindAt
  const remindAt = new Date(taskDueAt.getTime() + reminderOffset * 60 * 1000);

  const idempotencyKey = buildIdempotencyKey(
    orgId,
    userId,
    'task',
    taskId,
    reminderOffset,
    channel
  );

  const input: ReminderInput = {
    orgId,
    userId,
    targetType: 'task',
    targetId: taskId,
    remindAt,
    reminderOffset,
    channel,
    timezone: timezone || null,
    status: 'pending',
    idempotencyKey
  };

  return await upsertReminderByIdempotencyKey(input, { remindAt, reminderOffset });
}

/**
 * Cancel all reminders for a task
 */
export async function cancelRemindersForTask(params: {
  orgId: string;
  userId: string;
  taskId: string;
}): Promise<number> {
  const { orgId, userId, taskId } = params;
  
  return await cancelRemindersByTarget(
    orgId,
    userId,
    'task',
    taskId
  );
}

