# County Cleaner (Option A)

A standalone CLI tool to clean messy county lists into DFOS-importable CSV files.

## What This Tool Does

Converts raw county data exports (CSV files) into a clean, deduplicated format that DFOS Leads Import can understand. The tool:

- Parses CSV files with various header formats
- Maps common header variants to DFOS-standard fields
- Normalizes phone numbers (digits only, min 7 digits)
- Deduplicates by address (address + city + state + zip)
- Merges data from duplicate rows into Notes
- Reports skipped/invalid rows

## Installation

```bash
cd tools/county-cleaner
npm install
```

## Usage

```bash
npm run clean -- --in <input_file> --out <output_file> [options]
```

### Required Arguments

| Argument | Description |
|----------|-------------|
| `--in <path>` | Input CSV file path |
| `--out <path>` | Output CSV file path |

### Optional Arguments

| Argument | Description |
|----------|-------------|
| `--default-city <x>` | Default city for rows missing city |
| `--default-state <x>` | Default state for rows missing state |
| `--source <x>` | Source value for all rows (default: "county-cleaner") |
| `--skip-report` | Don't generate skipped_rows report |

## Examples

### Basic CSV Cleaning

```bash
npm run clean -- --in raw_county_list.csv --out cleaned_leads.csv
```

### With Default City/State

Useful for headerless lists or files missing location data:

```bash
npm run clean -- \
  --in violation_list.csv \
  --out austin_violations.csv \
  --default-city Austin \
  --default-state TX \
  --source "Code Violations 2024"
```

### Skip Report Generation

```bash
npm run clean -- --in data.csv --out leads.csv --skip-report
```

## Output Format

The output CSV has DFOS-compatible headers:

```
Address,City,State,Zip,Owner Name,Phone,Notes,Source
```

## Input Header Mapping

The tool recognizes these common header variants:

| DFOS Field | Accepted Headers |
|------------|------------------|
| Address | Address, Property Address, street, Street |
| City | City, Town |
| State | State, ST |
| Zip | Zip, ZIP, Postal, Postal Code |
| Owner Name | Owner Name, ownerName, homeowner_name, Homeowner, Owner |
| Phone | Phone, phoneNumber, sellerPhone, Phone #, Contact Phone |
| Notes | Notes, County, Violation, Reason |
| Source | Source |

## Deduplication Behavior

When duplicate addresses are found:

1. The **first occurrence** is kept
2. Empty fields are filled from duplicates (e.g., if first row has no phone but duplicate does)
3. Differing data is appended to Notes: `Merged from row N: Owner: X; Phone: Y`

## Using Output with DFOS

1. Run the cleaner on your raw county data
2. Go to DFOS Leads page
3. Click "Import" and upload the output CSV
4. Preview should show Owner Name + Phone columns populated
5. Click "Confirm import" to persist the leads

## Skipped Rows Report

Unless `--skip-report` is used, a `<output>_skipped_rows.csv` file is created with:

| Column | Description |
|--------|-------------|
| rowIndex | Original row number in input file |
| rawSample | First 100 chars of the raw row |
| reason | Why the row was skipped (e.g., `no_address`, `parse_error`) |

## Limitations

- XLSX support is not implemented; export to CSV first
- Headerless files use best-effort address detection (looks for street suffixes like ST, AVE, DR)
- Phone validation is minimal (just checks for 7+ digits)
