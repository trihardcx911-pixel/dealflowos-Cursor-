/**
 * Calendar Event Missed Detection
 * 
 * Scans for scheduled events that have passed their end time + grace period
 * and marks them as missed.
 * 
 * Precondition: CalendarEvent table has:
 * - status (default 'scheduled')
 * - endAt (nullable DateTime, but now populated on writes)
 * - missedAt (nullable DateTime)
 */

import { prisma } from '../db/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Scan for scheduled events that have passed their end time + grace period
 * Marks them as missed
 * 
 * @param now - Current timestamp
 * @returns Number of events marked as missed
 */
export async function scanAndMarkMissedEvents(now: Date): Promise<number> {
  const GRACE_MINUTES = parseInt(process.env.EVENT_MISSED_GRACE_MINUTES || '60', 10);
  const GRACE_MS = GRACE_MINUTES * 60 * 1000;
  const graceCutoff = new Date(now.getTime() - GRACE_MS);

  if (!hasDatabase) {
    // Dev mode: in-memory store doesn't support missed detection
    // (would require calendarStore implementation)
    return 0;
  }

  try {
    // Find scheduled events where endAt < grace cutoff
    // Use updateMany for efficiency
    const result = await prisma.calendarEvent.updateMany({
      where: {
        status: 'scheduled', // Only scheduled events
        endAt: {
          not: null, // Require canonical endAt
          lt: graceCutoff, // End time passed grace period
        },
      },
      data: {
        status: 'missed',
        missedAt: now,
      },
    });

    return result.count;
  } catch (error) {
    console.error('[EVENT MISSED DETECTOR] Error scanning missed events:', error);
    return 0;
  }
}








