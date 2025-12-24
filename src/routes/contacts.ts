import { Router, Request } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";

const router = Router({ mergeParams: true });

const createSchema = z.object({
  type: z.enum(["phone", "email"]).or(z.string().min(2)),
  value: z.string().min(3),
  source: z.string().optional(),
});

router.get("/", async (req: Request<{ leadId: string }>, res) => {
  const leadId = req.params.leadId;
  const items = await prisma.leadContact.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

router.post("/", async (req: Request<{ leadId: string }>, res, next) => {
  try {
    const leadId = req.params.leadId;
    const { type, value, source } = createSchema.parse(req.body ?? {});
    const contact = await prisma.leadContact.create({
      data: { leadId, type, value, source },
      select: { id: true },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

export default router;
