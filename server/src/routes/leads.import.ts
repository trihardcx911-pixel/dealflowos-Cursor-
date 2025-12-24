import express from "express";
import multer from "multer";
import csv from "csv-parser";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

export const leadsImportRouter = express.Router();
const upload = multer({ dest: "uploads/" });

// --- helper: detect file type ---
function isExcelFile(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".xls") || lower.endsWith(".xlsx");
}

// --- helper: parse CSV ---
function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
  .on("data", (data: any) => rows.push(data))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

// --- helper: parse XLSX ---
function parseXLSX(filePath: string): any[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

// --- POST /leads/import ---
leadsImportRouter.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = path.resolve(req.file.path);
    const filename = req.file.originalname;

    let rows: any[] = [];
    if (isExcelFile(filename)) {
      rows = parseXLSX(filePath);
    } else {
      rows = await parseCSV(filePath);
    }

    // map standardized columns
    const preview = rows.map((r) => ({
      address: r["Address"] || r["address"] || "",
      city: r["City"] || r["city"] || "",
      state: r["State"] || r["state"] || "",
      zip: r["Zip"] || r["zip"] || "",
      county: r["County"] || r["county"] || "",
      ownerName: r["Owner Name"] || r["ownerName"] || "",
      phone: r["Phone"] || r["phone"] || "",
    }));

    fs.unlinkSync(filePath); // cleanup
    res.json({ preview });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to import file" });
  }
});

// --- POST /leads/commit ---
leadsImportRouter.post("/commit", express.json(), async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: "Invalid leads payload" });
    }
    // TODO: Add Prisma insert later
    res.json({ ok: true, inserted: leads.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to commit leads" });
  }
});
