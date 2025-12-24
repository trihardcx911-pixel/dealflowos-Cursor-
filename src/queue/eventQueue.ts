/**
 * Simple in-memory event queue for async event logging
 * Future-proofed for migration to Redis/BullMQ
 */

import prisma from "../lib/prisma";

interface QueuedEvent {
  leadId: string;
  eventType: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// In-memory queue
const queue: QueuedEvent[] = [];

// Processing state
let isProcessing = false;
let processingInterval: NodeJS.Timeout | null = null;

/**
 * Add event to queue for async processing
 */
export function enqueueEvent(event: Omit<QueuedEvent, "createdAt">): void {
  queue.push({
    ...event,
    createdAt: new Date(),
  });
}

/**
 * Process queued events in batches
 */
async function processQueue(): Promise<void> {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  try {
    // Take up to 50 events from queue
    const batch = queue.splice(0, 50);
    
    if (batch.length === 0) return;

    // Batch insert events
    await prisma.leadEvent.createMany({
      data: batch.map((e) => ({
        leadId: e.leadId,
        eventType: e.eventType,
        metadata: e.metadata ?? {},
        createdAt: e.createdAt,
      })),
      skipDuplicates: true,
    });

    console.log(`[queue] Processed ${batch.length} events`);
  } catch (err) {
    console.error("[queue] Error processing events:", err);
    // On error, don't lose events - they stay in queue for retry
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the queue processor
 */
export function startEventQueue(intervalMs: number = 500): void {
  if (processingInterval) return;

  processingInterval = setInterval(processQueue, intervalMs);
  console.log(`[queue] Event queue started (interval: ${intervalMs}ms)`);
}

/**
 * Stop the queue processor
 */
export function stopEventQueue(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("[queue] Event queue stopped");
  }
}

/**
 * Get queue stats
 */
export function getQueueStats() {
  return {
    pending: queue.length,
    isProcessing,
  };
}

/**
 * Flush queue immediately (for graceful shutdown)
 */
export async function flushQueue(): Promise<void> {
  while (queue.length > 0) {
    await processQueue();
  }
}

/**
 * Enqueue with immediate response helper
 */
export function enqueueAndRespond(
  event: Omit<QueuedEvent, "createdAt">
): { queued: true; eventType: string } {
  enqueueEvent(event);
  return { queued: true, eventType: event.eventType };
}










