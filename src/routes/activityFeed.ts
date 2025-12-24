import express, { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorNormalizer";
import { activityFeedService } from "../services/activityFeed";
import { z } from "zod";
import { validate } from "../middleware/validate";

const router = express.Router();

const feedQuerySchema = z.object({
  query: z.object({
    limit: z.string().optional().default("50"),
    days: z.string().optional().default("7"),
  }),
});

// GET /api/activity - Get organization activity feed
router.get("/", validate(feedQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { limit } = req.validated?.query || req.query;

  const feed = await activityFeedService.getFeed(orgId, parseInt(limit as string) || 50);

  res.json({ data: feed });
}));

// GET /api/activity/daily - Get activity grouped by day
router.get("/daily", validate(feedQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { days } = req.validated?.query || req.query;

  const daily = await activityFeedService.getDailyActivity(orgId, parseInt(days as string) || 7);

  res.json({ data: daily });
}));

// GET /api/activity/summary - Get activity summary stats
router.get("/summary", validate(feedQuerySchema), asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.auth!;
  const { days } = req.validated?.query || req.query;

  const summary = await activityFeedService.getActivitySummary(orgId, parseInt(days as string) || 30);

  res.json(summary);
}));

// GET /api/activity/lead/:leadId - Get activity for specific lead
router.get("/lead/:leadId", asyncHandler(async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { limit = "50" } = req.query;

  const feed = await activityFeedService.getLeadFeed(leadId, parseInt(limit as string));

  res.json({ data: feed });
}));

export default router;










