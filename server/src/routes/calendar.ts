import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";
import { detectResourceProbing } from "../security/anomalyDetector.js";
import {
  createOrUpdateReminderForCalendarEvent,
  cancelRemindersForCalendarEvent
} from "../reminders/reminderService.js";
import * as calendarStore from "../dev/calendarStore.js";
import { getOrgTimezone, computeStartEndUtc, utcDateToHHmm } from "../utils/time.js";

const router = Router();

// Check if database is available
const hasDatabase = Boolean(process.env.DATABASE_URL);

// Get authenticated user ID from request
// This is the ONLY trusted user identifier (from JWT via requireAuth middleware)
// CalendarEvent.userId is now String (matches User.id) - direct equality enforced
function getUserId(req: Request): string {
  if (!req.user?.id) {
    throw new Error('User not authenticated');
  }
  // Direct string equality - no conversions, no helpers, no exceptions
  return req.user.id;
}

// Validation schemas - matching Prisma CalendarEvent model exactly
const createEventSchema = z.object({
  title: z.string().min(1, "title is required and cannot be empty"),
  date: z.string().min(1, "date is required"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "startTime must be in HH:mm format"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "endTime must be in HH:mm format"),
  notes: z.string().optional().nullable(),
  urgency: z.enum(["low", "medium", "critical"], {
    errorMap: () => ({ message: "urgency must be 'low', 'medium', or 'critical'" })
  }).default("medium"),
  // Phase 2: Optional reminder fields
  enableReminder: z.boolean().optional().default(true),
  reminderOffset: z.number().optional().default(-60),
  reminderChannel: z.string().optional().default('in_app'),
});

const updateEventSchema = createEventSchema.partial();

