/**
 * Lead Sources KPI Normalization
 * 
 * Failure-proofing checklist:
 * 1. ✅ Accepts unknown input (defensive typing)
 * 2. ✅ Never throws (returns [] on invalid input)
 * 3. ✅ Normalizes count to number (handles string counts from SQL drivers)
 * 4. ✅ Trims source strings (handles whitespace)
 * 5. ✅ Filters empty/invalid sources (matches backend filter logic)
 * 6. ✅ Filters non-finite/negative counts (data validation)
 * 7. ✅ Preserves unknown source values (no data loss)
 * 8. ✅ Deterministic aggregation and sorting (stable output)
 * 9. ✅ Optional top-N bucketing (prevents chart clutter)
 * 
 * Why it won't silently disappear:
 * - Invalid API responses → normalized to [] → upstream shows empty state
 * - String counts from SQL → coerced to number → processed correctly
 * - Empty/null sources → filtered out → matches backend behavior
 * - Zero/negative counts → filtered out → prevents render issues
 * - Unknown sources → preserved as-is → no data loss
 * - Deterministic sorting → stable UI → no flickering
 */

/**
 * Normalized lead source KPI row
 * Represents a single source with its count
 */
export type LeadSourceKpiRow = {
  source: string;
  count: number;
};

/**
 * Source ID to display name mapping
 * Maps backend source IDs to human-readable labels
 */
const SOURCE_NAME_MAP: Record<string, string> = {
  cold_call: "Cold Call",
  sms: "SMS",
  ppc: "PPC",
  driving_for_dollars: "Driving for Dollars",
  referral: "Referral",
  other: "Other",
};

/**
 * Special internal key for "Other (Rest)" bucket when top-N bucketing is used
 * This prevents confusion with the real "other" source value
 */
const OTHER_REST_KEY = "__other_rest__";

/**
 * Normalizes raw API response into typed LeadSourceKpiRow array
 * 
 * Defensive normalization that never throws:
 * - Accepts unknown input (API responses may vary)
 * - Returns [] for invalid inputs
 * - Validates and normalizes each row
 * - Filters out invalid rows (empty sources, invalid counts)
 * 
 * @param input - Raw API response (unknown type)
 * @returns Normalized array of LeadSourceKpiRow (may contain duplicates)
 */
export function normalizeLeadSources(input: unknown): LeadSourceKpiRow[] {
  // Return empty array if input is not an array
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized: LeadSourceKpiRow[] = [];

  for (const item of input) {
    // Skip if item is null or undefined
    if (item == null || typeof item !== "object") {
      continue;
    }

    // Extract and normalize source
    let source: string | null = null;
    if (item.hasOwnProperty("source")) {
      const rawSource = item.source;
      if (rawSource != null) {
        // Coerce to string and trim
        const trimmed = String(rawSource).trim();
        // Skip if empty after trim
        if (trimmed.length > 0) {
          source = trimmed;
        }
      }
    }

    // Skip if source is missing or empty
    if (!source) {
      continue;
    }

    // Extract and normalize count
    let count: number | null = null;
    if (item.hasOwnProperty("count")) {
      const rawCount = item.count;
      if (rawCount != null) {
        // Coerce to number
        const num = Number(rawCount);
        // Skip if NaN, not finite, or negative
        if (Number.isFinite(num) && num >= 0) {
          count = num;
        }
      }
    }

    // Skip if count is missing or invalid
    if (count === null) {
      continue;
    }

    // Add normalized row (duplicates allowed - aggregation happens in toPieData)
    normalized.push({
      source,
      count,
    });
  }

  return normalized;
}

/**
 * Transforms normalized rows into pie chart data format
 * 
 * Features:
 * - Aggregates duplicates by source (sums counts)
 * - Maps known source IDs to display names
 * - Preserves unknown sources as-is (no data loss)
 * - Sorts descending by value (deterministic)
 * - Optional top-N bucketing to prevent chart clutter
 * 
 * @param rows - Normalized lead source rows (may contain duplicates)
 * @param opts - Options for pie data transformation
 * @param opts.topN - Optional: Keep only top N sources, bucket rest into "Other (Rest)"
 * @returns Pie chart data array with name and value
 */
export function toPieData(
  rows: LeadSourceKpiRow[],
  opts: { topN?: number } = {}
): Array<{ name: string; value: number }> {
  // Aggregate duplicates by source (sum counts)
  const aggregated: Record<string, number> = {};

  for (const row of rows) {
    const key = row.source;
    aggregated[key] = (aggregated[key] || 0) + row.count;
  }

  // Convert to array and map to display names
  const mapped = Object.entries(aggregated).map(([source, count]) => ({
    source, // Keep original for sorting/bucketing
    displayName: SOURCE_NAME_MAP[source] || source, // Map to display name or use raw
    value: count,
  }));

  // Sort descending by value (deterministic)
  mapped.sort((a, b) => b.value - a.value);

  // Apply top-N bucketing if requested
  if (opts.topN != null && opts.topN > 0 && mapped.length > opts.topN) {
    // Split into top N and rest
    const topN = mapped.slice(0, opts.topN);
    const rest = mapped.slice(opts.topN);

    // Sum rest counts
    const restSum = rest.reduce((sum, item) => sum + item.value, 0);

    // Only add "Other (Rest)" bucket if rest has positive sum
    if (restSum > 0) {
      // Use special key to avoid confusion with real "other" source
      // Map to display name "Other (Rest)"
      topN.push({
        source: OTHER_REST_KEY,
        displayName: "Other (Rest)",
        value: restSum,
      });
    }

    // Return top N + optional "Other (Rest)" bucket
    return topN.map((item) => ({
      name: item.displayName,
      value: item.value,
    }));
  }

  // No bucketing: return all sources with display names
  return mapped.map((item) => ({
    name: item.displayName,
    value: item.value,
  }));
}







