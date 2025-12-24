import express from "express";

export function makeKpisRouter(pool?: any) {
  const router = express.Router();

  // --- GET /kpis ---
  router.get("/", (req, res) => {
    // TODO: Use pool for real data when available
    res.json({
      totalLeads: 20,
      activeLeads: 10,
      conversionRate: 5,
      assignments: 2,
      contractsInEscrow: 1,
      contactRate: 30,
      monthlyNewLeads: 7,
      monthlyProfit: 6000,
      charts: {
        leadsOverTime: [
          { month: "Jan", leads: 5 },
          { month: "Feb", leads: 8 },
          { month: "Mar", leads: 7 },
          { month: "Apr", leads: 10 },
          { month: "May", leads: 12 },
          { month: "Jun", leads: 15 }
        ],
        leadTypes: [
          { name: "Wholesale", value: 12 },
          { name: "Retail", value: 5 },
          { name: "Other", value: 3 }
        ]
      }
    });
  });

  return router;
}

