import { Router } from "express";
import { BatchClient } from "../lib/BatchClient";
import { classifyLeadType } from "../lib/classifyLeadType";
import { normalizeAddress, addressHashForOrg } from "../lib/normalizeAddress";

const importsRouter = Router();
export default importsRouter;

importsRouter.post("/start", async (req, res, next) => {
  try {
    // Input: { zip: "85001", limit?: 100 }
    const zip = String(req.body?.zip || "").trim();
    const limit = Number(req.body?.limit || 100);
    if (!zip) return res.status(400).json({ error: "zip required" });

    // For now, orgId comes from your request context (dev-bypass headers are fine).
    const orgId = (req as any).context?.orgId || "org_demo";

    const client = new BatchClient(process.env.BATCH_API_KEY);
    const sample: any[] = [];
    let imported = 0;

    for await (const row of client.streamByZip(zip, limit)) {
      const { canonical } = normalizeAddress({
        address1: row.address1,
        city: row.city,
        state: row.state,
        zip: row.zip,
      });
      const addressHash = addressHashForOrg(canonical, orgId);

      const cls = classifyLeadType({
        building_sqft: row.building_sqft,
        improvement_value: row.improvement_value,
        land_use: row.land_use,
        units: row.units,
      });

      // MVP slice: no DB write yet. Just collect a small preview.
      if (sample.length < 5) {
        sample.push({
          canonical,
          addressHash,
          lead_type: cls.type,
          land_signals: cls.signals,
        });
      }
      imported++;
    }

    return res.status(202).json({
      status: "queued(dry-run)",
      zip,
      imported,
      preview: sample,
    });
  } catch (err) {
    next(err);
  }
});
