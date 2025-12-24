/**
 * Worker Manager
 * Starts and manages all background workers
 */

import { schedule, stopAllJobs, getJobStatus } from "./scheduler";
import { recalcKpiWorker } from "./kpiWorker";
import { snapshotWorker } from "./snapshotWorker";
import { leadScoreWorker } from "./leadScoreWorker";
import { cleanupWorker } from "./cleanupWorker";
import { kpiDeltaWorker } from "./kpiDeltaWorker";
import { broadcast } from "../realtime/gateway";
import { EVENTS } from "../realtime/events";

/**
 * Start all background workers
 */
export function startWorkers(): void {
  console.log("[workers] Starting background workers...");

  // KPI recomputation - every 10 minutes
  schedule("*/10 * * * *", "kpi-recompute", recalcKpiWorker);

  // Daily KPI snapshot - every day at midnight (check hourly, run once per day)
  schedule("0 * * * *", "daily-snapshot", snapshotWorker);

  // Lead scoring - every 5 minutes
  schedule("*/5 * * * *", "lead-score", leadScoreWorker);

  // Cleanup worker - every hour
  schedule("0 * * * *", "cleanup", cleanupWorker);

  // KPI Delta worker - every 30 seconds (for real-time updates)
  schedule("*/1 * * * *", "kpi-delta", async () => {
    broadcast({ type: EVENTS.WORKER_STARTED, workerName: "kpi-delta", runAt: new Date().toISOString(), timestamp: Date.now() });
    const start = Date.now();
    try {
      await kpiDeltaWorker();
      broadcast({ type: EVENTS.WORKER_COMPLETED, workerName: "kpi-delta", runAt: new Date().toISOString(), duration: Date.now() - start, timestamp: Date.now() });
    } catch (err) {
      broadcast({ type: EVENTS.WORKER_FAILED, workerName: "kpi-delta", runAt: new Date().toISOString(), error: (err as Error).message, timestamp: Date.now() });
      throw err;
    }
  });

  console.log("[workers] All workers started");
}

/**
 * Stop all workers
 */
export function stopWorkers(): void {
  console.log("[workers] Stopping all workers...");
  stopAllJobs();
}

/**
 * Get status of all workers
 */
export function getWorkerStatus() {
  return getJobStatus();
}

// Re-export for external use
export { runJobNow } from "./scheduler";




