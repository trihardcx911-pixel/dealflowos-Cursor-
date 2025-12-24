/**
 * Data Cleanup & Archival Worker
 * Maintains database hygiene and performance
 */

import prisma from "../lib/prisma";

// Retention policies (in days)
const RETENTION_POLICIES = {
  deadLeads: 730,        // 2 years
  oldEvents: 365,        // 1 year
  pipelineHistory: 365,  // 1 year
  closedDeals: 1095,     // 3 years
};

/**
 * Run all cleanup tasks
 */
export async function cleanupWorker(): Promise<void> {
  console.log("[cleanupWorker] Starting cleanup...");

  const results = {
    archivedEvents: 0,
    archivedPipelineHistory: 0,
    cleanedOrphanedData: 0,
  };

  try {
    // Archive old events
    results.archivedEvents = await archiveOldEvents();
    
    // Archive old pipeline history
    results.archivedPipelineHistory = await archiveOldPipelineHistory();
    
    // Clean orphaned data
    results.cleanedOrphanedData = await cleanOrphanedData();

    console.log("[cleanupWorker] Completed:", results);
  } catch (err) {
    console.error("[cleanupWorker] Error:", err);
  }
}

/**
 * Archive events older than retention period
 */
async function archiveOldEvents(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_POLICIES.oldEvents);

  // For MVP: just count what would be archived
  // In production: move to archive table before deleting
  const count = await prisma.leadEvent.count({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  if (count > 0) {
    console.log(`[cleanupWorker] ${count} events eligible for archival`);
    
    // In production, you would:
    // 1. Copy to archive table
    // 2. Delete from main table
    // For now, we just log
  }

  return count;
}

/**
 * Archive old pipeline history
 */
async function archiveOldPipelineHistory(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_POLICIES.pipelineHistory);

  const count = await prisma.pipelineHistory.count({
    where: {
      changedAt: { lt: cutoffDate },
    },
  });

  if (count > 0) {
    console.log(`[cleanupWorker] ${count} pipeline history records eligible for archival`);
  }

  return count;
}

/**
 * Clean orphaned data (events for deleted leads, etc.)
 */
async function cleanOrphanedData(): Promise<number> {
  // Find events with no matching lead
  // This shouldn't happen with proper foreign keys, but check anyway
  const orphanedEvents = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "LeadEvent" e
    LEFT JOIN "Lead" l ON e."leadId" = l.id
    WHERE l.id IS NULL
  `;

  const count = Number(orphanedEvents[0]?.count || 0);
  
  if (count > 0) {
    console.log(`[cleanupWorker] Found ${count} orphaned events`);
  }

  return count;
}

/**
 * Get cleanup statistics
 */
export async function getCleanupStats() {
  const eventCutoff = new Date();
  eventCutoff.setDate(eventCutoff.getDate() - RETENTION_POLICIES.oldEvents);

  const pipelineCutoff = new Date();
  pipelineCutoff.setDate(pipelineCutoff.getDate() - RETENTION_POLICIES.pipelineHistory);

  const [oldEvents, oldPipeline, deadLeads] = await Promise.all([
    prisma.leadEvent.count({ where: { createdAt: { lt: eventCutoff } } }),
    prisma.pipelineHistory.count({ where: { changedAt: { lt: pipelineCutoff } } }),
    prisma.lead.count({ where: { status: "dead" } }),
  ]);

  return {
    eligibleForArchival: {
      events: oldEvents,
      pipelineHistory: oldPipeline,
      deadLeads,
    },
    retentionPolicies: RETENTION_POLICIES,
  };
}










