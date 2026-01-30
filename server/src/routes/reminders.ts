/**
 * Reminder API Routes
 * 
 * Endpoints for managing reminders (in-app notifications MVP).
 */

import express, { Request, Response } from 'express';
import {
  createReminder,
  getDueSentRemindersForUser,
  getMissedRemindersForUser,
  markDelivered
} from '../reminders/reminderService.js';

export const remindersRouter = express.Router();

/**
 * GET /api/reminders/due
 * Get sent reminders waiting to be delivered to current user
 * Optional query param: ?includeMissed=1 to also include missed reminders
 */
remindersRouter.get('/due', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || req.user?.id;
    const includeMissed = req.query.includeMissed === '1' || req.query.includeMissed === 'true';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get sent reminders (default)
    const sentReminders = await getDueSentRemindersForUser(orgId, userId, 50);
    
    // Optionally include missed reminders
    let missedReminders: typeof sentReminders = [];
    if (includeMissed) {
      missedReminders = await getMissedRemindersForUser(orgId, userId, 50);
    }

    // Combine and sort by remindAt
    const allReminders = [...sentReminders, ...missedReminders].sort(
      (a, b) => a.remindAt.getTime() - b.remindAt.getTime()
    );

    // Map to DTO format for frontend
    const dtos = allReminders.map(r => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      remindAt: r.remindAt.toISOString(),
      sentAt: r.sentAt?.toISOString() || null,
      deliveredAt: r.deliveredAt?.toISOString() || null,
      status: r.status,
      channel: r.channel,
      timezone: r.timezone || null
    }));

    return res.json({ reminders: dtos });
  } catch (error: any) {
    console.error('[REMINDERS API] Error fetching due reminders:', error);
    return res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

/**
 * PATCH /api/reminders/:id/mark-delivered
 * Mark a reminder as delivered (idempotent)
 */
remindersRouter.patch('/:id/mark-delivered', async (req: Request, res: Response) => {
  try {
    const reminderId = req.params.id;
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await markDelivered(reminderId, orgId, userId);

    if (!result.success) {
      if (result.error === 'Reminder not found or access denied') {
        return res.status(404).json({ error: result.error });
      }
      return res.status(500).json({ error: result.error || 'Failed to mark delivered' });
    }

    return res.json({ success: true, reminder: result.reminder });
  } catch (error: any) {
    console.error('[REMINDERS API] Error marking delivered:', error);
    return res.status(500).json({ error: 'Failed to mark delivered' });
  }
});

/**
 * POST /api/reminders (DEV/TEST ONLY)
 * Create a new reminder for testing
 * Gates: NODE_ENV=development OR DEV_DIAGNOSTICS=1
 */
remindersRouter.post('/', async (req: Request, res: Response) => {
  // Gate: dev/test only
  const isDev = process.env.NODE_ENV !== 'production';
  const diagEnabled = process.env.DEV_DIAGNOSTICS === '1';
  
  if (!isDev && !diagEnabled) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const userId = req.user?.id;
    const orgId = (req as any).orgId || req.user?.orgId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      targetType,
      targetId,
      remindAt,
      reminderOffset,
      channel
    } = req.body;

    // Validate required fields
    if (!targetType || !targetId || !remindAt) {
      return res.status(400).json({ 
        error: 'Missing required fields: targetType, targetId, remindAt' 
      });
    }

    // Parse remindAt
    const remindAtDate = new Date(remindAt);
    if (isNaN(remindAtDate.getTime())) {
      return res.status(400).json({ error: 'Invalid remindAt date' });
    }

    // Extract timezone from header (preferred) or default to UTC
    const timezone = req.headers['x-timezone'] as string || null;
    
    const reminder = await createReminder({
      orgId,
      userId,
      targetType,
      targetId,
      remindAt: remindAtDate,
      reminderOffset: reminderOffset || -60,
      channel: channel || 'in_app',
      timezone
    });

    return res.status(201).json(reminder);
  } catch (error: any) {
    console.error('[REMINDERS API] Error creating reminder:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create reminder' 
    });
  }
});



