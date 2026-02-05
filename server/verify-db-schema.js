#!/usr/bin/env node
/**
 * Database Schema Verification Script
 *
 * Verifies that the production database schema matches Prisma schema requirements.
 * Run this to diagnose "Auth subsystem unavailable" errors caused by schema mismatches.
 *
 * Usage:
 *   node verify-db-schema.js
 *
 * Or with explicit DATABASE_URL:
 *   DATABASE_URL=postgresql://... node verify-db-schema.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Pool } = pg;

// Expected User table schema (from Prisma schema.prisma)
const EXPECTED_USER_COLUMNS = {
  id: { type: 'text', nullable: false },
  email: { type: 'text', nullable: false },
  firebase_uid: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  plan: { type: 'text', nullable: false },
  trial_ends_at: { type: 'timestamp', nullable: true },
  session_version: { type: 'integer', nullable: true },
  lock_state: { type: 'text', nullable: true },
  lock_expires_at: { type: 'timestamp', nullable: true },
  billingStatus: { type: 'USER-DEFINED', nullable: true }, // Enum type
  cancelAtPeriodEnd: { type: 'boolean', nullable: true },
  currentPeriodEnd: { type: 'timestamp', nullable: true },
  trialEnd: { type: 'timestamp', nullable: true },
  stripeCustomerId: { type: 'text', nullable: true },
  stripeSubscriptionId: { type: 'text', nullable: true },
  stripePriceId: { type: 'text', nullable: true },
  currentPeriodStart: { type: 'timestamp', nullable: true },
  stripeEndedAt: { type: 'timestamp', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

// Required tables
const REQUIRED_TABLES = ['User', 'Lead', 'Deal', 'Task'];

// Optional tables (won't fail if missing, just warn)
const OPTIONAL_TABLES = ['revoked_tokens', 'SecurityEvent', 'SubscriptionCancellationFeedback'];

async function verifySchema() {
  const databaseUrl = process.env.DATABASE_URL;

  console.log('='.repeat(80));
  console.log('DATABASE SCHEMA VERIFICATION');
  console.log('='.repeat(80));
  console.log('');

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL not set in environment');
    console.error('');
    console.error('Set DATABASE_URL in server/.env or pass as env var:');
    console.error('  DATABASE_URL=postgresql://... node verify-db-schema.js');
    process.exit(1);
  }

  // Mask password in URL for logging
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`📊 Database URL: ${maskedUrl}`);
  console.log('');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  let exitCode = 0;

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connection successful');
    console.log('');

    // Check database version
    const versionResult = await pool.query('SELECT version()');
    const versionString = versionResult.rows[0].version;
    console.log(`📦 PostgreSQL Version: ${versionString.split(',')[0]}`);
    console.log('');

    // Get all tables
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const existingTables = tablesResult.rows.map(r => r.tablename);

    console.log('📋 Existing tables:');
    existingTables.forEach(table => {
      console.log(`   - ${table}`);
    });
    console.log('');

    // Check required tables
    console.log('🔍 Checking required tables...');
    let missingTables = [];
    for (const table of REQUIRED_TABLES) {
      const exists = existingTables.includes(table);
      if (exists) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING`);
        missingTables.push(table);
        exitCode = 1;
      }
    }
    console.log('');

    // Check optional tables
    console.log('🔍 Checking optional tables...');
    for (const table of OPTIONAL_TABLES) {
      const exists = existingTables.includes(table);
      if (exists) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ⚠️  ${table} - Missing (optional, auth may skip this table)`);
      }
    }
    console.log('');

    // If User table exists, check columns
    if (existingTables.includes('User')) {
      console.log('🔍 Checking User table schema...');

      const columnsResult = await pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User'
        ORDER BY ordinal_position
      `);

      const actualColumns = {};
      columnsResult.rows.forEach(row => {
        actualColumns[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
        };
      });

      console.log('');
      console.log('   Column verification:');
      let missingColumns = [];
      let typeMismatches = [];

      for (const [columnName, expected] of Object.entries(EXPECTED_USER_COLUMNS)) {
        const actual = actualColumns[columnName];

        if (!actual) {
          console.log(`   ❌ ${columnName} - MISSING`);
          missingColumns.push(columnName);
          exitCode = 1;
        } else {
          // Type comparison (normalize types)
          const actualType = normalizeType(actual.type);
          const expectedType = normalizeType(expected.type);
          const typeMatches = actualType === expectedType ||
                             (expectedType === 'timestamp' && actualType.includes('timestamp')) ||
                             (expectedType === 'USER-DEFINED' && actualType === 'USER-DEFINED');

          if (!typeMatches) {
            console.log(`   ⚠️  ${columnName} - Type mismatch (expected: ${expected.type}, got: ${actual.type})`);
            typeMismatches.push({ column: columnName, expected: expected.type, actual: actual.type });
          } else {
            console.log(`   ✅ ${columnName} (${actual.type})`);
          }
        }
      }

      // Check for extra columns (not necessarily a problem)
      const extraColumns = Object.keys(actualColumns).filter(
        col => !EXPECTED_USER_COLUMNS[col]
      );
      if (extraColumns.length > 0) {
        console.log('');
        console.log('   Extra columns (not in expected schema):');
        extraColumns.forEach(col => {
          console.log(`   ℹ️  ${col} (${actualColumns[col].type})`);
        });
      }

      console.log('');
      if (missingColumns.length > 0 || typeMismatches.length > 0) {
        console.log('❌ User table schema issues found');
        if (missingColumns.length > 0) {
          console.log(`   Missing columns: ${missingColumns.join(', ')}`);
        }
        if (typeMismatches.length > 0) {
          console.log(`   Type mismatches: ${typeMismatches.map(m => m.column).join(', ')}`);
        }
        exitCode = 1;
      } else {
        console.log('✅ User table schema looks good');
      }
    }

    console.log('');
    console.log('='.repeat(80));

    if (exitCode === 0) {
      console.log('✅ SCHEMA VERIFICATION PASSED');
      console.log('');
      console.log('Database schema matches expected structure.');
      console.log('If you\'re still seeing "Auth subsystem unavailable", check:');
      console.log('  1. Database connection/credentials');
      console.log('  2. Network connectivity to database');
      console.log('  3. Server logs for diagnostic output (added in requireAuth.ts)');
    } else {
      console.log('❌ SCHEMA VERIFICATION FAILED');
      console.log('');
      console.log('Issues found. To fix:');
      console.log('  1. Run migrations: cd server && npx prisma migrate deploy');
      console.log('  2. Or generate and push: cd server && npx prisma db push');
      console.log('  3. Verify DATABASE_URL points to correct database');
    }

    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR during schema verification:');
    console.error('');
    console.error('Message:', error.message);
    console.error('Code:', error.code);

    if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('Database connection refused. Check:');
      console.error('  1. DATABASE_URL host and port are correct');
      console.error('  2. Database server is running');
      console.error('  3. Firewall/network allows connection');
    } else if (error.code === '28P01') {
      console.error('');
      console.error('Authentication failed. Check:');
      console.error('  1. DATABASE_URL username is correct');
      console.error('  2. DATABASE_URL password is correct');
      console.error('  3. User has access to the database');
    } else if (error.code === '3D000') {
      console.error('');
      console.error('Database does not exist. Check:');
      console.error('  1. DATABASE_URL database name is correct');
      console.error('  2. Database was created (createdb <dbname>)');
    }

    console.error('');
    exitCode = 1;
  } finally {
    await pool.end();
  }

  process.exit(exitCode);
}

function normalizeType(type) {
  const normalized = type.toLowerCase();
  if (normalized.includes('timestamp')) return 'timestamp';
  if (normalized.includes('character varying') || normalized === 'varchar') return 'text';
  if (normalized === 'user-defined') return 'USER-DEFINED';
  return normalized;
}

// Run verification
verifySchema().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
