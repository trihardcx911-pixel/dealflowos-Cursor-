/**
 * Reminder Store - Dual-mode CRUD (DB + in-memory fallback)
 * 
 * Provides reminder persistence with automatic fallback to in-memory storage
 * when DATABASE_URL is not available (dev mode).
 */

import { prisma } from "../db/prisma.js";

export interface Reminder {
  id: string;
  orgId: string;
  userId: string;
  targetType: string;
  targetId: string;
  remindAt: Date;
  reminderOffset: number;
  channel: string;
  timezone: string | null;
  status: string;
  idempotencyKey: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderInput {
  orgId: string;
  userId: string;
  targetType: string;
  targetId: string;
  remindAt: Date;
  reminderOffset: number;
  channel: string;
  timezone?: string | null;
  status: string;
  idempotencyKey: string;
}

const hasDatabase = Boolean(process.env.DATABASE_URL);

// In-memory store for dev mode (keyed by orgId)
const remindersByOrg: Record<string, Reminder[]> = {};

/**
 * Create a new reminder
 */
export async function createReminder(data: ReminderInput): Promise<Reminder> {
  if (hasDatabase) {
    return await prisma.reminder.create({ data });
  } else {
    // Dev mode: in-memory
    const reminder: Reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      timezone: data.timezone || null,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const key = data.orgId;
    if (!remindersByOrg[key]) {
      remindersByOrg[key] = [];
    }
    remindersByOrg[key].push(reminder);
    
    return reminder;
  }
}

/**
 * Get all reminders due for sending (status='pending', remindAt <= now)
 */
export async function getDuePendingReminders(now: Date, limit: number = 100): Promise<Reminder[]> {
  if (hasDatabase) {
    return await prisma.reminder.findMany({
      where: {
        status: 'pending',
        remindAt: { lte: now }
      },
      orderBy: { remindAt: 'asc' },
      take: limit
    });
  } else {
    // Dev mode: scan all orgs
    const allReminders: Reminder[] = [];
    for (const orgReminders of Object.values(remindersByOrg)) {
      allReminders.push(...orgReminders);
    }
    
    return allReminders
      .filter(r => r.status === 'pending' && r.remindAt <= now)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .slice(0, limit);
  }
}

/**
 * Get sent reminders for a specific user (for frontend polling)
 */
export async function getSentRemindersForUser(
  orgId: string,
  userId: string,
  limit: number = 50
): Promise<Reminder[]> {
  if (hasDatabase) {
    return await prisma.reminder.findMany({
      where: {
        orgId,
        userId,
        status: 'sent',
        deliveredAt: null
      },
      orderBy: { remindAt: 'asc' },
      take: limit
    });
  } else {
    // Dev mode: filter by orgId and userId
    const orgReminders = remindersByOrg[orgId] || [];
    return orgReminders
      .filter(r => 
        r.userId === userId && 
        r.status === 'sent' && 
        r.deliveredAt === null
      )
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .slice(0, limit);
  }
}

/**
 * Get missed reminders for a specific user (for frontend polling with includeMissed=1)
 */
export async function getMissedRemindersForUser(
  orgId: string,
  userId: string,
  limit: number = 50
): Promise<Reminder[]> {
  if (hasDatabase) {
    return await prisma.reminder.findMany({
      where: {
        orgId,
        userId,
        status: 'missed',
        deliveredAt: null
      },
      orderBy: { remindAt: 'asc' },
      take: limit
    });
  } else {
    // Dev mode: filter by orgId and userId
    const orgReminders = remindersByOrg[orgId] || [];
    return orgReminders
      .filter(r => 
        r.userId === userId && 
        r.status === 'missed' && 
        r.deliveredAt === null
      )
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .slice(0, limit);
  }
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(id: string): Promise<Reminder | null> {
  if (hasDatabase) {
    try {
      return await prisma.reminder.update({
        where: { id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('[REMINDER STORE] Failed to mark sent:', error);
      return null;
    }
  } else {
    // Dev mode: find and update in-memory
    for (const orgReminders of Object.values(remindersByOrg)) {
      const reminder = orgReminders.find(r => r.id === id);
      if (reminder) {
        reminder.status = 'sent';
        reminder.sentAt = new Date();
        reminder.updatedAt = new Date();
        return reminder;
      }
    }
    return null;
  }
}

/**
 * Mark reminder as missed (outside grace period)
 */
export async function markReminderMissed(id: string): Promise<Reminder | null> {
  if (hasDatabase) {
    try {
      return await prisma.reminder.update({
        where: { id },
        data: {
          status: 'missed',
          sentAt: new Date(), // Still set sentAt to record when it was processed
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('[REMINDER STORE] Failed to mark missed:', error);
      return null;
    }
  } else {
    // Dev mode: find and update in-memory
    for (const orgReminders of Object.values(remindersByOrg)) {
      const reminder = orgReminders.find(r => r.id === id);
      if (reminder) {
        reminder.status = 'missed';
        reminder.sentAt = new Date();
        reminder.updatedAt = new Date();
        return reminder;
      }
    }
    return null;
  }
}

/**
 * Mark reminder as delivered
 */
export async function markReminderDelivered(
  id: string,
  orgId: string,
  userId: string
): Promise<Reminder | null> {
  if (hasDatabase) {
    try {
      // Verify ownership before updating
      const reminder = await prisma.reminder.findFirst({
        where: { id, orgId, userId }
      });
      
      if (!reminder) {
        return null;
      }
      
      return await prisma.reminder.update({
        where: { id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('[REMINDER STORE] Failed to mark delivered:', error);
      return null;
    }
  } else {
    // Dev mode: find and update in-memory
    const orgReminders = remindersByOrg[orgId] || [];
    const reminder = orgReminders.find(r => r.id === id && r.userId === userId);
    
    if (reminder) {
      reminder.status = 'delivered';
      reminder.deliveredAt = new Date();
      reminder.updatedAt = new Date();
      return reminder;
    }
    
    return null;
  }
}

/**
 * Get reminder by ID (with ownership check)
 */
export async function getReminderById(
  id: string,
  orgId: string,
  userId: string
): Promise<Reminder | null> {
  if (hasDatabase) {
    return await prisma.reminder.findFirst({
      where: { id, orgId, userId }
    });
  } else {
    // Dev mode
    const orgReminders = remindersByOrg[orgId] || [];
    return orgReminders.find(r => r.id === id && r.userId === userId) || null;
  }
}

/**
 * Cancel reminders by target (for calendar event/task deletion or disable)
 */
export async function cancelRemindersByTarget(
  orgId: string,
  userId: string,
  targetType: string,
  targetId: string
): Promise<number> {
  if (hasDatabase) {
    try {
      const result = await prisma.reminder.updateMany({
        where: {
          orgId,
          userId,
          targetType,
          targetId,
          status: { in: ['pending', 'sent'] } // Only cancel active reminders
        },
        data: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      });
      return result.count;
    } catch (error) {
      console.error('[REMINDER STORE] Failed to cancel reminders:', error);
      return 0;
    }
  } else {
    // Dev mode: update in-memory
    const orgReminders = remindersByOrg[orgId] || [];
    let count = 0;
    for (const reminder of orgReminders) {
      if (
        reminder.userId === userId &&
        reminder.targetType === targetType &&
        reminder.targetId === targetId &&
        (reminder.status === 'pending' || reminder.status === 'sent')
      ) {
        reminder.status = 'cancelled';
        reminder.updatedAt = new Date();
        count++;
      }
    }
    return count;
  }
}

/**
 * Upsert reminder by idempotency key (create or update existing)
 */
export async function upsertReminderByIdempotencyKey(
  data: ReminderInput,
  updates: Partial<Pick<Reminder, 'remindAt' | 'reminderOffset'>>
): Promise<Reminder> {
  if (hasDatabase) {
    // Check if reminder exists
    const existing = await prisma.reminder.findUnique({
      where: { idempotencyKey: data.idempotencyKey }
    });

    if (existing) {
      // Update existing reminder
      return await prisma.reminder.update({
        where: { idempotencyKey: data.idempotencyKey },
        data: {
          remindAt: updates.remindAt || existing.remindAt,
          reminderOffset: updates.reminderOffset !== undefined ? updates.reminderOffset : existing.reminderOffset,
          timezone: data.timezone !== undefined ? data.timezone : existing.timezone, // Update timezone if provided
          status: 'pending', // Reset to pending if was sent/delivered
          sentAt: null,
          deliveredAt: null,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new
      return await prisma.reminder.create({ data });
    }
  } else {
    // Dev mode: find by idempotency key
    let existing: Reminder | undefined;
    for (const orgReminders of Object.values(remindersByOrg)) {
      const found = orgReminders.find(r => r.idempotencyKey === data.idempotencyKey);
      if (found) {
        existing = found;
        break;
      }
    }

    if (existing) {
      // Update existing
      existing.remindAt = updates.remindAt || existing.remindAt;
      existing.reminderOffset = updates.reminderOffset !== undefined ? updates.reminderOffset : existing.reminderOffset;
      existing.timezone = data.timezone !== undefined ? data.timezone : existing.timezone; // Update timezone if provided
      existing.status = 'pending';
      existing.sentAt = null;
      existing.deliveredAt = null;
      existing.updatedAt = new Date();
      return existing;
    } else {
      // Create new
      const reminder: Reminder = {
        id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...data,
        timezone: data.timezone || null,
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        errorMessage: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const key = data.orgId;
      if (!remindersByOrg[key]) {
        remindersByOrg[key] = [];
      }
      remindersByOrg[key].push(reminder);
      
      return reminder;
    }
  }
}

