require('dotenv').config();
const { pool } = require('../models/db');

async function fix() {
  try {
    console.log('Querying constraints on participants table...');
    const res = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      WHERE conrelid = 'participants'::regclass;
    `);
    console.log('Current constraints:', res.rows);

    // Drop global unique constraint on session_id if it exists
    await pool.query(`
      ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_session_id_key;
    `);
    console.log('Dropped participants_session_id_key');

    // Add compound unique constraint (quiz_id, session_id) so same session can join multiple quizzes
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'participants_quiz_id_session_id_key'
        ) THEN
          ALTER TABLE participants ADD CONSTRAINT participants_quiz_id_session_id_key UNIQUE (quiz_id, session_id);
        END IF;
      END $$;
    `);
    console.log('Added compound UNIQUE (quiz_id, session_id)');

    const updated = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      WHERE conrelid = 'participants'::regclass;
    `);
    console.log('Updated constraints:', updated.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fix();
