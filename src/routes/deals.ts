import express, { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorNormalizer";
import { DealDomain } from "../domain/deals";
import { dealQuerySchema, parsePagination, createPaginationMeta } from "../validation/pagination";
import { createDealFullSchema, closeDealFullSchema } from "../validation/schemas";
import { broadcastToOrg } from "../realtime/gateway";
import { EVENTS } from "../realtime/events";
import { notifyDealClosed } from "../notifications/notify";
import { getNeedsAttentionSignals } from "../services/needsAttentionService";
import { z } from "zod";

const router = express.Router();

// GET /api/deals - Get all deals for org
router.get("/", validate(dealQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { status } = req.validated?.query || req.query;
  const { page, limit, skip } = parsePagination(req.validated?.query || req.query);

  const where: any = { orgId };
  if (status) where.status = status;

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        lead: {
          select: { id: true, address: true, city: true, state: true, arv: true, moa: true },
        },
      },
    }),
    prisma.deal.count({ where }),
  ]);

  res.json({ 
    data: deals, 
    meta: createPaginationMeta(page, limit, total),
  });
}));

// GET /api/deals/metrics - Get deal metrics
router.get("/metrics", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const metrics = await DealDomain.getMetrics(orgId);
  res.json(metrics);
}));

// GET /api/deals/:id - Get single deal
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id },
    include: {
      lead: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!deal) {
    return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND" });
  }

  res.json(deal);
}));

// POST /api/deals - Create deal from lead (with transaction safety)
router.post("/", validate(createDealFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = req.auth!;
  const data = req.validated?.body || req.body;

  const deal = await DealDomain.create(orgId, userId, data);

  // Broadcast real-time update
  broadcastToOrg(orgId, {
    type: EVENTS.DEAL_CREATED,
    dealId: deal.id,
    leadId: data.leadId,
    payload: deal,
    timestamp: Date.now(),
  });

  res.status(201).json(deal);
}));

// PUT /api/deals/:id - Update deal
router.put("/:id", asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;

  if (data.closeDate) {
    data.closeDate = new Date(data.closeDate);
  }

  const deal = await prisma.deal.update({
    where: { id: req.params.id },
    data,
  });

  res.json(deal);
}));

// PATCH /api/deals/:id/close - Close deal (with transaction safety)
router.patch("/:id/close", validate(closeDealFullSchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { profit, closeDate } = req.validated?.body || req.body;

  const deal = await DealDomain.close(req.params.id, {
    profit,
    closeDate: closeDate ? new Date(closeDate) : undefined,
  });

  // Broadcast real-time update
  broadcastToOrg(orgId, {
    type: EVENTS.DEAL_CLOSED,
    dealId: deal.id,
    payload: deal,
    timestamp: Date.now(),
  });

  // Send notification
  const lead = await prisma.lead.findUnique({ where: { id: deal.leadId }, select: { address: true } });
  await notifyDealClosed(orgId, deal.id, Number(deal.profit) || 0, lead?.address || undefined);

  res.json(deal);
}));

// PATCH /api/deals/:id/cancel - Cancel deal (with transaction safety)
router.patch("/:id/cancel", asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;

  const deal = await DealDomain.cancel(req.params.id, reason);

  res.json(deal);
}));

// GET /api/deals/needs-attention - Get needs attention signals (read-only)
router.get("/needs-attention", asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;

  const signals = await getNeedsAttentionSignals(orgId);

  res.json({ signals });
}));

export default router;
