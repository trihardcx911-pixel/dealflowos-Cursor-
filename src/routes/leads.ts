import express, { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorNormalizer";
import { LeadDomain } from "../domain/leads";
import { enqueueEvent } from "../queue/eventQueue";
import { broadcastToOrg } from "../realtime/gateway";
import { EVENTS } from "../realtime/events";
import { 
  leadQuerySchema, 
  parsePagination, 
  createPaginationMeta 
} from "../validation/pagination";
import { 
  createLeadFullSchema, 
  updateLeadFullSchema, 
  updateStatusFullSchema, 
  qualifyLeadFullSchema 
} from "../validation/schemas";

const router = express.Router();

// GET /api/leads - Get all leads for org with pagination
router.get("/", validate(leadQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { status, isQualified, type, search } = req.validated?.query || req.query;
  const { page, limit, skip } = parsePagination(req.validated?.query || req.query);

  const where: any = { orgId };
  if (status) where.status = status;
  if (isQualified !== undefined) where.isQualified = isQualified === "true";
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { address: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { sellerName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        _count: { select: { events: true, deals: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  res.json({ 
    data: leads, 
    meta: createPaginationMeta(page, limit, total),
  });
}));

// GET /api/leads/:id - Get single lead
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      deals: true,
      pipelineHistory: { orderBy: { changedAt: "desc" }, take: 10 },
      contacts: true,
    },
  });

  if (!lead) {
    return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND" });
  }

  // Add deal readiness analysis
  const readiness = LeadDomain.getDealReadiness(lead);

  res.json({ ...lead, readiness });
}));

// POST /api/leads - Create lead
router.post("/", validate(createLeadFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = req.auth!;
  const data = req.validated?.body || req.body;

  const lead = await LeadDomain.create(orgId, userId, data);

  if (lead) {
    // Broadcast real-time update
    broadcastToOrg(orgId, {
      type: EVENTS.LEAD_CREATED,
      leadId: lead.id,
      payload: lead,
      timestamp: Date.now(),
    });
  }

  res.status(201).json(lead);
}));

// PUT /api/leads/:id - Update lead
router.put("/:id", validate(updateLeadFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const data = req.validated?.body || req.body;

  const lead = await LeadDomain.update(req.params.id, data);

  // Broadcast real-time update
  broadcastToOrg(orgId, {
    type: EVENTS.LEAD_UPDATED,
    leadId: req.params.id,
    payload: lead,
    timestamp: Date.now(),
  });

  // Async event logging
  enqueueEvent({
    leadId: req.params.id,
    eventType: "updated",
    metadata: { fields: Object.keys(data), userId: req.auth?.userId },
  });

  res.json(lead);
}));

// PATCH /api/leads/:id/status - Update lead status
router.patch("/:id/status", validate(updateStatusFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { status } = req.validated?.body || req.body;

  // Get old status for broadcast
  const oldLead = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { status: true } });
  const oldStatus = oldLead?.status;

  const lead = await LeadDomain.updateStatus(req.params.id, status);

  // Broadcast status change
  broadcastToOrg(orgId, {
    type: EVENTS.STATUS_CHANGED,
    leadId: req.params.id,
    oldStatus,
    newStatus: status,
    timestamp: Date.now(),
  });

  res.json(lead);
}));

// PATCH /api/leads/:id/qualify - Qualify or disqualify lead
router.patch("/:id/qualify", validate(qualifyLeadFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { isQualified } = req.validated?.body || req.body;

  const lead = await LeadDomain.qualify(req.params.id, isQualified);

  // Async event logging
  enqueueEvent({
    leadId: req.params.id,
    eventType: isQualified ? "qualified" : "disqualified",
    metadata: { userId: req.auth?.userId },
  });

  res.json(lead);
}));

// GET /api/leads/:id/readiness - Get deal readiness analysis
router.get("/:id/readiness", asyncHandler(async (req: Request, res: Response) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });

  if (!lead) {
    return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND" });
  }

  const readiness = LeadDomain.getDealReadiness(lead);
  res.json(readiness);
}));

// GET /api/leads/:id/score - Get lead score with breakdown
router.get("/:id/score", asyncHandler(async (req: Request, res: Response) => {
  const { leadScoreService } = await import("../services/leadScoreService");
  
  try {
    const score = await leadScoreService.calculateFullScore(req.params.id);
    res.json(score);
  } catch (err) {
    return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND" });
  }
}));

// GET /api/leads/:id/events - Get enriched events for lead
router.get("/:id/events", asyncHandler(async (req: Request, res: Response) => {
  const { limit = "50" } = req.query;
  
  const events = await prisma.leadEvent.findMany({
    where: { leadId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: parseInt(limit as string),
  });

  const total = await prisma.leadEvent.count({ where: { leadId: req.params.id } });

  res.json({ data: events, total });
}));

// GET /api/leads/:id/insights - Get full lead insights
router.get("/:id/insights", asyncHandler(async (req: Request, res: Response) => {
  const { leadScoreService } = await import("../services/leadScoreService");
  
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      deals: { orderBy: { createdAt: "desc" }, take: 5 },
      pipelineHistory: { orderBy: { changedAt: "desc" }, take: 10 },
    },
  });

  if (!lead) {
    return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND" });
  }

  // Calculate score
  const score = await leadScoreService.calculateFullScore(req.params.id);
  
  // Calculate engagement metrics
  const eventCounts = lead.events.reduce((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate status velocity
  const statusVelocity = lead.pipelineHistory.length > 1
    ? lead.pipelineHistory.slice(0, -1).map((h, i) => ({
        from: lead.pipelineHistory[i + 1]?.newStatus || "new",
        to: h.newStatus,
        daysInStage: Math.round(
          (new Date(h.changedAt).getTime() - new Date(lead.pipelineHistory[i + 1]?.changedAt || lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))
    : [];

  const readiness = LeadDomain.getDealReadiness(lead);

  res.json({
    lead: {
      id: lead.id,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      status: lead.status,
      isQualified: lead.isQualified,
      arv: lead.arv,
      moa: lead.moa,
      offerPrice: lead.offerPrice,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    },
    score,
    readiness,
    engagement: {
      totalEvents: lead.events.length,
      eventBreakdown: eventCounts,
      lastActivity: lead.events[0]?.createdAt || lead.updatedAt,
      daysSinceLastActivity: Math.round(
        (Date.now() - new Date(lead.events[0]?.createdAt || lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    },
    statusVelocity,
    deals: lead.deals,
    recentEvents: lead.events,
  });
}));

// DELETE /api/leads/:id - Soft delete (set status to "dead")
router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const lead = await LeadDomain.updateStatus(req.params.id, "dead");

  enqueueEvent({
    leadId: req.params.id,
    eventType: "deleted",
    metadata: { softDelete: true, userId: req.auth?.userId },
  });

  res.json({ message: "Lead marked as dead", lead });
}));

// DELETE /api/leads/:id/hard - Hard delete (actually remove)
router.delete("/:id/hard", asyncHandler(async (req: Request, res: Response) => {
  await prisma.lead.delete({
    where: { id: req.params.id },
  });

  res.json({ message: "Lead permanently deleted" });
}));

export default router;
