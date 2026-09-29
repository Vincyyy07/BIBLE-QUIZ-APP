require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 35,                    // max connections — handles 250+ concurrent participants comfortably
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.debug('New database client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

// Helper: run a parameterised query (prevents SQL injection)
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    logger.debug('DB query', { duration: Date.now() - start, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('DB query error', { query: text, error: err.message });
    throw err;
  }
};

// Helper: get a single client from the pool for transactions
const getClient = () => pool.connect();

// Auto-verify and migrate database columns on startup
const initDb = async () => {
  try {
    await pool.query(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS response_time_seconds NUMERIC DEFAULT 0;`);
    logger.info('Database schema verified: answers.response_time_seconds ensured.');
  } catch (err) {
    logger.warn('Database schema verification note:', { error: err.message });
  }
};

initDb();

module.exports = { query, getClient, pool, initDb };

