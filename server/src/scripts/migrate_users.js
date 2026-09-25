require('dotenv').config();
const { pool } = require('../models/db');
const logger = require('../utils/logger');

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info('Starting user authentication migration...');
    await client.query('BEGIN');

    // 1. Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name          VARCHAR(100) NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    logger.info('users table verified/created.');

    // 2. Add user_id column to quizzes table
    await client.query(`
      ALTER TABLE quizzes 
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `);
    logger.info('quizzes.user_id column verified/added.');

    // 3. Create index for fast user quiz lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
    `);
    logger.info('idx_quizzes_user_id index verified/created.');

    await client.query('COMMIT');
    logger.info('User authentication migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', { error: err.message });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
