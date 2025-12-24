// src/services/underwritingService.ts

import { calculateMOA, calculateDealScore } from "../lib/formulas";
import prisma from "../lib/prisma";

export const underwritingService = {
  async recalcUnderwriting(leadId: string) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;

    const moa = calculateMOA(
      lead.arv ? Number(lead.arv) : null,
      Number(lead.investorMultiplier),
      lead.estimatedRepairs ? Number(lead.estimatedRepairs) : null,
      Number(lead.desiredAssignmentFee)
    );

    const dealScore = calculateDealScore({
      arv: lead.arv ? Number(lead.arv) : null,
      estimatedRepairs: lead.estimatedRepairs ? Number(lead.estimatedRepairs) : null,
      moa,
      offerPrice: lead.offerPrice ? Number(lead.offerPrice) : null,
    });

    return prisma.lead.update({
      where: { id: leadId },
      data: { moa, dealScore },
    });
  },

  // Calculate spread between offer and MOA
  calculateOfferSpread(offerPrice: number | null, moa: number | null): number | null {
    if (!offerPrice || !moa) return null;
    return moa - offerPrice;
  },

  // Check if deal meets minimum profit threshold
  meetsProfitThreshold(moa: number | null, offerPrice: number | null, minProfit: number = 5000): boolean {
    if (!moa || !offerPrice) return false;
    return (moa - offerPrice) >= minProfit;
  },
};
