import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";

const router = Router();

// Get userId - hardcode to 1 for MVP
function getUserId(req: Request): number {
  const userId = 1;
  console.log(`[getUserId] Using hardcoded userId: ${userId} (MVP patch)`);
  return userId;
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

    // Assemble Prisma data
    const prismaData = {
      title: data.title,
      date: dateOnly,
      startTime: startDateTime,
      endTime: endDateTime,
      notes: data.notes || null,
      urgency: data.urgency || "medium",
      userId: userId,
    };

    console.log("[CALENDAR CREATE] Parsed dates OK");
    console.log("[CALENDAR CREATE] Prisma payload OK:", {
      title: prismaData.title,
      date: prismaData.date.toISOString(),
      startTime: prismaData.startTime.toISOString(),
      endTime: prismaData.endTime.toISOString(),
      notes: prismaData.notes,
      urgency: prismaData.urgency,
      userId: prismaData.userId,
    });

    try {
      console.log("[CALENDAR CREATE] Attempting Prisma create with final data:", JSON.stringify(prismaData, (key, value) => {
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2));

      const event = await prisma.calendarEvent.create({
        data: prismaData,
      });

      console.log("[CALENDAR CREATE] ✓ Event created successfully");
      console.log("[CALENDAR CREATE] Event created:", JSON.stringify(event, (key, value) => {
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2));
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

    const events = await prisma.calendarEvent.findMany({
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

    const events = await prisma.calendarEvent.findMany({
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

    // Check if event exists and belongs to user
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /calendar/update/:id
router.patch("/update/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Check if event exists and belongs to user
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: "Event not found" });
    }

    const data = updateEventSchema.parse(req.body);
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.date !== undefined) {
      const dateOnly = parseDateTime(data.date);
      updateData.date = dateOnly;
    }
    
    // Handle startTime and endTime
    if (data.startTime !== undefined || data.endTime !== undefined) {
      const targetDate = data.date ? parseDateTime(data.date) : existingEvent.date;
      
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
    }
    
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.urgency !== undefined) updateData.urgency = data.urgency;

    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;


