console.log(">>> leads.import.ts FILE LOADED");
import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import csv from "csv-parser";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getOrgLeads } from "../dev/leadsStore.js";
import { getOrgId } from "../middleware/getOrgId.js";

export const leadsImportRouter = express.Router();

// Debug flag: set DEBUG_IMPORT=1 to log mapping resolution (no PII)
const DEBUG_IMPORT = process.env.DEBUG_IMPORT === "1";

// Multer configuration with file size limit (10MB max to prevent DoS)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_FILE_SIZE },
});

// Multer error handler middleware
function handleMulterError(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(500).json({ error: "File upload failed" });
  }
  next();
}

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

// --- Helper: normalize header for matching (strip BOM, punctuation, whitespace, lowercase) ---
function normalizeHeaderForMatching(header: string): string {
  return header
    .replace(/^\uFEFF/, "") // strip BOM
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove all non-alphanumeric
}

// --- Alias map for default column mapping ---
// Each alias list includes common variants; normalization handles case/punctuation
const COLUMN_ALIAS_MAP: Record<string, string[]> = {
  address: ["Address", "address", "Property Address", "street", "Street", "STREET", "ADDRESS", "property_address", "propertyaddress"],
  city: ["City", "city", "Town", "CITY", "TOWN"],
  state: ["State", "state", "ST", "STATE"],
  zip: ["Zip", "zip", "ZIP", "Postal", "Postal Code", "ZIPCODE", "Zip Code", "zip_code", "zipcode"],
  ownerName: ["Owner Name", "ownerName", "homeowner_name", "homeownerName", "Homeowner", "Owner", "OWNER", "OWNER NAME", "owner_name", "ownername"],
  phone: ["Phone", "phone", "phoneNumber", "sellerPhone", "Phone #", "Contact Phone", "PHONE", "PHONE NUMBER", "phone_number", "phonenumber"],
  notes: ["Notes", "notes", "County", "county", "Violation", "violation", "Reason", "NOTES", "COUNTY"],
  parcelId: ["Parcel ID", "parcelId", "Parcel", "PARCEL", "APN", "parcel_id", "parcelid"],
  legalDescription: ["Legal Description", "legalDescription", "Legal", "legal_description", "legaldescription"],
};

// Pre-compute normalized alias -> field lookup for fallback matching
const NORMALIZED_ALIAS_LOOKUP: Map<string, { field: string; original: string }> = new Map();
for (const [field, aliases] of Object.entries(COLUMN_ALIAS_MAP)) {
  for (const alias of aliases) {
    const normalized = normalizeHeaderForMatching(alias);
    // First alias wins if there's a collision (unlikely)
    if (!NORMALIZED_ALIAS_LOOKUP.has(normalized)) {
      NORMALIZED_ALIAS_LOOKUP.set(normalized, { field, original: alias });
    }
  }
}

// --- Helper: find which header matches a field using alias map ---
function findHeaderForField(headers: string[], field: string): string | null {
  const aliases = COLUMN_ALIAS_MAP[field];
  if (!aliases) return null;

  // Fast path: exact match
  for (const alias of aliases) {
    if (headers.includes(alias)) {
      return alias;
    }
  }

  // Fallback: normalized match (handles case/punctuation/BOM)
  const aliasNormSet = new Set(aliases.map(normalizeHeaderForMatching));
  for (const header of headers) {
    const headerNorm = normalizeHeaderForMatching(header);
    if (aliasNormSet.has(headerNorm)) {
      return header; // Return ORIGINAL header from file
    }
  }

  return null;
}

// --- Helper: detect if headers look like a header row vs data row ---
// Uses core fields only: address, city, state, zip, ownerName, phone
// Returns true if at least 2 core fields match (avoids false positives)
// Special case: single-column file with "Address" header is valid (for splitRule guidance)
const CORE_FIELDS = ["address", "city", "state", "zip", "ownerName", "phone"] as const;