// Helper to parse date strings and validate
function parseDateTime(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      throw new Error(`Invalid Date object provided`);
    }
    return dateInput;
  }
  
  if (typeof dateInput !== 'string' || !dateInput.trim()) {
    throw new Error(`Invalid date input: expected non-empty string or Date, got ${typeof dateInput}`);
  }
  
  let parsedDate: Date;
  
  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    parsedDate = new Date(year, month - 1, day);
  }
  // Handle YYYY-MM-DDTHH:mm format
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateInput)) {
    parsedDate = new Date(dateInput);
  }
  // Try general date parsing
  else {
    parsedDate = new Date(dateInput);
  }
  
  // Validate the parsed date is valid
  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date format: "${dateInput}" could not be parsed as a valid date`);
  }
  
  return parsedDate;
}

// POST /calendar/create
router.post("/create", async (req: Request, res: Response, next: NextFunction) => {
  console.log("========================================");
  console.log("[CALENDAR CREATE] Incoming request");
  console.log("========================================");
  console.log("Raw request body:", JSON.stringify(req.body, null, 2));
  console.log("Request headers:", JSON.stringify(req.headers, null, 2));
  
  try {
    const userId = getUserId(req);
    console.log("[CALENDAR CREATE] Extracted userId:", userId);
    
    console.log("[CALENDAR CREATE] Validating request body with schema...");
    const data = createEventSchema.parse(req.body);
    console.log("[CALENDAR CREATE] Validation passed. Parsed data:", {
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes,
      urgency: data.urgency,
    });

    // Parse dates
    console.log("[CALENDAR CREATE] Parsing dates...");
    const dateOnly = parseDateTime(data.date);
    console.log("[CALENDAR CREATE] Parsed dateOnly:", dateOnly.toISOString());
    
    const startDateTime = new Date(dateOnly);
    const [startHours, startMins] = data.startTime.split(':').map(Number);
    startDateTime.setHours(startHours || 0, startMins || 0, 0, 0);
    console.log("[CALENDAR CREATE] Parsed start date:", startDateTime.toISOString());
    
    const endDateTime = new Date(dateOnly);
    const [endHours, endMins] = data.endTime.split(':').map(Number);
    endDateTime.setHours(endHours || 0, endMins || 0, 0, 0);
    console.log("[CALENDAR CREATE] Parsed end date:", endDateTime.toISOString());

    // Validate endTime is after startTime
    if (endDateTime <= startDateTime) {
      console.error("[CALENDAR CREATE] ✗ Validation error: endTime must be after startTime");
      return res.status(400).json({
        error: "validation_failed",
        detail: "endTime must be after startTime",
      });
    }

    // Compute canonical UTC timestamps (startAt/endAt)
    // Precondition: DB table "CalendarEvent" already has startAt/endAt columns (nullable)
    const orgId = (req as any).orgId || req.user?.orgId || null;
    const userTz = await getOrgTimezone(orgId);
    
    let canonicalTimes: { startAt: Date; endAt: Date } | null = null;
    try {
      canonicalTimes = computeStartEndUtc({
        dateStr: data.date,
        startStr: data.startTime,
        endStr: data.endTime,
        tz: userTz,
      });
      
      // Dev-only safe logging (no values)
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        console.log("[CALENDAR CREATE] Canonical times computed:", {
          tzUsed: userTz,
          hasDate: !!data.date,
          hasStart: !!data.startTime,
          hasEnd: !!data.endTime,
        });
      }
    } catch (timeError: any) {
      console.error("[CALENDAR CREATE] ✗ Time conversion error:", timeError.message);
      return res.status(400).json({
        error: "validation_failed",
        detail: timeError.message,
      });
    }

    // Assemble Prisma data
    const prismaData = {
      title: data.title,
      date: dateOnly,
      startTime: startDateTime,
      endTime: endDateTime,
      notes: data.notes || null,
      urgency: data.urgency || "medium",
      userId: userId, // String - direct equality with req.user.id
      status: 'scheduled', // Explicit status for needs-attention filtering
      // Canonical UTC timestamps
      startAt: canonicalTimes.startAt,
      endAt: canonicalTimes.endAt,
    };

    // Dev-only diagnostic logging (safe - no secrets)
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log("[CALENDAR CREATE] Diagnostic:", {
        userId,
        orgIdPresent: !!orgId,
        tzUsed: userTz,
        startAtSet: !!canonicalTimes.startAt,
        endAtSet: !!canonicalTimes.endAt,
        status: prismaData.status,
      });
    }

    console.log("[CALENDAR CREATE] Parsed dates OK");
    console.log("[CALENDAR CREATE] Prisma payload OK:", {
      title: prismaData.title,
      date: prismaData.date.toISOString(),
      startTime: prismaData.startTime.toISOString(),
      endTime: prismaData.endTime.toISOString(),
      notes: prismaData.notes,
      urgency: prismaData.urgency,
      userId: prismaData.userId,
      status: prismaData.status,
    });

    try {
      let event;

      if (hasDatabase) {
        console.log("[CALENDAR CREATE] Attempting Prisma create with final data:", JSON.stringify(prismaData, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }, 2));

        event = await prisma.calendarEvent.create({
          data: prismaData,
        });
        
        // Dev-only: Verify created event has required fields
        if (isDev) {
          console.log("[CALENDAR CREATE] Created event verification:", {
            id: event.id,
            userId: event.userId,
            status: event.status,
            startAtSet: !!event.startAt,
            endAtSet: !!event.endAt,
          });
        }
      } else {
        console.log("[CALENDAR CREATE] Using in-memory store (dev mode)");
        event = calendarStore.createEvent(prismaData);
      }

      console.log("[CALENDAR CREATE] ✓ Event created successfully");
      console.log("[CALENDAR CREATE] Event created:", JSON.stringify(event, (key, value) => {
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2));
      
      // Phase 2: Create reminder if enabled
      if (data.enableReminder) {
        try {
          // Extract timezone from header (preferred) or default to UTC
          const timezone = req.headers['x-timezone'] as string || null;
          const orgId = (req as any).orgId || req.user?.orgId || userId;
          
          await createOrUpdateReminderForCalendarEvent({
            orgId,
            userId,
            eventId: event.id,
            eventStartTimeUtc: startDateTime,
            reminderOffset: data.reminderOffset,
            timezone
          });
          console.log("[CALENDAR CREATE] ✓ Reminder created for event");
        } catch (reminderError: any) {
          console.error("[CALENDAR CREATE] ⚠ Failed to create reminder:", reminderError.message);
          // Don't fail the event creation if reminder fails
        }
      }
      
      console.log("========================================");
      res.status(201).json(event);
    } catch (prismaError: any) {
      console.error("========================================");
      console.error("[CALENDAR CREATE] ✗ Prisma Error occurred!");
      console.error("========================================");
      console.error("Error type:", prismaError.constructor.name);
      console.error("Error message:", prismaError.message);
      console.error("Error code:", prismaError.code);
      console.error("Meta:", JSON.stringify(prismaError.meta, null, 2));
      console.error("Full error object:", JSON.stringify(prismaError, Object.getOwnPropertyNames(prismaError), 2));
      console.error("Stack trace:", prismaError.stack);
      console.error("========================================");
      
      return res.status(500).json({ 
        error: "create_failed", 
        detail: prismaError.message,
        code: prismaError.code,
        meta: prismaError.meta,
      });
    }
  } catch (err: any) {
    console.error("========================================");
    console.error("[CALENDAR CREATE] ✗ Validation or parsing error!");
    console.error("========================================");
    console.error("Error type:", err?.constructor?.name || typeof err);
    console.error("Error message:", err?.message || String(err));
    
    if (err?.issues) {
      console.error("Zod validation errors:", JSON.stringify(err.issues, null, 2));
      return res.status(400).json({
        error: "validation_failed",
        detail: err.message,
        issues: err.issues,
      });
    }
    
    console.error("Stack trace:", err?.stack);
    console.error("========================================");
    
    return res.status(500).json({ 
      error: "create_failed", 
      detail: err?.message || "Unknown error occurred",
    });
  }
});

// GET /calendar/month?date=YYYY-MM
router.get("/month", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const dateParam = req.query.date as string;

    let startDate: Date;
    let endDate: Date;

    if (dateParam) {
      const [year, month] = dateParam.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      // Get last day of the month
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      // Get last day of the current month
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    let events;

    if (hasDatabase) {
      events = await prisma.calendarEvent.findMany({
        where: {
          userId,
          AND: [
            {
              date: {
                gte: startDate,
              },
            },
            {
              date: {
                lte: endDate,
              },
            },
          ],
        },
        orderBy: {
          startTime: "asc",
        },
      });
    } else {
      events = calendarStore.getEventsByDateRange(userId, startDate, endDate);
    }

    res.json({ events });
  } catch (err) {
    next(err);
  }
});

// GET /calendar/day?date=YYYY-MM-DD
router.get("/day", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const dateParam = req.query.date as string;

    let targetDate: Date;
    if (dateParam) {
      const [year, month, day] = dateParam.split("-").map(Number);
      targetDate = new Date(year, month - 1, day);
    } else {
      targetDate = new Date();
    }

    // Use the date field for filtering (it's stored as date only)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    let events;

    if (hasDatabase) {
      events = await prisma.calendarEvent.findMany({
        where: {
          userId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          startTime: "asc",
        },
      });
    } else {
      events = calendarStore.getEventsByDateRange(userId, startOfDay, endOfDay);
    }

    res.json({ events });
  } catch (err) {
    next(err);
  }
});

// DELETE /calendar/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Check if event exists and belongs to user (BOLA prevention)
    let event;

    if (hasDatabase) {
      event = await prisma.calendarEvent.findFirst({
        where: { id: eventId, userId },
      });
    } else {
      event = calendarStore.getEventById(eventId, userId);
    }

    if (!event) {
      // Return 403 instead of 404 to prevent information leakage
      // (Don't reveal whether resource exists if it doesn't belong to user)
      // Log BOLA violation
      logSecurityEvent({
        event_type: "bola_forbidden",
        user_id: userId,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
        path: req.path,
        method: req.method,
        status_code: 403,
        reason: "ownership_mismatch",
        meta: {
          resource_type: "calendar_event",
          resource_id: String(eventId),
        },
      }).catch(() => {}); // Ignore errors
      (req as any)._securityLogged = true; // Prevent double-logging

      // Anomaly detection (log-only, non-blocking)
      detectResourceProbing(userId).catch(() => {});

      return res.status(403).json({ error: "Forbidden" });
    }

    // Phase 2: Cancel reminders before deleting event
    try {
      const orgId = (req as any).orgId || req.user?.orgId || userId;
      await cancelRemindersForCalendarEvent({
        orgId,
        userId,
        eventId
      });
    } catch (reminderError: any) {
      console.error("[CALENDAR DELETE] ⚠ Failed to cancel reminders:", reminderError.message);
      // Don't fail the deletion if reminder cancellation fails
    }

    // Delete is safe because we verified ownership above
    if (hasDatabase) {
      await prisma.calendarEvent.delete({
        where: { id: eventId },
      });
    } else {
      calendarStore.deleteEvent(eventId, userId);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /calendar/update/:id
router.patch("/update/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req); // String
    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Check if event exists and belongs to user (BOLA prevention)
    let existingEvent;

    if (hasDatabase) {
      existingEvent = await prisma.calendarEvent.findFirst({
        where: { id: eventId, userId },
      });
    } else {
      existingEvent = calendarStore.getEventById(eventId, userId);
    }

    if (!existingEvent) {
      // Return 403 instead of 404 to prevent information leakage
      // (Don't reveal whether resource exists if it doesn't belong to user)
      // Log BOLA violation
      logSecurityEvent({
        event_type: "bola_forbidden",
        user_id: userId,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
        path: req.path,
        method: req.method,
        status_code: 403,
        reason: "ownership_mismatch",
        meta: {
          resource_type: "calendar_event",
          resource_id: String(eventId),
        },
      }).catch(() => {}); // Ignore errors
      (req as any)._securityLogged = true; // Prevent double-logging

      // Anomaly detection (log-only, non-blocking)
      detectResourceProbing(userId).catch(() => {});

      return res.status(403).json({ error: "Forbidden" });
    }

    const data = updateEventSchema.parse(req.body);
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.date !== undefined) {
      const dateOnly = parseDateTime(data.date);
      updateData.date = dateOnly;
    }
    
    // Handle startTime and endTime
    if (data.startTime !== undefined || data.endTime !== undefined || data.date !== undefined) {
      const targetDate = data.date ? parseDateTime(data.date) : existingEvent.date;
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (data.startTime !== undefined) {
        const [startHours, startMins] = String(data.startTime).split(':').map(Number);
        const startDateTime = new Date(targetDate);
        startDateTime.setHours(startHours || 0, startMins || 0, 0, 0);
        updateData.startTime = startDateTime;
      }
      
      if (data.endTime !== undefined) {
        const [endHours, endMins] = String(data.endTime).split(':').map(Number);
        const endDateTime = new Date(targetDate);
        endDateTime.setHours(endHours || 0, endMins || 0, 0, 0);
        updateData.endTime = endDateTime;
      }
      
      // Compute canonical UTC timestamps when date/time changes
      // Precondition: DB table "CalendarEvent" already has startAt/endAt columns (nullable)
      const orgId = (req as any).orgId || req.user?.orgId || null;
      const userTz = await getOrgTimezone(orgId);
      
      // Use updated values if provided, otherwise extract from existing canonical times
      let startTimeStr: string;
      if (data.startTime !== undefined) {
        startTimeStr = String(data.startTime);
      } else {
        // Prefer existing startAt (canonical UTC) and convert to org timezone to extract HH:mm
        if (existingEvent.startAt) {
          startTimeStr = utcDateToHHmm(new Date(existingEvent.startAt), userTz);
        } else {
          // Fallback: extract from startTime DateTime (less accurate due to UTC shifts)
          const existingStart = new Date(existingEvent.startTime);
          startTimeStr = `${String(existingStart.getHours()).padStart(2, '0')}:${String(existingStart.getMinutes()).padStart(2, '0')}`;
        }
      }
      
      let endTimeStr: string;
      if (data.endTime !== undefined) {
        endTimeStr = String(data.endTime);
      } else {
        // Prefer existing endAt (canonical UTC) and convert to org timezone to extract HH:mm
        if (existingEvent.endAt) {
          endTimeStr = utcDateToHHmm(new Date(existingEvent.endAt), userTz);
        } else {
          // Fallback: extract from endTime DateTime (less accurate due to UTC shifts)
          const existingEnd = new Date(existingEvent.endTime);
          endTimeStr = `${String(existingEnd.getHours()).padStart(2, '0')}:${String(existingEnd.getMinutes()).padStart(2, '0')}`;
        }
      }
      
      try {
        const canonicalTimes = computeStartEndUtc({
          dateStr: targetDateStr,
          startStr: startTimeStr,
          endStr: endTimeStr,
          tz: userTz,
        });
        
        updateData.startAt = canonicalTimes.startAt;
        updateData.endAt = canonicalTimes.endAt;
        
        // Dev-only safe logging (no values)
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
          console.log("[CALENDAR UPDATE] Canonical times computed:", {
            tzUsed: userTz,
            hasDate: !!data.date,
            hasStart: data.startTime !== undefined,
            hasEnd: data.endTime !== undefined,
          });
        }
      } catch (timeError: any) {
        console.error("[CALENDAR UPDATE] ✗ Time conversion error:", timeError.message);
        return res.status(400).json({
          error: "validation_failed",
          detail: timeError.message,
        });
      }
    }
    
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.urgency !== undefined) updateData.urgency = data.urgency;

    // Update is safe because we verified ownership above
    let updated;

    if (hasDatabase) {
      updated = await prisma.calendarEvent.update({
        where: { 
          id: eventId,
          // Additional safety: ensure userId matches (defense-in-depth)
          // Note: Prisma doesn't support multiple fields in where for update,
          // but we already verified ownership above, so this is safe
        },
        data: updateData,
      });
    } else {
      updated = calendarStore.updateEvent(eventId, userId, updateData);
      
      if (!updated) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Phase 2: Handle reminders on update
    const orgId = (req as any).orgId || req.user?.orgId || userId;
    
    if (data.enableReminder === false) {
      // Cancel reminders
      try {
        await cancelRemindersForCalendarEvent({
          orgId,
          userId,
          eventId
        });
        console.log("[CALENDAR UPDATE] ✓ Reminders cancelled for event");
      } catch (reminderError: any) {
        console.error("[CALENDAR UPDATE] ⚠ Failed to cancel reminders:", reminderError.message);
      }
    } else if ((data.enableReminder === true || data.enableReminder === undefined) && (data.startTime !== undefined || data.date !== undefined || data.reminderOffset !== undefined)) {
      // Create or update reminder (time or offset changed, or explicitly enabled)
      try {
        // Extract timezone from header (preferred) or default to UTC
        const timezone = req.headers['x-timezone'] as string || null;
        // Use updated startTime if available, otherwise existing
        const startTimeToUse = updateData.startTime || existingEvent.startTime;
        const offsetToUse = data.reminderOffset !== undefined ? data.reminderOffset : -60;
        
        await createOrUpdateReminderForCalendarEvent({
          orgId,
          userId,
          eventId,
          eventStartTimeUtc: startTimeToUse,
          reminderOffset: offsetToUse,
          timezone
        });
        console.log("[CALENDAR UPDATE] ✓ Reminder updated for event");
      } catch (reminderError: any) {
        console.error("[CALENDAR UPDATE] ⚠ Failed to update reminder:", reminderError.message);
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /calendar/:id/status
router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    const { status } = z.object({
      status: z.enum(["completed", "cancelled", "scheduled"]),
    }).parse(req.body);

    // Verify ownership
    let existingEvent;
    if (hasDatabase) {
      existingEvent = await prisma.calendarEvent.findFirst({
        where: { id: eventId, userId },
      });
    } else {
      existingEvent = calendarStore.getEventById(eventId, userId);
    }

    if (!existingEvent) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Build update data
    const updateData: any = { status };
    const now = new Date();

    if (status === "completed") {
      updateData.completedAt = now;
      updateData.missedAt = null;
      updateData.cancelledAt = null;
    } else if (status === "cancelled") {
      updateData.cancelledAt = now;
      updateData.completedAt = null;
      updateData.missedAt = null;
    } else if (status === "scheduled") {
      updateData.completedAt = null;
      updateData.cancelledAt = null;
      updateData.missedAt = null;
    }

    // Update event
    let updated;
    if (hasDatabase) {
      updated = await prisma.calendarEvent.update({
        where: { id: eventId },
        data: updateData,
      });
    } else {
      updated = calendarStore.updateEvent(eventId, userId, updateData);
      if (!updated) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "validation_failed",
        detail: err.message,
        issues: err.errors,
      });
    }
    next(err);
  }
});

// GET /calendar/needs-attention
router.get("/needs-attention", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const withinMinutes = parseInt(req.query.withinMinutes as string) || 480; // Default 8 hours
    const now = new Date();
    const leadCutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);

    // Dev-only diagnostic logging
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log("[CALENDAR NEEDS-ATTENTION] Query:", {
        userId,
        withinMinutes,
        now: now.toISOString(),
        leadCutoff: leadCutoff.toISOString(),
      });
    }

    let events;
    if (hasDatabase) {
      // Query: upcoming (scheduled with startAt within lead window) OR missed
      // Exclude events without canonical times (startAt/endAt NULL)
      events = await prisma.calendarEvent.findMany({
        where: {
          userId,
          startAt: { not: null }, // Require canonical times
          OR: [
            {
              // Upcoming: scheduled with startAt within lead window
              status: 'scheduled',
              startAt: {
                gte: now,
                lte: leadCutoff,
              },
            },
            {
              // Missed: status is missed
              status: 'missed',
            },
          ],
        },
        orderBy: [
          // Missed first (by missedAt desc, then endAt desc)
          { missedAt: 'desc' },
          { endAt: 'desc' },
          // Then upcoming by startAt asc
          { startAt: 'asc' },
        ],
        take: 50,
      });
      
      // Dev-only: Log query results
      if (isDev) {
        console.log("[CALENDAR NEEDS-ATTENTION] Found events:", {
          count: events.length,
          upcoming: events.filter(e => e.status === 'scheduled').length,
          missed: events.filter(e => e.status === 'missed').length,
        });
      }
    } else {
      // Dev mode: filter in-memory events
      const allEvents = calendarStore.getEventsByUserId(userId);
      events = allEvents.filter(e => {
        if (!e.startAt) return false; // Exclude events without canonical times
        
        const start = new Date(e.startAt);
        const isUpcoming = e.status === 'scheduled' && start >= now && start <= leadCutoff;
        const isMissed = e.status === 'missed';
        
        return isUpcoming || isMissed;
      }).sort((a, b) => {
        // Missed first
        if (a.status === 'missed' && b.status !== 'missed') return -1;
        if (a.status !== 'missed' && b.status === 'missed') return 1;
        if (a.status === 'missed' && b.status === 'missed') {
          // Sort by missedAt desc or endAt desc
          const aMissed = a.missedAt ? new Date(a.missedAt).getTime() : (a.endAt ? new Date(a.endAt).getTime() : 0);
          const bMissed = b.missedAt ? new Date(b.missedAt).getTime() : (b.endAt ? new Date(b.endAt).getTime() : 0);
          return bMissed - aMissed;
        }
        // Then upcoming by startAt asc
        const aStart = a.startAt ? new Date(a.startAt).getTime() : 0;
        const bStart = b.startAt ? new Date(b.startAt).getTime() : 0;
        return aStart - bStart;
      }).slice(0, 50);
    }

    // Transform for frontend
    const result = events.map(e => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt ? new Date(e.startAt).toISOString() : null,
      endAt: e.endAt ? new Date(e.endAt).toISOString() : null,
      status: e.status,
      urgency: e.urgency,
      // Compute type: "missed" if status is missed, otherwise "upcoming"
      type: e.status === 'missed' ? 'missed' : 'upcoming',
    }));

    res.json({ events: result });
  } catch (err) {
    next(err);
  }
});

export default router;


