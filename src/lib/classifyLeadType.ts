// Very literal: classify a row into land | multi | sfr with traceable signals.
export type LeadType = "land" | "multi" | "sfr" | "other";

export type RawLead = {
  building_sqft?: number | null;
  improvement_value?: number | null;
  land_use?: string | null; // e.g., "VACANT RES", "AG", "RAW LAND"
  units?: number | null;
};

export function classifyLeadType(input: RawLead): {
  type: LeadType;
  signals: Array<{ rule: string; field: string; value: unknown; source: "batch" }>;
} {
  const signals: Array<{ rule: string; field: string; value: unknown; source: "batch" }> = [];
  const landUse = (input.land_use || "").toUpperCase();

  // Rule 1: no building + no improvement value → LAND
  const noBldg = (input.building_sqft ?? 0) === 0;
  const noImprove = (input.improvement_value ?? 0) === 0;
  if (noBldg && noImprove) {
    signals.push({ rule: "no_bldg_and_no_improvement", field: "building_sqft/improvement_value", value: `${input.building_sqft}/${input.improvement_value}`, source: "batch" });
    return { type: "land", signals };
  }

  // Rule 2: land-use keywords → LAND
  const landKeywords = ["VACANT", "AG", "RES VAC", "RAW LAND", "AGRICULTURE", "RURAL", "UNDEVELOPED"];
  if (landKeywords.some(k => landUse.includes(k))) {
    signals.push({ rule: "land_use_keyword", field: "land_use", value: input.land_use, source: "batch" });
    return { type: "land", signals };
  }

  // Rule 3: units > 1 → MULTI
  if ((input.units ?? 1) > 1) {
    signals.push({ rule: "units_gt_1", field: "units", value: input.units, source: "batch" });
    return { type: "multi", signals };
  }

  // Default → SFR
  signals.push({ rule: "default_sfr", field: "units", value: input.units ?? 1, source: "batch" });
  return { type: "sfr", signals };
}
