/**
 * setup-db.js — Run this ONCE to create all PostgreSQL tables.
 * Usage: node setup-db.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});

async function setup() {
  console.log('🔌 Connecting to PostgreSQL...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected!\n');

    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Running schema.sql...');
    await client.query(sql);
    
    console.log('\n✅ Database setup complete!');
    console.log('   Tables created: users, kyc_records');
    console.log('   Seeded: admin@kycportal.com / admin@kyc123');
    console.log('            owner@kycportal.com / owner@kyc123');
    console.log('\n🚀 You can now start the backend: npm run dev\n');

    client.release();
  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    console.error('\nTips:');
    console.error('  1. Make sure your DATABASE_URL in backend/.env is correct');
    console.error('  2. For local PostgreSQL: postgresql://postgres:yourpassword@localhost:5432/vexaro_kyc');
    console.error('  3. Create the database first: CREATE DATABASE vexaro_kyc;');
    process.exit(1);
  }

  await pool.end();
}

setup();
