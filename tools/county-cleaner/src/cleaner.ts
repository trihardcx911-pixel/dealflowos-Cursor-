/**
 * Main cleaner logic for county-cleaner CLI
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import {
  type CleanedRow,
  type SkippedRow,
  type CleanerOptions,
  type CleanerResult,
} from './types.js';
import {
  createDedupeKey,
  normalizePhone,
  trimString,
  buildHeaderMap,
  extractField,
  extractAddressFromLine,
} from './normalize.js';

/**
 * Process a CSV file and return cleaned rows + skipped rows
 */
export function cleanFile(
  inputPath: string,
  options: CleanerOptions
): CleanerResult {
  const content = fs.readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { cleanedRows: [], skippedRows: [], mergeCount: 0 };
  }

  // Try to detect if file has headers
  const firstLine = lines[0];
  const hasHeaders = detectHeaders(firstLine);

  if (hasHeaders) {
    return processWithHeaders(content, options);
  } else {
    return processHeaderless(lines, options);
  }
}

/**
 * Detect if first line contains headers
 */
function detectHeaders(firstLine: string): boolean {
  const lower = firstLine.toLowerCase();
  // Check for common header keywords
  const headerKeywords = ['address', 'city', 'state', 'zip', 'owner', 'phone', 'name'];
  let matches = 0;
  for (const keyword of headerKeywords) {
    if (lower.includes(keyword)) {
      matches++;
    }
  }
  // If 2+ header keywords found, assume it's a header row
  return matches >= 2;
}

/**
 * Process file with detected headers
 */
function processWithHeaders(
  content: string,
  options: CleanerOptions
): CleanerResult {
  const cleanedRows: CleanedRow[] = [];
  const skippedRows: SkippedRow[] = [];
  let mergeCount = 0;

  // Parse CSV with csv-parse
  let records: string[][];
  try {
    records = parse(content, {
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    });
  } catch (err) {
    console.error('CSV parse error:', err);
    return { cleanedRows: [], skippedRows: [], mergeCount: 0 };
  }

  if (records.length < 2) {
    return { cleanedRows: [], skippedRows: [], mergeCount: 0 };
  }

  // First row is headers
  const headers = records[0];
  const headerMap = buildHeaderMap(headers);
  const dataRows = records.slice(1);

  // Dedupe map: key -> index in cleanedRows
  const dedupeMap = new Map<string, number>();

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + 2; // 1-indexed, +1 for header row
    const values = dataRows[i];
    const rawSample = values.slice(0, 3).join(', ').substring(0, 100);

    try {
      const address = extractField(values, headerMap, 'address');
      const city = extractField(values, headerMap, 'city', options.defaultCity || '');
      const state = extractField(values, headerMap, 'state', options.defaultState || '');
      const zip = extractField(values, headerMap, 'zip');
      const ownerName = trimString(extractField(values, headerMap, 'ownerName'));
      const phone = normalizePhone(extractField(values, headerMap, 'phone'));
      const notes = trimString(extractField(values, headerMap, 'notes'));
      const source = extractField(values, headerMap, 'source', options.source || 'county-cleaner');

      // Skip if no address
      if (!address) {
        skippedRows.push({
          rowIndex,
          rawSample,
          reason: 'no_address',
        });
        continue;
      }

      // Create dedupe key
      const key = createDedupeKey(address, city, state, zip);

      // Check for duplicate
      if (dedupeMap.has(key)) {
        const existingIndex = dedupeMap.get(key)!;
        const existing = cleanedRows[existingIndex];

        // Merge: fill empty fields first, then append to notes
        const mergeNotes: string[] = [];

        if (!existing.ownerName && ownerName) {
          existing.ownerName = ownerName;
        } else if (ownerName && ownerName !== existing.ownerName) {
          mergeNotes.push(`Owner: ${ownerName}`);
        }

        if (!existing.phone && phone) {
          existing.phone = phone;
        } else if (phone && phone !== existing.phone) {
          mergeNotes.push(`Phone: ${phone}`);
        }

        if (notes && notes !== existing.notes) {
          mergeNotes.push(`Notes: ${notes}`);
        }

        if (mergeNotes.length > 0) {
          const mergeText = `Merged from row ${rowIndex}: ${mergeNotes.join('; ')}`;
          existing.notes = existing.notes
            ? `${existing.notes} | ${mergeText}`
            : mergeText;
        }

        mergeCount++;
        continue;
      }

      // New row
      cleanedRows.push({
        address,
        city,
        state,
        zip,
        ownerName,
        phone,
        notes,
        source,
      });
      dedupeMap.set(key, cleanedRows.length - 1);
    } catch (err) {
      skippedRows.push({
        rowIndex,
        rawSample,
        reason: `parse_error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { cleanedRows, skippedRows, mergeCount };
}

/**
 * Process headerless file (best-effort address extraction)
 */
function processHeaderless(
  lines: string[],
  options: CleanerOptions
): CleanerResult {
  const cleanedRows: CleanedRow[] = [];
  const skippedRows: SkippedRow[] = [];
  let mergeCount = 0;

  const dedupeMap = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const rowIndex = i + 1;
    const line = lines[i];
    const rawSample = line.substring(0, 100);

    try {
      const address = extractAddressFromLine(line);

      if (!address) {
        skippedRows.push({
          rowIndex,
          rawSample,
          reason: 'no_address',
        });
        continue;
      }

      const city = options.defaultCity || '';
      const state = options.defaultState || '';
      const zip = '';
      const source = options.source || 'county-cleaner';

      // Create dedupe key
      const key = createDedupeKey(address, city, state, zip);

      if (dedupeMap.has(key)) {
        // Skip duplicate in headerless mode (no additional data to merge)
        mergeCount++;
        continue;
      }

      cleanedRows.push({
        address,
        city,
        state,
        zip,
        ownerName: '',
        phone: '',
        notes: `Raw: ${line.substring(0, 200)}`,
        source,
      });
      dedupeMap.set(key, cleanedRows.length - 1);
    } catch (err) {
      skippedRows.push({
        rowIndex,
        rawSample,
        reason: `parse_error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { cleanedRows, skippedRows, mergeCount };
}
