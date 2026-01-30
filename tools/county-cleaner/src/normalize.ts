/**
 * Normalization utilities for county-cleaner
 */

import { HEADER_ALIASES, STREET_SUFFIXES, type RawRow } from './types.js';

/**
 * Normalize a string: trim + lowercase + collapse whitespace
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Trim a string, return empty string if null/undefined
 */
export function trimString(str: string | undefined | null): string {
  if (!str) return '';
  return str.trim();
}

/**
 * Normalize phone number: keep digits only, return empty if < 7 digits
 */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits : '';
}

/**
 * Create dedupe key from address components
 */
export function createDedupeKey(
  address: string,
  city: string,
  state: string,
  zip: string
): string {
  return [
    normalizeString(address),
    normalizeString(city),
    normalizeString(state),
    normalizeString(zip),
  ].join('|');
}

/**
 * Map input header to canonical field name
 */
export function mapHeader(inputHeader: string): string | null {
  const trimmed = inputHeader.trim();
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(trimmed)) {
      return canonical;
    }
  }
  return null;
}

/**
 * Build header map from raw headers
 */
export function buildHeaderMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const canonical = mapHeader(header);
    if (canonical && !map.has(canonical)) {
      map.set(canonical, index);
    }
  });
  return map;
}

/**
 * Extract value from row using header map
 */
export function extractField(
  values: string[],
  headerMap: Map<string, number>,
  fieldName: string,
  defaultValue: string = ''
): string {
  const index = headerMap.get(fieldName);
  if (index === undefined || index >= values.length) {
    return defaultValue;
  }
  return trimString(values[index]) || defaultValue;
}

/**
 * Try to extract address from headerless line
 * Returns address if found, null otherwise
 */
export function extractAddressFromLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Check if line contains a street suffix
  const upperLine = trimmed.toUpperCase();
  for (const suffix of STREET_SUFFIXES) {
    // Look for pattern like "123 Main ST" or "123 Main Street"
    const suffixPattern = new RegExp(`\\b${suffix}\\b`, 'i');
    if (suffixPattern.test(upperLine)) {
      // Extract the address portion (everything before comma or end of line)
      const commaIndex = trimmed.indexOf(',');
      if (commaIndex > 0) {
        return trimmed.substring(0, commaIndex).trim();
      }
      // If no comma, use the whole line as address
      return trimmed;
    }
  }

  // Check if line starts with a number (potential address)
  if (/^\d+\s+\w+/.test(trimmed)) {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex > 0) {
      return trimmed.substring(0, commaIndex).trim();
    }
    return trimmed;
  }

  return null;
}

/**
 * Normalize row from raw input to canonical form
 */
export function normalizeRow(
  raw: RawRow,
  headerMap: Map<string, number>,
  values: string[],
  options: { defaultCity?: string; defaultState?: string; source?: string }
): {
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string;
  phone: string;
  notes: string;
  source: string;
} {
  const address = extractField(values, headerMap, 'address');
  const city = extractField(values, headerMap, 'city', options.defaultCity || '');
  const state = extractField(values, headerMap, 'state', options.defaultState || '');
  const zip = extractField(values, headerMap, 'zip');
  const ownerName = extractField(values, headerMap, 'ownerName');
  const phone = normalizePhone(extractField(values, headerMap, 'phone'));
  const notes = extractField(values, headerMap, 'notes');
  const source = extractField(values, headerMap, 'source', options.source || 'county-cleaner');

  return { address, city, state, zip, ownerName, phone, notes, source };
}
