import express, { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";

const router = express.Router();

const updateSettingsSchema = z.object({
  defaultMultiplier: z.number().min(0).max(1).optional(),
  defaultAssignmentFee: z.number().min(0).optional(),
  defaultFollowupInterval: z.number().int().min(1).optional(),
});

// GET /api/user-settings - Get current user settings
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.auth!;
    
    let settings = await prisma.userSettings.findUnique({ where: { userId } });
    
    // Return defaults if no settings exist
    if (!settings) {
      settings = {
        userId,
        defaultMultiplier: 0.70 as any,
        defaultAssignmentFee: 10000 as any,
        defaultFollowupInterval: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/user-settings - Update user settings
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.auth!;

    const validation = updateSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: validation.data,
      create: { userId, ...validation.data },
    });

    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/user-settings - Partial update
router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.auth!;

    const validation = updateSettingsSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: validation.data,
      create: { userId, ...validation.data },
    });

    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/user-settings - Reset to defaults
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.auth!;

    await prisma.userSettings.deleteMany({ where: { userId } });

    res.json({ message: "Settings reset to defaults" });
  } catch (err) {
    next(err);
  }
});

export default router;
