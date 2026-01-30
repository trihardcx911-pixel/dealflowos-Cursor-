/**
 * Timezone and time conversion utilities for calendar events
 * 
 * Precondition: The DB table "CalendarEvent" already has columns:
 * - startAt, endAt (nullable DateTime)
 * - status, reminderLeadMinutes, etc.
 */

import { DateTime } from 'luxon';
import { Pool } from 'pg';
import { pool } from '../db/pool.js';

/**
 * Get organization timezone from database
 * Falls back to "America/New_York" if org not found or timezone missing
 */
export async function getOrgTimezone(orgId: string | null | undefined): Promise<string> {
  if (!orgId) {
    return 'America/New_York';
  }

  try {
    const result = await pool.query(
      'SELECT timezone FROM "Organization" WHERE id = $1',
      [orgId]
    );

    if (result.rows.length > 0 && result.rows[0]?.timezone) {
      return result.rows[0].timezone;
    }
  } catch (error) {
    // Log but don't throw - fallback to default
    console.warn('[TIME] Failed to fetch org timezone, using default:', error instanceof Error ? error.message : String(error));
  }

  return 'America/New_York';
}

/**
 * Convert UTC Date to HH:mm string in given timezone
 * Used for extracting time components from canonical UTC timestamps
 */
export function utcDateToHHmm(dateUtc: Date, tz: string): string {
  const dt = DateTime.fromJSDate(dateUtc, { zone: 'utc' }).setZone(tz);
  return dt.toFormat('HH:mm');
}

/**
 * Compute canonical UTC start/end times from date/time strings
 * 
 * @param dateStr - "YYYY-MM-DD" format
 * @param startStr - "HH:mm" format (24-hour)
 * @param endStr - "HH:mm" format (24-hour), optional
 * @param tz - IANA timezone string (e.g., "America/New_York")
 * @returns { startAt: Date, endAt: Date } - UTC Date objects
 * @throws Error with 400-friendly message if parsing fails
 */
export function computeStartEndUtc(params: {
  dateStr: string;
  startStr: string;
  endStr?: string | null;
  tz: string;
}): { startAt: Date; endAt: Date } {
  const { dateStr, startStr, endStr, tz } = params;

  // Parse start time in the given timezone
  const startLocal = DateTime.fromFormat(`${dateStr} ${startStr}`, 'yyyy-MM-dd HH:mm', {
    zone: tz,
  });

  if (!startLocal.isValid) {
    throw new Error(`Invalid date/time format: date="${dateStr}", startTime="${startStr}", timezone="${tz}". ${startLocal.invalidReason || 'Unknown error'}`);
  }

  // Parse end time or default to start + 60 minutes
  let endLocal: DateTime;
  if (endStr) {
    endLocal = DateTime.fromFormat(`${dateStr} ${endStr}`, 'yyyy-MM-dd HH:mm', {
      zone: tz,
    });

    if (!endLocal.isValid) {
      throw new Error(`Invalid endTime format: "${endStr}". ${endLocal.invalidReason || 'Unknown error'}`);
    }

    // If end <= start, assume it crosses midnight (e.g., 23:00 to 01:00)
    if (endLocal <= startLocal) {
      endLocal = endLocal.plus({ days: 1 });
    }
  } else {
    // Default: start + 60 minutes
    endLocal = startLocal.plus({ minutes: 60 });
  }

  // Convert to UTC and return as JS Date objects
  return {
    startAt: startLocal.toUTC().toJSDate(),
    endAt: endLocal.toUTC().toJSDate(),
  };
}

