/**
 * Reminder Scheduler
 * 
 * Background process that scans for due reminders and marks them as sent.
 * Also scans for missed calendar events.
 * Runs every 60 seconds.
 */

import { scanAndMarkDueAsSent } from './reminderService.js';
import { scanAndMarkMissedEvents } from '../calendar/eventMissedDetector.js';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the reminder scheduler
 * Scans every 60 seconds for due reminders
 */
export function startReminderScheduler(): void {
  // Prevent double-start
  if (schedulerInterval) {
    console.log('[REMINDER SCHEDULER] Already running');
    return;
  }

  console.log('[REMINDER SCHEDULER] Starting (60s interval)');

  // Run immediately on startup (recovery)
  scanReminders();

  // Then run every 60 seconds
  schedulerInterval = setInterval(() => {
    scanReminders();
  }, 60000); // 60 seconds
}

/**
 * Stop the reminder scheduler (for graceful shutdown)
 */
export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[REMINDER SCHEDULER] Stopped');
  }
}

/**
 * Scan and process due reminders and missed events
 */
async function scanReminders(): Promise<void> {
  try {
    const now = new Date();
    
    // Existing reminder scanning
    const reminderCount = await scanAndMarkDueAsSent(now);
    
    // New: Calendar event missed detection
    const missedEventCount = await scanAndMarkMissedEvents(now);
    
    // Log only if DEV_DIAGNOSTICS enabled or if items were processed
    const DEV_DIAGNOSTICS = process.env.NODE_ENV !== 'production' && process.env.DEV_DIAGNOSTICS === '1';
    
    if (DEV_DIAGNOSTICS || reminderCount > 0 || missedEventCount > 0) {
      console.log(`[SCHEDULER] reminders=${reminderCount} missedEvents=${missedEventCount}`);
    }
  } catch (error) {
    console.error('[SCHEDULER] Error:', error);
  }
}



