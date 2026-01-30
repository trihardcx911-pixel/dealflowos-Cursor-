#!/usr/bin/env node
/**
 * county-cleaner CLI
 *
 * Converts messy county lists into DFOS-importable CSV
 *
 * Usage:
 *   npm run clean -- --in <path> --out <path> [options]
 */

import fs from 'fs';
import path from 'path';
import { cleanFile } from './cleaner.js';
import { writeCleanedCSV, writeSkippedCSV, getSkippedOutputPath } from './writers.js';
import type { CLIArgs } from './types.js';

function printUsage(): void {
  console.log(`
county-cleaner - Clean messy county lists for DFOS Leads Import

Usage:
  npm run clean -- --in <input_file> --out <output_file> [options]

Required:
  --in <path>           Input CSV file path
  --out <path>          Output CSV file path

Options:
  --default-city <x>    Default city for rows missing city
  --default-state <x>   Default state for rows missing state
  --source <x>          Source value for all rows (default: "county-cleaner")
  --skip-report         Don't generate skipped_rows report

Examples:
  npm run clean -- --in raw_list.csv --out cleaned.csv
  npm run clean -- --in data.csv --out leads.csv --default-city Austin --default-state TX
  npm run clean -- --in messy.csv --out clean.csv --source "County Tax List 2024"
`);
}

function parseArgs(args: string[]): CLIArgs | null {
  const result: Partial<CLIArgs> = {
    source: 'county-cleaner',
    skipReport: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--in':
        if (!nextArg) {
          console.error('Error: --in requires a file path');
          return null;
        }
        result.inPath = nextArg;
        i++;
        break;

      case '--out':
        if (!nextArg) {
          console.error('Error: --out requires a file path');
          return null;
        }
        result.outPath = nextArg;
        i++;
        break;

      case '--default-city':
        if (!nextArg) {
          console.error('Error: --default-city requires a value');
          return null;
        }
        result.defaultCity = nextArg;
        i++;
        break;

      case '--default-state':
        if (!nextArg) {
          console.error('Error: --default-state requires a value');
          return null;
        }
        result.defaultState = nextArg;
        i++;
        break;

      case '--source':
        if (!nextArg) {
          console.error('Error: --source requires a value');
          return null;
        }
        result.source = nextArg;
        i++;
        break;

      case '--skip-report':
        result.skipReport = true;
        break;

      case '--help':
      case '-h':
        printUsage();
        process.exit(0);

      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option: ${arg}`);
          return null;
        }
    }
  }

  // Validate required args
  if (!result.inPath) {
    console.error('Error: --in is required');
    return null;
  }
  if (!result.outPath) {
    console.error('Error: --out is required');
    return null;
  }

  return result as CLIArgs;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const cliArgs = parseArgs(args);
  if (!cliArgs) {
    process.exit(1);
  }

  // Validate input file exists
  if (!fs.existsSync(cliArgs.inPath)) {
    console.error(`Error: Input file not found: ${cliArgs.inPath}`);
    process.exit(1);
  }

  // Ensure output directory exists
  const outDir = path.dirname(cliArgs.outPath);
  if (outDir && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\nProcessing: ${cliArgs.inPath}`);
  console.log(`Output: ${cliArgs.outPath}`);
  if (cliArgs.defaultCity) console.log(`Default city: ${cliArgs.defaultCity}`);
  if (cliArgs.defaultState) console.log(`Default state: ${cliArgs.defaultState}`);
  console.log(`Source: ${cliArgs.source}`);
  console.log('');

  // Process file
  const result = cleanFile(cliArgs.inPath, {
    defaultCity: cliArgs.defaultCity,
    defaultState: cliArgs.defaultState,
    source: cliArgs.source,
  });

  // Write output
  writeCleanedCSV(result.cleanedRows, cliArgs.outPath);
  console.log(`Cleaned rows: ${result.cleanedRows.length}`);
  console.log(`Merged duplicates: ${result.mergeCount}`);
  console.log(`Skipped rows: ${result.skippedRows.length}`);

  // Write skipped report if not disabled
  if (!cliArgs.skipReport && result.skippedRows.length > 0) {
    const skippedPath = getSkippedOutputPath(cliArgs.outPath);
    writeSkippedCSV(result.skippedRows, skippedPath);
    console.log(`Skipped report: ${skippedPath}`);
  }

  console.log('\nDone! Upload the output CSV to DFOS Leads Import.');
}

main();
