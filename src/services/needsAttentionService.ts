/**
 * Needs Attention Service
 * Aggregates existing data to surface observational signals
 * Read-only, no side effects, no state modification
 */

import prisma from "../lib/prisma";
import { LegalStage } from "@prisma/client";

export interface NeedsAttentionSignal {
  dealId: string;
  signalType: string;
  message: string;
  detectedAt: Date;
}

interface DealWithRelations {
  id: string;
  status: string;
  legalStage: LegalStage;
  createdAt: Date;
  updatedAt: Date;
  lead: {
    id: string;
  };
  titleMetadata: {
    expectedCloseDate: Date | null;
  } | null;
  legalConditions: Array<{
    id: string;
    status: string;
    severity: string;
    discoveredAt: Date;
  }>;
}

/**
 * Get all needs attention signals for an organization
 */
export async function getNeedsAttentionSignals(
  orgId: string
): Promise<NeedsAttentionSignal[]> {
  const signals: NeedsAttentionSignal[] = [];

  // Get all deals for the org with necessary relations
  const deals = await prisma.deal.findMany({
    where: { orgId },
    include: {
      lead: {
        select: { id: true },
      },
      titleMetadata: {
        select: { expectedCloseDate: true },
      },
      legalConditions: {
        select: {
          id: true,
          status: true,
          severity: true,
          discoveredAt: true,
        },
      },
    },
  });

  const now = new Date();

  for (const deal of deals) {
    // Signal 1: No Deal Activity in 14 Days
    const lastEvent = await prisma.dealEvent.findFirst({
      where: { dealId: deal.id },
      orderBy: { createdAt: "desc" },
    });

    if (!lastEvent) {
      // No events at all - check if deal is old enough
      const daysSinceCreation = Math.floor(
        (now.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCreation >= 14) {
        signals.push({
          dealId: deal.id,
          signalType: "no_activity",
          message: "No activity on this deal in 14 days",
          detectedAt: now,
        });
      }
    } else {
      const daysSinceLastEvent = Math.floor(
        (now.getTime() - lastEvent.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastEvent >= 14) {
        signals.push({
          dealId: deal.id,
          signalType: "no_activity",
          message: "No activity on this deal in 14 days",
          detectedAt: now,
        });
      }
    }

    // Signal 2: Legal Stage Unchanged in 21 Days
    const stageChangeEvent = await prisma.dealEvent.findFirst({
      where: {
        dealId: deal.id,
        eventType: "stage_transition",
      },
      orderBy: { createdAt: "desc" },
    });

    if (stageChangeEvent) {
      const daysSinceStageChange = Math.floor(
        (now.getTime() - stageChangeEvent.createdAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSinceStageChange >= 21) {
        signals.push({
          dealId: deal.id,
          signalType: "stage_unchanged",
          message: "Legal stage hasn't changed in 21 days",
          detectedAt: now,
        });
      }
    } else {
      // No stage change event - check deal age
      const daysSinceCreation = Math.floor(
        (now.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCreation >= 21) {
        signals.push({
          dealId: deal.id,
          signalType: "stage_unchanged",
          message: "Legal stage hasn't changed in 21 days",
          detectedAt: now,
        });
      }
    }

    // Signal 3: Open Blocking Issues
    const openBlockingIssues = deal.legalConditions.filter(
      (c) => c.status === "OPEN" && c.severity === "BLOCKING"
    );
    if (openBlockingIssues.length > 0) {
      signals.push({
        dealId: deal.id,
        signalType: "open_blocking_issues",
        message:
          "There's an open issue marked 'Needs to be resolved first'",
        detectedAt: now,
      });
    }

    // Signal 4: Open Issues Unresolved for 30 Days
    const oldOpenIssues = deal.legalConditions.filter((c) => {
      if (c.status !== "OPEN") return false;
      const daysSinceDiscovery = Math.floor(
        (now.getTime() - c.discoveredAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceDiscovery >= 30;
    });
    if (oldOpenIssues.length > 0) {
      signals.push({
        dealId: deal.id,
        signalType: "old_open_issues",
        message: "An open issue has been unresolved for 30 days",
        detectedAt: now,
      });
    }

    // Signal 5: Closing Date Approaching or Passed
    if (deal.titleMetadata?.expectedCloseDate) {
      const closeDate = new Date(deal.titleMetadata.expectedCloseDate);
      const daysUntilClose = Math.floor(
        (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilClose < 0) {
        signals.push({
          dealId: deal.id,
          signalType: "close_date_passed",
          message: "Expected closing date has passed",
          detectedAt: now,
        });
      } else if (daysUntilClose <= 7) {
        signals.push({
          dealId: deal.id,
          signalType: "close_date_approaching",
          message: "Expected closing date is coming up",
          detectedAt: now,
        });
      }
    }

    // Signal 6: Late Legal Stage With Open Issues
    const lateStages: LegalStage[] = ["ASSIGNED", "TITLE_CLEARING"];
    if (
      lateStages.includes(deal.legalStage) &&
      openBlockingIssues.length > 0
    ) {
      signals.push({
        dealId: deal.id,
        signalType: "late_stage_with_issues",
        message:
          "Deal is in a later stage with open issues still recorded",
        detectedAt: now,
      });
    }

    // Signal 7: Closed Deal With Unresolved Issues
    if (deal.status === "closed") {
      const openIssues = deal.legalConditions.filter(
        (c) => c.status === "OPEN"
      );
      if (openIssues.length > 0) {
        signals.push({
          dealId: deal.id,
          signalType: "closed_with_issues",
          message:
            "Deal was closed while some issues were still open",
          detectedAt: now,
        });
      }
    }
  }

  return signals;
}



