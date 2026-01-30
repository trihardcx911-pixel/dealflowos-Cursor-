/**
 * CSV writers for county-cleaner output
 */

import fs from 'fs';
import path from 'path';
import { type CleanedRow, type SkippedRow, OUTPUT_HEADERS } from './types.js';

/**
 * Escape a field for CSV output
 */
function escapeCSVField(value: string): string {
  if (!value) return '';
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Write cleaned rows to CSV file with DFOS-compatible headers
 */
export function writeCleanedCSV(rows: CleanedRow[], outputPath: string): void {
  const lines: string[] = [];

  // Header row
  lines.push(OUTPUT_HEADERS.join(','));

  // Data rows
  for (const row of rows) {
    const fields = [
      escapeCSVField(row.address),
      escapeCSVField(row.city),
      escapeCSVField(row.state),
      escapeCSVField(row.zip),
      escapeCSVField(row.ownerName),
      escapeCSVField(row.phone),
      escapeCSVField(row.notes),
      escapeCSVField(row.source),
    ];
    lines.push(fields.join(','));
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Write skipped rows report to CSV file
 */
export function writeSkippedCSV(rows: SkippedRow[], outputPath: string): void {
  const lines: string[] = [];

  // Header row
  lines.push('rowIndex,rawSample,reason');

  // Data rows
  for (const row of rows) {
    const fields = [
      String(row.rowIndex),
      escapeCSVField(row.rawSample),
      escapeCSVField(row.reason),
    ];
    lines.push(fields.join(','));
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Generate skipped rows output path from main output path
 */
export function getSkippedOutputPath(outputPath: string): string {
  const dir = path.dirname(outputPath);
  const ext = path.extname(outputPath);
  const base = path.basename(outputPath, ext);
  return path.join(dir, `${base}_skipped_rows${ext}`);
}
