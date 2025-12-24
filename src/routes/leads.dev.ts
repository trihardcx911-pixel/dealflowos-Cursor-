import express from "express";
import crypto from "crypto";

export const leadsDevRouter = express.Router();

// ===== In-Memory Storage (DEV ONLY) =====
export let leads: any[] = [];

// ===========================================
// GET /api/leads
// ===========================================
leadsDevRouter.get("/", (req, res) => {
  res.json({ items: leads });
});

// ===========================================
// POST /api/leads
// ===========================================
leadsDevRouter.post("/", (req, res) => {
  console.log("[LEADS_DEV] POST /api/leads body:", req.body);

  // Prevent hard crashes
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      error: "INVALID_BODY",
      message: "Request body must be JSON"
    });
  }

  let { type, address, city, state, zip, source } = req.body;

  // Normalize all fields to strings
  type = String(type ?? "").trim();
  address = String(address ?? "").trim();
  city = String(city ?? "").trim();
  state = String(state ?? "").trim();
  zip = String(zip ?? "").trim();
  source = String(source ?? "other").trim();

  // Required field
  if (!address) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Address is required"
    });
  }

  // Optional: Default type
  if (!type) type = "single_family";

  // Optional: Basic ZIP sanity check
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    console.warn("[LEADS_DEV] Invalid ZIP format:", zip);
  }

  const now = new Date().toISOString();

  const newLead = {
    id: crypto.randomUUID(),
    type,
    address,
    city,
    state,
    zip,
    source,
    createdAt: now,
    updatedAt: now,
  };

  leads.push(newLead);

  res.json({
    item: newLead,
    items: leads,
  });
});

// ===========================================
// GET /api/leads/summary
// ===========================================
leadsDevRouter.get("/summary", (req, res) => {
  const latest = [...leads].slice(-5);
  res.json({
    total: leads.length,
    latest,
    items: leads,
  });
});

// ===========================================
// PATCH /api/leads/:id
// ===========================================
leadsDevRouter.patch("/:id", (req, res) => {
  const { id } = req.params;
  let { type, address, city, state, zip, source } = req.body;

  // Normalize all fields to strings
  type = String(type ?? "").trim();
  address = String(address ?? "").trim();
  city = String(city ?? "").trim();
  state = String(state ?? "").trim().toUpperCase();
  zip = String(zip ?? "").trim();
  source = String(source ?? "other").trim();

  // Find the lead
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: "Lead not found"
    });
  }

  // Update the lead
  const updatedAt = new Date().toISOString();
  leads[index] = {
    ...leads[index],
    type,
    address,
    city,
    state,
    zip,
    source,
    updatedAt,
  };

  res.json({
    item: leads[index],
    items: leads,
  });
});

// ===========================================
// DELETE /api/leads/:id
// ===========================================
leadsDevRouter.delete("/:id", (req, res) => {
  const { id } = req.params;

  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: "Lead not found"
    });
  }

  leads.splice(index, 1);

  res.json({
    success: true,
    items: leads,
  });
});
