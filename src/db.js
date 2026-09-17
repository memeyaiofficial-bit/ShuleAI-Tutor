const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:6543/shule_tutor';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function testConnection() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0].now;
}

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params),
};
