require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../models/db');

async function migrate() {
  const sqlFile = path.join(__dirname, '../../../database/migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    console.log('Running database migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