function looksLikeHeaderRow(headers: string[]): { isHeaderRow: boolean; matchCount: number; isSingleAddressColumn: boolean } {
  // Filter out empty and __EMPTY* headers (XLSX artifacts)
  const usableHeaders = headers.filter(h => h && !h.startsWith("__EMPTY") && !/^_\d+$/.test(h));

  let matchCount = 0;
  const matchedFields: string[] = [];
  for (const field of CORE_FIELDS) {
    if (findHeaderForField(usableHeaders, field) !== null) {
      matchCount++;
      matchedFields.push(field);
    }
  }

  // Special case: single usable column that matches "address" is valid
  // This allows single-column "Address" files to proceed with splitRule guidance
  const isSingleAddressColumn = usableHeaders.length === 1 && matchedFields.includes("address");

  // Threshold: at least 2 core fields must match, OR single address column
  const isHeaderRow = matchCount >= 2 || isSingleAddressColumn;

  return { isHeaderRow, matchCount, isSingleAddressColumn };
}

// --- Helper: extract value from row with type coercion (XLSX returns numbers) ---
function extractRowValue(row: any, header: string | null): string {
  if (!header || row[header] === undefined || row[header] === null) return "";
  return String(row[header]).trim();
}

// --- Helper: normalize ZIP for preview display ---
// Rules: strip non-digits; 4-5 digits -> left-pad to 5; 9+ digits -> keep first 5; <4 -> as-is
function normalizeZipForPreview(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length >= 4 && digits.length <= 5) {
    return digits.padStart(5, "0");
  }
  if (digits.length >= 9) {
    return digits.slice(0, 5);
  }
  // <4 digits or 6-8 digits: return as-is (unusual but don't mangle)
  return digits;
}

// --- Helper: normalize phone for preview display ---
// Rules: digits-only; 11 digits starting with 1 -> strip leading 1; <7 -> empty; else keep
function normalizePhoneForPreview(value: string): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // Strip leading 1 from 11-digit US numbers
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  // Too short to be a valid phone
  if (digits.length < 7) return "";
  return digits;
}

// --- Helper: compute sourceFingerprint from headers ---
function computeSourceFingerprint(headers: string[]): string {
  // Normalize: lowercase, trim, sort alphabetically, join with pipe
  const normalized = headers
    .map((h) => h.toLowerCase().trim())
    .filter((h) => h.length > 0 && !h.startsWith("__empty") && !/^_\d+$/.test(h))
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex").substring(0, 16);
}

// --- Helper: build headerSamples (first non-empty value per header) ---
function buildHeaderSamples(rows: any[], headers: string[]): Record<string, string> {
  const samples: Record<string, string> = {};
  for (const header of headers) {
    for (const row of rows) {
      const val = row[header];
      if (val !== undefined && val !== null && String(val).trim().length > 0) {
        const trimmed = String(val).trim();
        samples[header] = trimmed.length > 80 ? trimmed.substring(0, 80) : trimmed;
        break;
      }
    }
  }
  return samples;
}

// --- Helper: parse optional mapping from FormData ---
interface CustomMapping {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ownerName?: string;
  phone?: string;
  notes?: string;
  defaultCity?: string;
  defaultState?: string;
  splitRule?: "address_dash_notes";
}

// Map frontend *Key suffix to canonical keys (frontend sends addressKey, server uses address)
const FRONTEND_KEY_MAP: Record<string, string> = {
  addressKey: "address",
  cityKey: "city",
  stateKey: "state",
  zipKey: "zip",
  ownerKey: "ownerName",
  phoneKey: "phone",
  notesKey: "notes",
};

