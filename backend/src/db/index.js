require('dotenv').config();
const { Pool } = require('pg');

function getCleanConnectionString(urlStr) {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    parsed.searchParams.delete('channel_binding');
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

const rawDbUrl = process.env.DATABASE_URL;
const cleanedDbUrl = getCleanConnectionString(rawDbUrl);

const poolConfig = cleanedDbUrl
  ? { connectionString: cleanedDbUrl }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'vexaro_kyc',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    };

const sslConfig = (cleanedDbUrl && !cleanedDbUrl.includes('localhost')) || process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  ...poolConfig,
  ssl: sslConfig,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check your DATABASE_URL in backend/.env');
  } else {
    console.log('✅ Authoritative PostgreSQL database connected successfully');
    release();
  }
});

module.exports = pool;
