/**
 * Background Worker Scheduler
 * Manages scheduled jobs using cron-like patterns
 */

type WorkerFn = () => Promise<void>;

interface ScheduledJob {
  name: string;
  pattern: string;
  fn: WorkerFn;
  intervalId?: NodeJS.Timeout;
  lastRun?: Date;
  nextRun?: Date;
  isRunning: boolean;
  runCount: number;
  errorCount: number;
  lastError?: string;
}

const jobs: Map<string, ScheduledJob> = new Map();

/**
 * Parse cron-like pattern to interval in milliseconds
 * Supports patterns like every N minutes, hourly, daily
 */
function parsePattern(pattern: string): number {
  // Simplified patterns for MVP
  const patterns: Record<string, number> = {
    "*/1 * * * *": 60 * 1000,           // Every 1 minute
    "*/5 * * * *": 5 * 60 * 1000,       // Every 5 minutes
    "*/10 * * * *": 10 * 60 * 1000,     // Every 10 minutes
    "*/15 * * * *": 15 * 60 * 1000,     // Every 15 minutes
    "*/30 * * * *": 30 * 60 * 1000,     // Every 30 minutes
    "0 * * * *": 60 * 60 * 1000,        // Every hour
    "0 0 * * *": 24 * 60 * 60 * 1000,   // Every day at midnight
  };

  return patterns[pattern] || 60 * 60 * 1000; // Default: hourly
}

/**
 * Schedule a worker job
 */
export function schedule(pattern: string, name: string, fn: WorkerFn): void {
  const interval = parsePattern(pattern);
  
  const job: ScheduledJob = {
    name,
    pattern,
    fn,
    isRunning: false,
    runCount: 0,
    errorCount: 0,
  };

  // Run immediately then schedule
  runJob(job);
  
  job.intervalId = setInterval(() => runJob(job), interval);
  job.nextRun = new Date(Date.now() + interval);
  
  jobs.set(name, job);
  console.log(`[worker] Scheduled "${name}" with pattern "${pattern}" (every ${interval / 1000}s)`);
}

/**
 * Run a job with error handling
 */
async function runJob(job: ScheduledJob): Promise<void> {
  if (job.isRunning) {
    console.log(`[worker] "${job.name}" still running, skipping`);
    return;
  }

  job.isRunning = true;
  job.lastRun = new Date();

  try {
    console.log(`[worker] Running "${job.name}"`);
    await job.fn();
    job.runCount++;
    console.log(`[worker] "${job.name}" completed`);
  } catch (err) {
    job.errorCount++;
    job.lastError = (err as Error).message;
    console.error(`[worker] "${job.name}" failed:`, err);
  } finally {
    job.isRunning = false;
    const interval = parsePattern(job.pattern);
    job.nextRun = new Date(Date.now() + interval);
  }
}

/**
 * Stop a specific job
 */
export function stopJob(name: string): void {
  const job = jobs.get(name);
  if (job?.intervalId) {
    clearInterval(job.intervalId);
    jobs.delete(name);
    console.log(`[worker] Stopped "${name}"`);
  }
}

/**
 * Stop all jobs
 */
export function stopAllJobs(): void {
  jobs.forEach((job, name) => {
    if (job.intervalId) {
      clearInterval(job.intervalId);
    }
  });
  jobs.clear();
  console.log("[worker] All jobs stopped");
}

/**
 * Get job status
 */
export function getJobStatus(): Array<{
  name: string;
  pattern: string;
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
  lastError?: string;
}> {
  return Array.from(jobs.values()).map(job => ({
    name: job.name,
    pattern: job.pattern,
    isRunning: job.isRunning,
    lastRun: job.lastRun,
    nextRun: job.nextRun,
    runCount: job.runCount,
    errorCount: job.errorCount,
    lastError: job.lastError,
  }));
}

/**
 * Run a job immediately (for testing/manual trigger)
 */
export async function runJobNow(name: string): Promise<void> {
  const job = jobs.get(name);
  if (job) {
    await runJob(job);
  } else {
    throw new Error(`Job "${name}" not found`);
  }
}

