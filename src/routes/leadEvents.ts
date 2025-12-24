import express, { Request, Response } from "express";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorNormalizer";
import { enqueueEvent, enqueueAndRespond } from "../queue/eventQueue";
import { leadEventQuerySchema, parsePagination, createPaginationMeta } from "../validation/pagination";
import { createEventFullSchema } from "../validation/schemas";
import { z } from "zod";

const router = express.Router();

// Validation schemas for specific event types
const callEventSchema = z.object({
  params: z.object({ leadId: z.string().min(1) }),
  body: z.object({
    duration: z.number().int().min(0).optional(),
    outcome: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const smsEventSchema = z.object({
  params: z.object({ leadId: z.string().min(1) }),
  body: z.object({
    message: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
  }),
});

const emailEventSchema = z.object({
  params: z.object({ leadId: z.string().min(1) }),
  body: z.object({
    subject: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
  }),
});

const noteEventSchema = z.object({
  params: z.object({ leadId: z.string().min(1) }),
  body: z.object({
    content: z.string().min(1),
  }),
});

// GET /api/lead-events/:leadId - Get events for a lead
router.get("/:leadId", validate(leadEventQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { eventType } = req.validated?.query || req.query;
  const { page, limit, skip } = parsePagination(req.validated?.query || req.query);

  const where: any = { leadId };
  if (eventType) where.eventType = eventType;

  const [events, total] = await Promise.all([
    prisma.leadEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.leadEvent.count({ where }),
  ]);

  res.json({ 
    data: events, 
    meta: createPaginationMeta(page, limit, total),
  });
}));

// POST /api/lead-events/:leadId - Create event for a lead (async queue)
router.post("/:leadId", validate(createEventFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { userId } = req.auth!;
  const { eventType, metadata } = req.validated?.body || req.body;

  // Verify lead exists
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND" });
  }

  // Queue event for async processing
  const result = enqueueAndRespond({
    leadId,
    eventType,
    metadata: { ...metadata, userId },
  });

  res.status(202).json(result);
}));

// POST /api/lead-events/:leadId/call - Log a call (async queue)
router.post("/:leadId/call", validate(callEventSchema), asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { userId } = req.auth!;
  const { duration, outcome, notes } = req.validated?.body || req.body;

  const result = enqueueAndRespond({
    leadId,
    eventType: "call",
    metadata: { userId, duration, outcome, notes },
  });

  res.status(202).json(result);
}));

// POST /api/lead-events/:leadId/sms - Log an SMS (async queue)
router.post("/:leadId/sms", validate(smsEventSchema), asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { userId } = req.auth!;
  const { message, direction } = req.validated?.body || req.body;

  const result = enqueueAndRespond({
    leadId,
    eventType: "sms",
    metadata: { userId, message, direction },
  });

  res.status(202).json(result);
}));

// POST /api/lead-events/:leadId/email - Log an email (async queue)
router.post("/:leadId/email", validate(emailEventSchema), asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { userId } = req.auth!;
  const { subject, direction } = req.validated?.body || req.body;

  const result = enqueueAndRespond({
    leadId,
    eventType: "email",
    metadata: { userId, subject, direction },
  });

  res.status(202).json(result);
}));

// POST /api/lead-events/:leadId/note - Add a note (async queue)
router.post("/:leadId/note", validate(noteEventSchema), asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { userId } = req.auth!;
  const { content } = req.validated?.body || req.body;

  const result = enqueueAndRespond({
    leadId,
    eventType: "note",
    metadata: { userId, content },
  });

  res.status(202).json(result);
}));

export default router;