function parseCustomMapping(mappingStr: string | undefined, headers: string[]): CustomMapping | null {
  if (!mappingStr) return null;

  // Cap size: max 10kb
  if (mappingStr.length > 10240) {
    console.warn("[IMPORT] Mapping payload too large, ignoring");
    return null;
  }

  try {
    const parsed = JSON.parse(mappingStr);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.warn("[IMPORT] Mapping is not an object, ignoring");
      return null;
    }

    const validKeys = ["address", "city", "state", "zip", "ownerName", "phone", "notes", "defaultCity", "defaultState", "splitRule"];
    const result: CustomMapping = {};

    for (const key of validKeys) {
      if (key === "defaultCity" || key === "defaultState") {
        // String defaults (not header references)
        if (typeof parsed[key] === "string" && parsed[key].trim().length > 0) {
          (result as any)[key] = parsed[key].trim();
        }
      } else if (key === "splitRule") {
        // Only allow "address_dash_notes"
        if (parsed[key] === "address_dash_notes") {
          result.splitRule = "address_dash_notes";
        }
      } else {
        // Header reference - accept both canonical key (address) and frontend *Key suffix (addressKey)
        // First check canonical key
        if (typeof parsed[key] === "string" && headers.includes(parsed[key])) {
          (result as any)[key] = parsed[key];
        } else {
          // Check for *Key variant from frontend (e.g., addressKey → address)
          const frontendKey = Object.entries(FRONTEND_KEY_MAP).find(([_, canonical]) => canonical === key)?.[0];
          if (frontendKey && typeof parsed[frontendKey] === "string" && headers.includes(parsed[frontendKey])) {
            (result as any)[key] = parsed[frontendKey];
          }
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.warn("[IMPORT] Failed to parse mapping JSON, ignoring:", e);
    return null;
  }
}

// --- POST /leads/import (preview) ---
leadsImportRouter.post("/", upload.single("file"), handleMulterError, async (req: Request, res: Response) => {
  try {
    const file = (req as express.Request & { file?: { path: string; originalname: string } }).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = path.resolve(file.path);
    const filename = file.originalname;

    let rows: any[] = [];
    if (isExcelFile(filename)) {
      rows = parseXLSX(filePath);
    } else {
      rows = await parseCSV(filePath);
    }

    // Extract raw headers from first row
    const headers: string[] = rows.length > 0 ? Object.keys(rows[0]) : [];

    // --- Headerless detection: check if first row looks like headers ---
    // Runs unconditionally (regardless of mapping) to catch truly headerless files
    const mappingStr = req.body?.mapping;
    if (rows.length > 0 && headers.length > 0) {
      const { isHeaderRow, matchCount, isSingleAddressColumn } = looksLikeHeaderRow(headers);
      if (!isHeaderRow) {
        // Cleanup temp file before returning error
        fs.unlinkSync(filePath);

        if (DEBUG_IMPORT) {
          console.log("[IMPORT DEBUG] NO_HEADERS", { matchCount, headerCount: headers.length, isSingleAddressColumn });
        }

        return res.status(400).json({
          errorCode: "NO_HEADERS",
          error: "No headers detected—add a header row or provide column mapping.",
          requiredHeaders: [
            "Address (or Property Address / Street Address)",
            "City",
            "State",
            "Zip (or Zip Code / Postal Code)",
            "Owner Name (or Owner)",
            "Phone (optional)",
            "Notes (optional)",
          ],
          hint: "Your first row must be column names, not data. Example: Address, City, State, Zip, Owner Name",
          matchCount,
          detectedHeaderSample: headers.slice(0, 6),
        });
      }
    }

    // Build header samples
    const headerSamples = buildHeaderSamples(rows, headers);

    // Compute source fingerprint
    const sourceFingerprint = computeSourceFingerprint(headers);

    // Parse optional custom mapping from FormData (already extracted above for headerless check)
    const customMapping = parseCustomMapping(mappingStr, headers);

    // Build column mapping (which header is used for each field)
    const columnMapping: Record<string, string> = {};

    // Determine effective header for each field
    const effectiveHeaders: Record<string, string | null> = {
      address: customMapping?.address ?? findHeaderForField(headers, "address"),
      city: customMapping?.city ?? findHeaderForField(headers, "city"),
      state: customMapping?.state ?? findHeaderForField(headers, "state"),
      zip: customMapping?.zip ?? findHeaderForField(headers, "zip"),
      ownerName: customMapping?.ownerName ?? findHeaderForField(headers, "ownerName"),
      phone: customMapping?.phone ?? findHeaderForField(headers, "phone"),
      notes: customMapping?.notes ?? findHeaderForField(headers, "notes"),
      parcelId: findHeaderForField(headers, "parcelId"),
      legalDescription: findHeaderForField(headers, "legalDescription"),
    };

    // Populate columnMapping with non-null effective headers
    for (const [field, header] of Object.entries(effectiveHeaders)) {
      if (header) {
        columnMapping[field] = header;
      }
    }

    // Debug logging (no PII - only field/header names)
    if (DEBUG_IMPORT) {
      console.log("[IMPORT DEBUG]", {
        sourceFingerprint,
        customMappingKeys: customMapping ? Object.keys(customMapping) : null,
        effectiveHeaders,
      });
    }

    // Check if splitRule applies
    const applySplitRule =
      customMapping?.splitRule === "address_dash_notes" &&
      headers.length === 1 &&
      effectiveHeaders.address === effectiveHeaders.notes;

    // Map rows and validate
    let validRowsCount = 0;
    let invalidRowsCount = 0;

    const preview = rows.map((r, idx) => {
      let address = extractRowValue(r, effectiveHeaders.address);
      let notes = extractRowValue(r, effectiveHeaders.notes);

      // Apply splitRule if enabled
      if (applySplitRule && address) {
        const dashIdx = address.indexOf(" - ");
        if (dashIdx > 0) {
          notes = address.substring(dashIdx + 3).trim();
          address = address.substring(0, dashIdx).trim();
        }
      }

      // Apply defaults
      let city = extractRowValue(r, effectiveHeaders.city);
      let state = extractRowValue(r, effectiveHeaders.state);
      if (!city && customMapping?.defaultCity) city = customMapping.defaultCity;
      if (!state && customMapping?.defaultState) state = customMapping.defaultState;

      // Normalize ZIP and phone for preview display
      const rawZip = extractRowValue(r, effectiveHeaders.zip);
      const rawPhone = extractRowValue(r, effectiveHeaders.phone);

      const mapped: LeadImportRow = {
        address,
        city,
        state,
        zip: normalizeZipForPreview(rawZip),
        county: extractRowValue(r, findHeaderForField(headers, "notes")), // County often in notes alias
        ownerName: extractRowValue(r, effectiveHeaders.ownerName),
        phone: normalizePhoneForPreview(rawPhone) || undefined, // empty string -> undefined for cleaner display
        parcelId: extractRowValue(r, effectiveHeaders.parcelId),
        legalDescription: extractRowValue(r, effectiveHeaders.legalDescription),
        notes,
        _rowIndex: idx,
      };

      // Run validation (same logic as commit handler)
      const validation = validateImportRow(mapped);
      mapped._errors = validation.errors;
      mapped._warnings = validation.warnings;

      if (validation.valid) {
        validRowsCount++;
      } else {
        invalidRowsCount++;
      }

      return mapped;
    });

    fs.unlinkSync(filePath); // cleanup

    // Compute usable headers count for response
    const usableHeadersForResponse = headers.filter(h => h && !h.startsWith("__EMPTY") && !/^_\d+$/.test(h));
    const isSingleColumn = usableHeadersForResponse.length === 1;

    // Build response with all metadata
    const response: {
      preview: LeadImportRow[];
      headers: string[];
      headerSamples: Record<string, string>;
      sourceFingerprint: string;
      columnMapping: Record<string, string>;
      totalRows: number;
      validRows: number;
      invalidRows: number;
      warningMessage?: string;
      mappingApplied?: boolean;
      isSingleColumn?: boolean;
    } = {
      preview,
      headers,
      headerSamples,
      sourceFingerprint,
      columnMapping,
      totalRows: rows.length,
      validRows: validRowsCount,
      invalidRows: invalidRowsCount,
    };

    // Indicate if custom mapping was applied
    if (customMapping) {
      response.mappingApplied = true;
    }

    // Include isSingleColumn for client-side splitRule guidance
    if (isSingleColumn) {
      response.isSingleColumn = true;
    }

    // Add warning if no valid rows - provide context-specific guidance
    if (validRowsCount === 0 && rows.length > 0) {
      // Reuse already-computed usableHeadersForResponse
      const usableHeaders = usableHeadersForResponse;

      if (usableHeaders.length === 1) {
        // Single column: suggest splitRule
        response.warningMessage =
          "Single-column file detected. If your column contains 'address - notes' format, " +
          "open Edit mapping and enable 'Address + Notes (split on dash)'.";
      } else if (usableHeaders.length > 1) {
        // Multi-column but no address detected
        response.warningMessage =
          "No Address column detected. Your file has headers, but none match standard address fields. " +
          "Use Edit mapping to select which column contains addresses.";
      } else {
        // No usable headers at all
        response.warningMessage =
          "No valid columns detected. Please check that your file contains data.";
      }
    }

    res.json(response);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to import file" });
  }
});

// --- Type definition for import rows ---
interface LeadImportRow {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  notes?: string;
  ownerName?: string;
  homeownerName?: string;
  phone?: string;
  phoneNumber?: string;
  parcelId?: string;
  legalDescription?: string;
  assessedValue?: number | string;
  squareFeet?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  yearBuilt?: number | string;
  lotSize?: number | string;
  type?: string;
  sellerPhone?: string;
  sellerName?: string;
  sellerEmail?: string;
  _rowIndex?: number;
  _errors?: string[];
  _warnings?: string[];
}

// --- Helper: normalize phone to digits only, null if too short ---
// Same logic as normalizePhoneForPreview for consistency
function normalizePhone(value: string | undefined | null): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Strip leading 1 from 11-digit US numbers
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits.length >= 7 ? digits : null;
}

// --- Helper: normalize homeowner name, null if empty ---
function normalizeHomeownerName(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// --- Validation function ---
function validateImportRow(row: LeadImportRow): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Hard errors: Must have at least one identifier
  const hasAddress = row.address && row.address.trim().length > 0;
  const hasParcelId = row.parcelId && row.parcelId.trim().length > 0;
  const hasLegalDescription = row.legalDescription && row.legalDescription.trim().length > 0;

  if (!hasAddress && !hasParcelId && !hasLegalDescription) {
    errors.push("Missing address, parcel ID, or legal description");
  }

  // Warnings (non-blocking)
  if (!row.city || row.city.trim().length === 0) {
    warnings.push("Missing city");
  }

  if (!row.state || row.state.trim().length === 0) {
    warnings.push("Missing state");
  }

  if (!row.zip || row.zip.trim().length === 0) {
    warnings.push("Missing zip");
  } else {
    const zipDigits = String(row.zip).replace(/\D/g, "");
    if (zipDigits.length < 5) {
      warnings.push(`ZIP code must contain at least 5 digits`);
    }
  }

  const phone = row.phone || row.sellerPhone;
  if (phone) {
    const phoneDigits = String(phone).replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      warnings.push(`Phone not 10 digits: ${phone}`);
    }
  }

  if (row.assessedValue !== undefined && row.assessedValue !== null && row.assessedValue !== "") {
    const numValue = typeof row.assessedValue === "string" 
      ? parseFloat(row.assessedValue.replace(/[^0-9.-]/g, ""))
      : Number(row.assessedValue);
    if (isNaN(numValue)) {
      warnings.push(`Non-numeric assessedValue: ${row.assessedValue}`);
    }
  }

  if (row.squareFeet !== undefined && row.squareFeet !== null && row.squareFeet !== "") {
    const numValue = typeof row.squareFeet === "string"
      ? parseFloat(row.squareFeet.replace(/[^0-9.-]/g, ""))
      : Number(row.squareFeet);
    if (isNaN(numValue)) {
      warnings.push(`Non-numeric squareFeet: ${row.squareFeet}`);
    }
  }

  if (row.bedrooms !== undefined && row.bedrooms !== null && row.bedrooms !== "") {
    const numValue = typeof row.bedrooms === "string"
      ? parseFloat(row.bedrooms.replace(/[^0-9.-]/g, ""))
      : Number(row.bedrooms);
    if (isNaN(numValue)) {
      warnings.push(`Non-numeric bedrooms: ${row.bedrooms}`);
    }
  }

  if (row.bathrooms !== undefined && row.bathrooms !== null && row.bathrooms !== "") {
    const numValue = typeof row.bathrooms === "string"
      ? parseFloat(row.bathrooms.replace(/[^0-9.-]/g, ""))
      : Number(row.bathrooms);
    if (isNaN(numValue)) {
      warnings.push(`Non-numeric bathrooms: ${row.bathrooms}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// --- Normalize address fields defensively ---
function normalizeAddressFields(row: LeadImportRow): {
  address: string;
  city: string;
  state: string;
  zip: string;
  parcelId: string;
  legalDescription: string;
} {
  const normalizeString = (s: string | undefined | null): string => {
    if (!s) return "";
    // Trim, collapse multiple spaces, remove non-breaking spaces and other whitespace variants
    return String(s)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
      .replace(/\s+/g, " ");
  };

  const normalizeState = (s: string | undefined | null): string => {
    const normalized = normalizeString(s);
    return normalized.toUpperCase().slice(0, 2);
  };

  const normalizeZip = (s: string | undefined | null): string => {
    // Use same logic as normalizeZipForPreview for consistency
    if (!s) return "";
    const digits = String(s).replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length >= 4 && digits.length <= 5) {
      return digits.padStart(5, "0");
    }
    if (digits.length >= 9) {
      return digits.slice(0, 5);
    }
    return digits;
  };

  return {
    address: normalizeString(row.address),
    city: normalizeString(row.city),
    state: normalizeState(row.state),
    zip: normalizeZip(row.zip),
    parcelId: normalizeString(row.parcelId),
    legalDescription: normalizeString(row.legalDescription),
  };
}

// --- Address hash calculation ---
function calculateAddressHash(
  orgId: string,
  normalized: ReturnType<typeof normalizeAddressFields>
): string {
  let hashInput: string;

  // Prefer full address (address + city + state + zip)
  if (normalized.address && normalized.city && normalized.state && normalized.zip && normalized.zip.length === 5) {
    const canonical = `${normalized.address}, ${normalized.city}, ${normalized.state} ${normalized.zip}`;
    hashInput = `${canonical}|${orgId}`;
  } 
  // Else fall back to parcelId
  else if (normalized.parcelId) {
    hashInput = `parcel:${normalized.parcelId}|${orgId}`;
  }
  // Else fall back to legalDescription
  else if (normalized.legalDescription) {
    hashInput = `legal:${normalized.legalDescription}|${orgId}`;
  } 
  // Else fall back to normalized address string only
  else if (normalized.address) {
    hashInput = `address:${normalized.address}|${orgId}`;
  } 
  else {
    throw new Error("Cannot calculate addressHash: no identifier available");
  }

  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

// --- Parse numeric field safely ---
function parseNumericField(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// --- Parse integer field safely ---
function parseIntField(value: number | string | undefined | null): number | null {
  const num = parseNumericField(value);
  return num === null ? null : Math.floor(num);
}

// --- POST /leads/commit ---
leadsImportRouter.post("/commit", express.json({ limit: "10mb" }), async (req, res) => {
  try {
    // Authentication check
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { leads } = req.body;

    // Validate input
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: "Invalid leads payload: must be an array" });
    }

    if (leads.length > 1000) {
      return res.status(400).json({ error: "Too many leads: maximum 1000 rows per import" });
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: "Empty leads array" });
    }

    // Canonical orgId: req.orgId or getOrgId(req). Do NOT fallback to req.user.id.
    let orgId: string;
    try {
      orgId = getOrgId(req);
    } catch (e: any) {
      return res.status(400).json({
        error: "orgId not found",
        hint: e?.message || "Ensure auth sets org scope or in dev use x-dev-org-id.",
      });
    }
    const userId = req.user.id;

    if (process.env.NODE_ENV !== "production" && process.env.DEV_DIAGNOSTICS === "1") {
      console.log(`[IMPORT] commit resolved orgId=${orgId} userId=${userId} hasAuth=${!!req.headers.authorization}`);
    }

    const hasDatabase = Boolean(process.env.DATABASE_URL);

    // Fetch existing addressHashes for deduplication (and fail fast if org does not exist)
    let existingHashes: Set<string>;
    if (hasDatabase) {
      const { prisma } = await import("../db/prisma.js");
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        return res.status(400).json({
          error: "Invalid orgId for import",
          orgId,
          hint: "Org not found. In dev, use DEV_BYPASS + x-dev-org-id or ensure JWT/org scope resolves to an existing org (org_dev/org_demo).",
        });
      }
      const existingLeads = await prisma.lead.findMany({
        where: { orgId },
        select: { addressHash: true },
      });
      existingHashes = new Set(existingLeads.map((l) => l.addressHash));
    } else {
      // DEV MODE: In-memory import commit (no Prisma)
      const existingLeads = getOrgLeads(orgId);
      existingHashes = new Set(existingLeads.map((l: any) => l.addressHash).filter(Boolean));
    }

    // Track hashes seen in this batch to prevent duplicate_in_file
    const batchHashes = new Set<string>();

    const inserted: number[] = [];
    const errors: Array<{ rowIndex: number; errors: string[] }> = [];
    const skippedRows: Array<{ rowIndex: number; reason: "duplicate" | "duplicate_in_file" | "duplicate_in_upload" | "validation_error"; address?: string }> = [];
    const validLeads: Array<{
      orgId: string;
      type: "sfr" | "land" | "multi" | "other";
      address: string;
      city: string;
      state: string;
      zip: string;
      addressHash: string;
      source: string;
      notes: string | null;
    }> = [];

    // Process each row
    for (let i = 0; i < leads.length; i++) {
      const row: LeadImportRow = { ...leads[i], _rowIndex: i };

      // Normalize address fields before validation and hash calculation
      const normalized = normalizeAddressFields(row);
      
      // Create normalized row for validation (use normalized fields)
      const normalizedRow: LeadImportRow = {
        ...row,
        address: normalized.address,
        city: normalized.city,
        state: normalized.state,
        zip: normalized.zip,
        parcelId: normalized.parcelId,
        legalDescription: normalized.legalDescription,
      };

      // Validate row (using normalized data)
      const validation = validateImportRow(normalizedRow);
      if (!validation.valid) {
        errors.push({
          rowIndex: i,
          errors: validation.errors,
        });
        skippedRows.push({
          rowIndex: i,
          reason: "validation_error",
          address: normalized.address || undefined,
        });
        continue;
      }

      // Calculate address hash (using normalized data)
      let addressHash: string;
      try {
        addressHash = calculateAddressHash(orgId, normalized);
      } catch (err: any) {
        errors.push({
          rowIndex: i,
          errors: [err.message || "Failed to calculate addressHash"],
        });
        skippedRows.push({
          rowIndex: i,
          reason: "validation_error",
          address: normalized.address || undefined,
        });
        continue;
      }

      // Check for duplicates within this batch first
      if (batchHashes.has(addressHash)) {
        skippedRows.push({
          rowIndex: i,
          reason: "duplicate_in_file",
          address: normalized.address || undefined,
        });
        continue;
      }

      // Check for duplicates in database
      if (existingHashes.has(addressHash)) {
        skippedRows.push({
          rowIndex: i,
          reason: "duplicate",
          address: normalized.address || undefined,
        });
        continue;
      }

      // Add to batch hashes to prevent duplicates within this batch
      batchHashes.add(addressHash);

      // Prepare lead data (using normalized fields)
      const address = normalized.address;
      const city = normalized.city;
      const state = normalized.state;
      const zip = normalized.zip;

      // Determine if address is partial (missing city, state, or zip)
      // Note: isPartialAddress computation kept for potential future use, but status is not in Prisma schema
      const isPartialAddress = !city || !state || !zip || zip.length < 5;

      // Build notes: include county if present, optionally tag partial addresses
      let notes = row.county ? `County: ${row.county}` : null;
      if (isPartialAddress && notes) {
        notes = `${notes} | importFlag:needs_review`;
      } else if (isPartialAddress) {
        notes = "importFlag:needs_review";
      }

      // Extract and normalize homeownerName and phoneNumber from row aliases
      const rawHomeownerName = row.ownerName || row.homeownerName || row.sellerName || "";
      const rawPhone = row.phone || row.phoneNumber || row.sellerPhone || "";
      const homeownerName = normalizeHomeownerName(rawHomeownerName);
      const phoneNumber = normalizePhone(rawPhone);

      const leadData = {
        orgId,
        type: ((row.type || "sfr").trim().toLowerCase()) as "sfr" | "land" | "multi" | "other",
        address,
        city: city || "Unknown",
        state: state || "XX",
        zip: zip || "00000",
        addressHash,
        source: "import",
        notes,
        homeownerName,
        phoneNumber,
      };

      validLeads.push(leadData);
    }

    // Dedupe before insert: seen = DB hashes + hashes we insert in this upload (prevents 500 on duplicate addresses)
    const seen = new Set<string>(existingHashes);
    let dupInUploadCount = 0;

    // Insert valid leads (one-by-one with seen check so duplicates in upload never hit Prisma)
    if (validLeads.length > 0) {
      if (hasDatabase) {
        const { prisma } = await import("../db/prisma.js");
        for (const lead of validLeads) {
          if (seen.has(lead.addressHash)) {
            skippedRows.push({
              rowIndex: -1,
              reason: "duplicate_in_upload",
              address: lead.address || undefined,
            });
            dupInUploadCount++;
            continue;
          }
          try {
            await prisma.lead.create({ data: lead });
            inserted.push(1);
            seen.add(lead.addressHash);
          } catch (createErr: any) {
            errors.push({
              rowIndex: -1,
              errors: [createErr.message || "Database insert failed"],
            });
          }
        }
      } else {
        // DEV MODE: In-memory import commit (no Prisma)
        if (hasDatabase) {
          throw new Error("DEV PATH CALLED WITH DATABASE_URL SET");
        }
        const orgLeads = getOrgLeads(orgId);
        for (const lead of validLeads) {
          if (seen.has(lead.addressHash)) {
            skippedRows.push({
              rowIndex: -1,
              reason: "duplicate_in_upload",
              address: lead.address || undefined,
            });
            dupInUploadCount++;
            continue;
          }
          orgLeads.push({
            id: crypto.randomUUID(),
            ...lead,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          inserted.push(1);
          seen.add(lead.addressHash);
        }
      }
    }

    if (process.env.NODE_ENV !== "production" && process.env.DEV_DIAGNOSTICS === "1") {
      console.log(`[IMPORT] total=${leads.length} unique_candidates=${validLeads.length} dup_in_upload=${dupInUploadCount}`);
    }

    // Ensure deterministic response structure
    const insertedCount = inserted.reduce((sum, n) => sum + n, 0);
    const failedCount = errors.length;
    const skippedCount = skippedRows.length;

    // Return appropriate status: 200 if any inserts succeeded or all duplicates; 400 if all failed validation
    const response: {
      inserted: number;
      failed: number;
      skipped: number;
      errors: typeof errors;
      skippedRows: typeof skippedRows;
      success: boolean;
      message?: string;
      summary?: { inserted: number; failed: number; skipped: number };
    } = {
      inserted: insertedCount,
      failed: failedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : [],
      skippedRows: skippedRows.length > 0 ? skippedRows : [],
      success: insertedCount > 0,
      summary: { inserted: insertedCount, failed: failedCount, skipped: skippedCount },
    };

    if (insertedCount === 0 && failedCount > 0) {
      // All rows failed validation - return 400
      response.message = "No valid rows to import. All rows failed validation or were duplicates.";
      return res.status(400).json(response);
    }

    if (insertedCount === 0 && failedCount === 0 && skippedCount > 0) {
      // All rows skipped as duplicates - return 200, success=true
      response.success = true;
      response.message = "0 inserted — all duplicates (already imported)";
      return res.json(response);
    }

    // Partial or full success - return 200
    return res.json(response);
  } catch (err: any) {
    // On unexpected errors, still return deterministic structure
    res.status(500).json({
      inserted: 0,
      failed: 0,
      skipped: 0,
      errors: [{ rowIndex: -1, errors: [err.message || "Unknown error"] }],
      skippedRows: [],
    });
  }
});
