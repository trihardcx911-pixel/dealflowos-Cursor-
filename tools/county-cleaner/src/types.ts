/**
 * Types for county-cleaner CLI tool
 */

export interface RawRow {
  [key: string]: string | undefined;
}

export interface CleanedRow {
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string;
  phone: string;
  notes: string;
  source: string;
}

export interface SkippedRow {
  rowIndex: number;
  rawSample: string;
  reason: string;
}

export interface CleanerOptions {
  defaultCity?: string;
  defaultState?: string;
  source?: string;
}

export interface CleanerResult {
  cleanedRows: CleanedRow[];
  skippedRows: SkippedRow[];
  mergeCount: number;
}

export interface CLIArgs {
  inPath: string;
  outPath: string;
  defaultCity?: string;
  defaultState?: string;
  source: string;
  skipReport: boolean;
}

// DFOS-compatible output headers (exact match required)
export const OUTPUT_HEADERS = [
  'Address',
  'City',
  'State',
  'Zip',
  'Owner Name',
  'Phone',
  'Notes',
  'Source',
] as const;

// Header alias map for input parsing
export const HEADER_ALIASES: Record<string, string[]> = {
  address: ['Address', 'address', 'Property Address', 'street', 'Street', 'STREET', 'ADDRESS'],
  city: ['City', 'city', 'Town', 'CITY', 'TOWN'],
  state: ['State', 'state', 'ST', 'STATE'],
  zip: ['Zip', 'zip', 'ZIP', 'Postal', 'Postal Code', 'POSTAL', 'ZIPCODE', 'Zip Code'],
  ownerName: ['Owner Name', 'ownerName', 'homeowner_name', 'Homeowner', 'Owner', 'OWNER', 'OWNER NAME', 'HomeOwner Name'],
  phone: ['Phone', 'phone', 'phoneNumber', 'sellerPhone', 'Phone #', 'Contact Phone', 'PHONE', 'PHONE NUMBER', 'Phone Number'],
  notes: ['Notes', 'notes', 'County', 'county', 'Violation', 'violation', 'Reason', 'NOTES', 'COUNTY'],
  source: ['Source', 'source', 'SOURCE'],
};

// Street suffixes for headerless parsing
export const STREET_SUFFIXES = [
  'ST', 'AVE', 'DR', 'RD', 'BLVD', 'LN', 'CT', 'PL', 'WAY', 'CIR',
  'TRL', 'PKWY', 'HWY', 'TER', 'LOOP', 'SQ', 'PASS', 'COVE', 'CV',
];
