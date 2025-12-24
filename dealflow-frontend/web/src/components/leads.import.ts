import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { z } from "zod";

export const leadsImportRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /leads/import — upload + parse preview
leadsImportRouter.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const preview = rows.slice(0, 10).map((r: any) => ({
      address: r.Address || "",
      city: r.City || "",
      state: r.State || "",
      zip: r.Zip || "",
      county: r.County || "",
      ownerName: r["Owner Name"] || "",
      phone: r.Phone || "",
    }));

    res.json({ preview });
  } catch (err: any) {
    console.error("Import failed:", err);
    res.status(500).json({ error: err.message || "File import failed" });
  }
});

// POST /leads/commit — save to DB later (stub)
leadsImportRouter.post("/commit", async (req, res) => {
  try {
    const leadsSchema = z.array(
      z.object({
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        county: z.string().optional(),
        ownerName: z.string().optional(),
        phone: z.string().optional(),
      })
    );

    const leads = leadsSchema.parse(req.body.leads);
    console.log("Received leads:", leads.length);

    // For now, just pretend we saved them
    res.json({ inserted: leads.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
