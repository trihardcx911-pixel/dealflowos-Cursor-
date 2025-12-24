/**
 * Automation Engine
 * Rule-based automation for lead/deal workflows
 */

import prisma from "../lib/prisma";
import { enqueueEvent } from "../queue/eventQueue";
import { broadcastToOrg } from "../realtime/gateway";
import { EVENTS } from "../realtime/events";
import { notifyAutomationTriggered } from "../notifications/notify";

/**
 * Automation trigger types
 */
export type AutomationTrigger = 
  | "lead_created"
  | "lead_updated"
  | "status_change"
  | "event_logged"
  | "deal_created"
  | "deal_closed"
  | "qualification_changed";

/**
 * Automation rule interface
 */
export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  condition: (context: AutomationContext) => boolean;
  action: (context: AutomationContext) => Promise<void>;
  enabled: boolean;
}

/**
 * Context passed to automation rules
 */
export interface AutomationContext {
  lead?: any;
  deal?: any;
  event?: any;
  oldStatus?: string;
  newStatus?: string;
  userId?: string;
  orgId: string;
}

// Registry of automation rules
const rules: AutomationRule[] = [];

/**
 * Register an automation rule
 */
export function registerRule(rule: AutomationRule): void {
  rules.push(rule);
  console.log(`[automation] Registered rule: ${rule.name}`);
}

/**
 * Run automation engine for a trigger
 */
export async function runAutomation(
  trigger: AutomationTrigger,
  context: AutomationContext
): Promise<void> {
  const matchingRules = rules.filter(
    (r) => r.enabled && r.trigger === trigger
  );

  for (const rule of matchingRules) {
    try {
      if (rule.condition(context)) {
        console.log(`[automation] Executing rule: ${rule.name}`);
        await rule.action(context);
        
        // Broadcast automation triggered
        broadcastToOrg(context.orgId, {
          type: EVENTS.AUTOMATION_TRIGGERED,
          ruleId: rule.id,
          ruleName: rule.name,
          leadId: context.lead?.id,
          actionType: trigger,
          message: `Automation "${rule.name}" triggered`,
          timestamp: Date.now(),
        });

        // Send notification
        if (context.lead?.id) {
          await notifyAutomationTriggered(
            context.orgId,
            rule.id,
            rule.name,
            context.lead.id,
            trigger
          );

          // Log automation execution
          enqueueEvent({
            leadId: context.lead.id,
            eventType: "automation_executed",
            metadata: { ruleId: rule.id, ruleName: rule.name, trigger },
          });
        }
      }
    } catch (err) {
      console.error(`[automation] Rule "${rule.name}" failed:`, err);
    }
  }
}

/**
 * Get all registered rules
 */
export function getRules(): AutomationRule[] {
  return rules.map(r => ({ ...r, condition: undefined, action: undefined } as any));
}

/**
 * Enable/disable a rule
 */
export function setRuleEnabled(ruleId: string, enabled: boolean): void {
  const rule = rules.find(r => r.id === ruleId);
  if (rule) {
    rule.enabled = enabled;
  }
}

// ============================================
// Built-in Automation Rules
// ============================================

/**
 * Rule: Auto-log contact attempt when status becomes "contacted"
 */
registerRule({
  id: "auto-log-contact",
  name: "Auto-log contact on status change",
  trigger: "status_change",
  enabled: true,
  condition: (ctx) => ctx.newStatus === "contacted" && ctx.oldStatus === "new",
  action: async (ctx) => {
    if (!ctx.lead?.id) return;
    
    enqueueEvent({
      leadId: ctx.lead.id,
      eventType: "contacted",
      metadata: { automated: true, fromStatus: ctx.oldStatus },
    });
  },
});

/**
 * Rule: Create follow-up task when lead becomes "qualified"
 */
registerRule({
  id: "qualified-followup",
  name: "Create follow-up task on qualification",
  trigger: "status_change",
  enabled: true,
  condition: (ctx) => ctx.newStatus === "qualified",
  action: async (ctx) => {
    if (!ctx.lead?.id) return;
    
    // For now, log event. In future: create Task record
    enqueueEvent({
      leadId: ctx.lead.id,
      eventType: "note",
      metadata: { 
        automated: true, 
        content: "Lead qualified - follow up within 24 hours",
        taskType: "followup",
      },
    });
  },
});

/**
 * Rule: Alert when deal created from high-value lead
 */
registerRule({
  id: "high-value-deal-alert",
  name: "Alert on high-value deal creation",
  trigger: "deal_created",
  enabled: true,
  condition: (ctx) => {
    const arv = Number(ctx.lead?.arv || 0);
    return arv >= 500000;
  },
  action: async (ctx) => {
    if (!ctx.lead?.id) return;
    
    enqueueEvent({
      leadId: ctx.lead.id,
      eventType: "note",
      metadata: { 
        automated: true, 
        content: `High-value deal created! ARV: $${ctx.lead.arv}`,
        priority: "high",
      },
    });
  },
});

/**
 * Rule: Celebrate deal closure
 */
registerRule({
  id: "deal-closed-celebration",
  name: "Log celebration on deal close",
  trigger: "deal_closed",
  enabled: true,
  condition: () => true,
  action: async (ctx) => {
    if (!ctx.lead?.id || !ctx.deal) return;
    
    enqueueEvent({
      leadId: ctx.lead.id,
      eventType: "note",
      metadata: { 
        automated: true, 
        content: `🎉 Deal closed! Profit: $${ctx.deal.profit}`,
        celebratory: true,
      },
    });
  },
});

/**
 * Rule: Flag stale leads
 */
registerRule({
  id: "stale-lead-warning",
  name: "Warn about stale leads",
  trigger: "event_logged",
  enabled: false, // Disabled by default, enable per org
  condition: (ctx) => {
    if (!ctx.lead?.updatedAt) return false;
    const daysSinceUpdate = (Date.now() - new Date(ctx.lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7 && ctx.lead.status !== "closed" && ctx.lead.status !== "dead";
  },
  action: async (ctx) => {
    if (!ctx.lead?.id) return;
    
    enqueueEvent({
      leadId: ctx.lead.id,
      eventType: "note",
      metadata: { 
        automated: true, 
        content: "⚠️ This lead has been inactive for over 7 days",
        warning: true,
      },
    });
  },
});




