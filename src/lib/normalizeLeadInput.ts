/**
 * Lead Input Normalization Pipeline
 * Cleans and standardizes lead data before saving
 */

export interface RawLeadInput {
  address?: string;
  city?: string;
  state?: string;
  zip?: string | number;
  source?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  arv?: number | string | null;
  estimatedRepairs?: number | string | null;
  investorMultiplier?: number | string;
  desiredAssignmentFee?: number | string;
  offerPrice?: number | string | null;
  propertyType?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  squareFeet?: number | string;
  yearBuilt?: number | string;
  lotSize?: number | string;
}

export interface NormalizedLeadInput {
  address: string;
  city: string;
  state: string;
  zip: string;
  source?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  arv?: number | null;
  estimatedRepairs?: number | null;
  investorMultiplier?: number;
  desiredAssignmentFee?: number;
  offerPrice?: number | null;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  lotSize?: number;
}

/**
 * Main normalization function
 */
export function normalizeLeadInput(input: RawLeadInput): NormalizedLeadInput {
  return {
    address: cleanAddress(input.address || ""),
    city: cleanCity(input.city || ""),
    state: normalizeState(input.state || ""),
    zip: normalizeZip(input.zip),
    source: input.source ?? "other", // Ensure always present
    sellerName: cleanName(input.sellerName),
    sellerPhone: normalizePhone(input.sellerPhone),
    sellerEmail: normalizeEmail(input.sellerEmail),
    arv: toNullableNumber(input.arv),
    estimatedRepairs: toNullableNumber(input.estimatedRepairs),
    investorMultiplier: toNumber(input.investorMultiplier, 0.70),
    desiredAssignmentFee: toNumber(input.desiredAssignmentFee, 10000),
    offerPrice: toNullableNumber(input.offerPrice),
    propertyType: input.propertyType?.toLowerCase().trim(),
    bedrooms: toInteger(input.bedrooms),
    bathrooms: toNumber(input.bathrooms),
    squareFeet: toInteger(input.squareFeet),
    yearBuilt: toInteger(input.yearBuilt),
    lotSize: toInteger(input.lotSize),
  };
}

/**
 * Clean and standardize address
 */
export function cleanAddress(address: string): string {
  return address
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/,+/g, ",") // Remove duplicate commas
    .replace(/\s*,\s*/g, ", ") // Normalize comma spacing
    .replace(/\b(street|st\.?)\b/gi, "St")
    .replace(/\b(avenue|ave\.?)\b/gi, "Ave")
    .replace(/\b(boulevard|blvd\.?)\b/gi, "Blvd")
    .replace(/\b(drive|dr\.?)\b/gi, "Dr")
    .replace(/\b(road|rd\.?)\b/gi, "Rd")
    .replace(/\b(lane|ln\.?)\b/gi, "Ln")
    .replace(/\b(court|ct\.?)\b/gi, "Ct")
    .replace(/\b(circle|cir\.?)\b/gi, "Cir")
    .replace(/\b(place|pl\.?)\b/gi, "Pl")
    .replace(/\b(highway|hwy\.?)\b/gi, "Hwy")
    .replace(/\b(apartment|apt\.?)\s*#?\s*/gi, "Apt ")
    .replace(/\b(suite|ste\.?)\s*#?\s*/gi, "Ste ")
    .replace(/\b(unit)\s*#?\s*/gi, "Unit ");
}

/**
 * Clean city name
 */
export function cleanCity(city: string): string {
  return city
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalize state to 2-letter uppercase abbreviation
 */
export function normalizeState(state: string): string {
  const cleaned = state.trim().toUpperCase();
  
  // Already 2-letter abbreviation
  if (cleaned.length === 2) return cleaned;
  
  // State name to abbreviation mapping
  const stateMap: Record<string, string> = {
    ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR",
    CALIFORNIA: "CA", COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE",
    FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID",
    ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA", KANSAS: "KS",
    KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
    MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
    MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
    "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
    "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK",
    OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT",
    VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV",
    WISCONSIN: "WI", WYOMING: "WY", "DISTRICT OF COLUMBIA": "DC",
  };
  
  return stateMap[cleaned] || cleaned.slice(0, 2);
}

/**
 * Normalize ZIP code to 5 or 9 digit format
 */
export function normalizeZip(zip: string | number | undefined): string {
  if (!zip) return "";
  
  // Convert to string and remove non-digits except dash
  const cleaned = String(zip).replace(/[^\d-]/g, "");
  
  // Handle ZIP+4 format
  if (cleaned.includes("-")) {
    const [main, ext] = cleaned.split("-");
    return `${main.padStart(5, "0")}-${ext}`;
  }
  
  // Pad to 5 digits
  return cleaned.padStart(5, "0").slice(0, 5);
}

/**
 * Normalize phone number to consistent format
 */
export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  // Handle different lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if can't normalize
  return phone.trim();
}

/**
 * Normalize email address
 */
export function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return email.trim().toLowerCase();
}

/**
 * Clean person name
 */
export function cleanName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Convert to number or null
 */
function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : value;
  return isNaN(num) ? null : num;
}

/**
 * Convert to number with default
 */
function toNumber(value: string | number | undefined, defaultValue?: number): number | undefined {
  if (value === undefined || value === "") return defaultValue;
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : value;
  return isNaN(num) ? defaultValue : num;
}

/**
 * Convert to integer
 */
function toInteger(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const num = typeof value === "string" ? parseInt(value.replace(/[^0-9-]/g, ""), 10) : Math.round(value);
  return isNaN(num) ? undefined : num;
}





