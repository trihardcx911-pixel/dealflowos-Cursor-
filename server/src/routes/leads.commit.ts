import { Router } from "express";
import { z } from "zod";
// import { prisma } from "../prisma";

export const leadsCommitRouter = Router();

const LeadsBatchSchema = z.object({
  leads: z.array(z.object({
    address: z.string(), city: z.string(), state: z.string().length(2),
    zip: z.string().optional().nullable(),
    county: z.string().optional().nullable(),
    ownerName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
  })).min(1),
});

leadsCommitRouter.post("/commit", async (req, res) => {
  const parsed = LeadsBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { leads } = parsed.data;
  // await prisma.lead.createMany({ data: leads });
  return res.json({ ok: true, inserted: leads.length });
});
