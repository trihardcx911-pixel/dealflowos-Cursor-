/**
 * Unit tests for KPI Service
 * 
 * Run with: npx jest tests/kpiService.test.ts
 * 
 * Note: These tests require a test database connection.
 * Set TEST_DATABASE_URL environment variable before running.
 */

import { kpiService } from "../src/services/kpiService";

// Mock Prisma client for unit tests
jest.mock("../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    deal: {
      findMany: jest.fn(),
    },
    leadEvent: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

import prisma from "../src/lib/prisma";

describe("kpiService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getKpis", () => {
    it("should return basic KPIs", async () => {
      // Setup mocks
      (prisma.lead.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalLeads
        .mockResolvedValueOnce(75)  // activeLeads
        .mockResolvedValueOnce(30); // qualifiedLeads
      
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([
        { profit: 15000, status: "closed", assignmentFee: 15000 },
        { profit: 12000, status: "closed", assignmentFee: 12000 },
        { profit: null, status: "in_progress", assignmentFee: 10000 },
      ]);

      const result = await kpiService.getKpis("org_123");

      expect(result.totalLeads).toBe(100);
      expect(result.activeLeads).toBe(75);
      expect(result.qualifiedLeads).toBe(30);
      expect(result.dealCount).toBe(3);
      expect(result.closedDealCount).toBe(2);
      expect(result.totalProfit).toBe(27000);
    });

    it("should calculate qualification rate correctly", async () => {
      (prisma.lead.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalLeads
        .mockResolvedValueOnce(50)  // activeLeads
        .mockResolvedValueOnce(25); // qualifiedLeads
      
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([]);

      const result = await kpiService.getKpis("org_123");

      expect(result.qualificationRate).toBe(25.0); // 25/100 * 100
    });

    it("should handle zero leads", async () => {
      (prisma.lead.count as jest.Mock).mockResolvedValue(0);
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([]);

      const result = await kpiService.getKpis("org_123");

      expect(result.totalLeads).toBe(0);
      expect(result.qualificationRate).toBe(0);
    });
  });

  describe("getContactRate", () => {
    it("should calculate contact rate correctly", async () => {
      (prisma.lead.count as jest.Mock).mockResolvedValue(100);
      (prisma.leadEvent.groupBy as jest.Mock).mockResolvedValue([
        { leadId: "1" },
        { leadId: "2" },
        { leadId: "3" },
      ]); // 3 unique leads contacted

      const result = await kpiService.getContactRate("org_123");

      expect(result).toBe(3.0); // 3/100 * 100 = 3%
    });

    it("should return 0 when no leads", async () => {
      (prisma.lead.count as jest.Mock).mockResolvedValue(0);

      const result = await kpiService.getContactRate("org_123");

      expect(result).toBe(0);
    });
  });

  describe("getAvgPipelineTime", () => {
    it("should return average pipeline time in days", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ avg_days: 14.5 }]);

      const result = await kpiService.getAvgPipelineTime("org_123");

      expect(result).toBe(14.5);
    });

    it("should return null when no data", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ avg_days: null }]);

      const result = await kpiService.getAvgPipelineTime("org_123");

      expect(result).toBeNull();
    });
  });

  describe("getMonthlyRevenue", () => {
    it("should sum assignment fees for closed deals this month", async () => {
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([
        { assignmentFee: 15000 },
        { assignmentFee: 12000 },
        { assignmentFee: 18000 },
      ]);

      const result = await kpiService.getMonthlyRevenue("org_123");

      expect(result).toBe(45000);
    });

    it("should return 0 when no closed deals", async () => {
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([]);

      const result = await kpiService.getMonthlyRevenue("org_123");

      expect(result).toBe(0);
    });
  });
});










