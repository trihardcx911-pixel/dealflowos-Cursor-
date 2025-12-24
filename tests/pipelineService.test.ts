/**
 * Unit tests for Pipeline Service
 * 
 * Run with: npx jest tests/pipelineService.test.ts
 */

import { pipelineService } from "../src/services/pipelineService";

// Mock Prisma client
jest.mock("../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    pipelineHistory: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    lead: {
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

import prisma from "../src/lib/prisma";

describe("pipelineService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPipelineStats", () => {
    it("should return pipeline stage counts", async () => {
      (prisma.pipelineHistory.groupBy as jest.Mock).mockResolvedValue([
        { newStatus: "contacted", _count: 45 },
        { newStatus: "qualified", _count: 20 },
        { newStatus: "offer_made", _count: 10 },
      ]);

      const result = await pipelineService.getPipelineStats("org_123");

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ stage: "contacted", count: 45 });
      expect(result[1]).toEqual({ stage: "qualified", count: 20 });
    });
  });

  describe("getLeadsByStage", () => {
    it("should return current leads grouped by status", async () => {
      (prisma.lead.groupBy as jest.Mock).mockResolvedValue([
        { status: "new", _count: 50 },
        { status: "contacted", _count: 30 },
        { status: "qualified", _count: 15 },
      ]);

      const result = await pipelineService.getLeadsByStage("org_123");

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ stage: "new", count: 50 });
    });
  });

  describe("getPipelineVelocity", () => {
    it("should return average hours between status changes", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ avg_hours: 48.5 }]);

      const result = await pipelineService.getPipelineVelocity("org_123");

      expect(result).toBe(48.5);
    });

    it("should return null when no transitions", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ avg_hours: null }]);

      const result = await pipelineService.getPipelineVelocity("org_123");

      expect(result).toBeNull();
    });
  });

  describe("getStageTransitions", () => {
    it("should count transitions between stages", async () => {
      (prisma.pipelineHistory.findMany as jest.Mock).mockResolvedValue([
        { oldStatus: "new", newStatus: "contacted" },
        { oldStatus: "new", newStatus: "contacted" },
        { oldStatus: "contacted", newStatus: "qualified" },
        { oldStatus: null, newStatus: "new" },
      ]);

      const result = await pipelineService.getStageTransitions("org_123");

      const newToContacted = result.find(t => t.transition === "new → contacted");
      expect(newToContacted?.count).toBe(2);
    });
  });

  describe("getRecentPipelineActivity", () => {
    it("should return recent pipeline changes with lead details", async () => {
      const mockActivity = [
        {
          id: "ph_1",
          leadId: "lead_1",
          oldStatus: "new",
          newStatus: "contacted",
          changedAt: new Date(),
          lead: { id: "lead_1", address: "123 Main St", city: "Austin", state: "TX" },
        },
      ];

      (prisma.pipelineHistory.findMany as jest.Mock).mockResolvedValue(mockActivity);

      const result = await pipelineService.getRecentPipelineActivity("org_123", 20);

      expect(result).toHaveLength(1);
      expect(result[0].lead.address).toBe("123 Main St");
    });

    it("should respect limit parameter", async () => {
      (prisma.pipelineHistory.findMany as jest.Mock).mockResolvedValue([]);

      await pipelineService.getRecentPipelineActivity("org_123", 5);

      expect(prisma.pipelineHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });
});










