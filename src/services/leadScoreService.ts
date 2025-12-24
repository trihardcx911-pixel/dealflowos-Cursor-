/**
 * Lead Score v2 Service
 * AI-lite scoring based on engagement, responsiveness, and deal metrics
 */

import prisma from "../lib/prisma";
import { calculateDealScore } from "../lib/formulas";

/**
 * Score weights configuration
 */
const SCORE_WEIGHTS = {
  // Engagement scoring
  callCount: 5,           // +5 per call
  smsCount: 3,            // +3 per SMS
  emailCount: 2,          // +2 per email
  noteCount: 1,           // +1 per note
  
  // Time-based scoring
  daysSinceLastEvent: {   // Based on days since last activity
    fresh: 10,            // < 2 days
    recent: 5,            // 2-7 days
    stale: -5,            // 7-14 days
    cold: -15,            // > 14 days
  },
  
  // Status scoring
  statusBonus: {
    new: 0,
    contacted: 10,
    qualified: 25,
    offer_made: 40,
    under_contract: 60,
    closed: 0,            // Already closed
    dead: -100,           // Dead lead
  },
  
  // Deal metrics
  offerBelowMoa: 20,      // +20 if offer < MOA
  offerAboveMoa: -20,     // -20 if offer > MOA
  spreadBonus: 10,        // +10 for every $10k of spread
  
  // Qualification
  qualifiedBonus: 15,     // +15 if qualified
};

export interface LeadScoreResult {
  totalScore: number;
  engagementScore: number;
  urgencyScore: number;
  dealScore: number;
  statusScore: number;
  breakdown: Record<string, number>;
  recommendations: string[];
}

export const leadScoreService = {
  /**
   * Calculate full lead score
   */
  async calculateFullScore(leadId: string): Promise<LeadScoreResult> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        events: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    const breakdown: Record<string, number> = {};
    const recommendations: string[] = [];

    // ============================================
    // Engagement Score
    // ============================================
    const eventCounts = lead.events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const callScore = (eventCounts.call || 0) * SCORE_WEIGHTS.callCount;
    const smsScore = (eventCounts.sms || 0) * SCORE_WEIGHTS.smsCount;
    const emailScore = (eventCounts.email || 0) * SCORE_WEIGHTS.emailCount;
    const noteScore = (eventCounts.note || 0) * SCORE_WEIGHTS.noteCount;

    breakdown.calls = callScore;
    breakdown.sms = smsScore;
    breakdown.emails = emailScore;
    breakdown.notes = noteScore;

    const engagementScore = callScore + smsScore + emailScore + noteScore;

    if (engagementScore < 10) {
      recommendations.push("Increase engagement - make more contact attempts");
    }

    // ============================================
    // Urgency Score (time-based)
    // ============================================
    const lastEvent = lead.events[0];
    let urgencyScore = 0;

    if (lastEvent) {
      const daysSinceLastEvent = (Date.now() - new Date(lastEvent.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastEvent < 2) {
        urgencyScore = SCORE_WEIGHTS.daysSinceLastEvent.fresh;
        breakdown.recency = urgencyScore;
      } else if (daysSinceLastEvent < 7) {
        urgencyScore = SCORE_WEIGHTS.daysSinceLastEvent.recent;
        breakdown.recency = urgencyScore;
      } else if (daysSinceLastEvent < 14) {
        urgencyScore = SCORE_WEIGHTS.daysSinceLastEvent.stale;
        breakdown.recency = urgencyScore;
        recommendations.push("Lead is going stale - reach out soon");
      } else {
        urgencyScore = SCORE_WEIGHTS.daysSinceLastEvent.cold;
        breakdown.recency = urgencyScore;
        recommendations.push("Lead is cold - needs immediate attention or should be marked dead");
      }
    } else {
      urgencyScore = SCORE_WEIGHTS.daysSinceLastEvent.cold;
      breakdown.recency = urgencyScore;
      recommendations.push("No activity logged - make initial contact");
    }

    // ============================================
    // Status Score
    // ============================================
    const statusScore = SCORE_WEIGHTS.statusBonus[lead.status as keyof typeof SCORE_WEIGHTS.statusBonus] || 0;
    breakdown.status = statusScore;

    // Qualification bonus
    if (lead.isQualified) {
      breakdown.qualified = SCORE_WEIGHTS.qualifiedBonus;
    }

    // ============================================
    // Deal Score
    // ============================================
    let dealScore = 0;
    const arv = lead.arv ? Number(lead.arv) : null;
    const moa = lead.moa ? Number(lead.moa) : null;
    const offerPrice = lead.offerPrice ? Number(lead.offerPrice) : null;

    if (arv && moa && offerPrice) {
      // Offer vs MOA
      if (offerPrice <= moa) {
        const spread = moa - offerPrice;
        const spreadBonus = Math.floor(spread / 10000) * SCORE_WEIGHTS.spreadBonus;
        dealScore += SCORE_WEIGHTS.offerBelowMoa + spreadBonus;
        breakdown.offerSpread = SCORE_WEIGHTS.offerBelowMoa + spreadBonus;
      } else {
        dealScore += SCORE_WEIGHTS.offerAboveMoa;
        breakdown.offerSpread = SCORE_WEIGHTS.offerAboveMoa;
        recommendations.push("Offer is above MOA - renegotiate or walk away");
      }
    } else {
      if (!arv) recommendations.push("Missing ARV - add property valuation");
      if (!moa) recommendations.push("MOA not calculated - add repair estimate");
      if (!offerPrice) recommendations.push("No offer price set");
    }

    // Existing deal score from formulas
    const calculatedDealScore = calculateDealScore({
      arv,
      estimatedRepairs: lead.estimatedRepairs ? Number(lead.estimatedRepairs) : null,
      moa,
      offerPrice,
    });
    
    if (calculatedDealScore) {
      dealScore += calculatedDealScore;
      breakdown.dealQuality = calculatedDealScore;
    }

    // ============================================
    // Total Score
    // ============================================
    const totalScore = Math.max(0, Math.min(100, 
      engagementScore + 
      urgencyScore + 
      statusScore + 
      (lead.isQualified ? SCORE_WEIGHTS.qualifiedBonus : 0) +
      dealScore
    ));

    // Update lead with new score
    await prisma.lead.update({
      where: { id: leadId },
      data: { dealScore: totalScore },
    });

    return {
      totalScore,
      engagementScore,
      urgencyScore,
      dealScore,
      statusScore,
      breakdown,
      recommendations,
    };
  },

  /**
   * Get leads sorted by score
   */
  async getTopLeads(orgId: string, limit: number = 20) {
    return prisma.lead.findMany({
      where: {
        orgId,
        status: { notIn: ["closed", "dead"] },
      },
      orderBy: { dealScore: "desc" },
      take: limit,
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        status: true,
        dealScore: true,
        arv: true,
        moa: true,
        isQualified: true,
      },
    });
  },

  /**
   * Get leads needing attention (low score, active)
   */
  async getLeadsNeedingAttention(orgId: string, limit: number = 20) {
    return prisma.lead.findMany({
      where: {
        orgId,
        status: { notIn: ["closed", "dead"] },
        OR: [
          { dealScore: { lt: 30 } },
          { dealScore: null },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
  },
};










