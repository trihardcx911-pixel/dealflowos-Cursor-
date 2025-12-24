/**
 * Notification Engine
 * Sends real-time notifications via WebSocket
 * Future: email, SMS, push notifications
 */

import { broadcastToOrg, broadcast } from "../realtime/gateway";
import { EVENTS, NotificationEvent } from "../realtime/events";
import prisma from "../lib/prisma";

export type NotificationCategory = "deal" | "automation" | "lead" | "system" | "warning";

export interface NotificationOptions {
  leadId?: string;
  dealId?: string;
  ruleId?: string;
  metadata?: Record<string, any>;
  persist?: boolean; // Store in database for history
}

/**
 * Send a notification to all clients in an organization
 */
export async function notify(
  orgId: string,
  category: NotificationCategory,
  message: string,
  options: NotificationOptions = {}
): Promise<void> {
  const event: NotificationEvent = {
    type: EVENTS.NOTIFICATION,
    orgId,
    category,
    message,
    metadata: {
      ...options.metadata,
      leadId: options.leadId,
      dealId: options.dealId,
      ruleId: options.ruleId,
    },
    timestamp: Date.now(),
  };

  // Send via WebSocket
  broadcastToOrg(orgId, event);

  // Optionally persist to database for notification history
  if (options.persist) {
    try {
      await prisma.automationLog.create({
        data: {
          orgId,
          leadId: options.leadId,
          ruleId: options.ruleId || "notification",
          ruleName: category,
          actionType: "notification",
          trigger: "system",
          metadata: { message, ...options.metadata },
        },
      });
    } catch (err) {
      console.error("[notify] Failed to persist notification:", err);
    }
  }

  console.log(`[notify] ${category}: ${message} (org: ${orgId})`);
}

/**
 * Notify about a closed deal
 */
export async function notifyDealClosed(
  orgId: string,
  dealId: string,
  profit: number,
  leadAddress?: string
): Promise<void> {
  const formattedProfit = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(profit);

  await notify(orgId, "deal", `🎉 Deal closed! ${leadAddress || "Property"} - Profit: ${formattedProfit}`, {
    dealId,
    metadata: { profit, leadAddress },
    persist: true,
  });
}

/**
 * Notify about high-value lead detected
 */
export async function notifyHighValueLead(
  orgId: string,
  leadId: string,
  arv: number,
  address?: string
): Promise<void> {
  const formattedArv = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(arv);

  await notify(orgId, "lead", `💰 High-value lead detected! ${address || "New property"} - ARV: ${formattedArv}`, {
    leadId,
    metadata: { arv, address },
  });
}

/**
 * Notify about automation rule triggered
 */
export async function notifyAutomationTriggered(
  orgId: string,
  ruleId: string,
  ruleName: string,
  leadId: string,
  actionType: string
): Promise<void> {
  await notify(orgId, "automation", `⚡ Automation "${ruleName}" triggered`, {
    ruleId,
    leadId,
    metadata: { actionType },
    persist: true,
  });
}

/**
 * Notify about stale leads
 */
export async function notifyStaleLeads(orgId: string, count: number): Promise<void> {
  if (count > 0) {
    await notify(orgId, "warning", `⚠️ ${count} leads haven't been touched in 7+ days`, {
      metadata: { staleCount: count },
    });
  }
}

/**
 * Notify about system events
 */
export async function notifySystem(message: string, metadata?: Record<string, any>): Promise<void> {
  // System-wide broadcast
  broadcast({
    type: EVENTS.NOTIFICATION,
    category: "system",
    message,
    metadata,
    timestamp: Date.now(),
  });
}







