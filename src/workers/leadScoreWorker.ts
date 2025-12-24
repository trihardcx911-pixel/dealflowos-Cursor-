/**
 * Lead Scoring Worker
 * Recalculates lead scores on a schedule
 */

import prisma from "../lib/prisma";
import { leadScoreService } from "../services/leadScoreService";

/**
 * Recalculate scores for all active leads
 */
export async function leadScoreWorker(): Promise<void> {
  console.log("[leadScoreWorker] Starting lead score recalculation...");

  // Get leads that need scoring (active, updated recently)
  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ["closed", "dead"] },
    },
    select: { id: true, orgId: true },
  });

  let processed = 0;
  let errors = 0;

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (lead) => {
        try {
          await leadScoreService.calculateFullScore(lead.id);
          processed++;
        } catch (err) {
          errors++;
          console.error(`[leadScoreWorker] Error for lead ${lead.id}:`, err);
        }
      })
    );
  }

  console.log(`[leadScoreWorker] Completed: ${processed} leads scored, ${errors} errors`);
}










