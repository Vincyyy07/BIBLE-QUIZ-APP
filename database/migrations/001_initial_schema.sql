-- ============================================================
-- Bible Quiz Platform — Initial Database Schema
-- Run: psql -d biblequiz -f 001_initial_schema.sql
-- ============================================================

-- Users table (Hosts)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code                    VARCHAR(10) UNIQUE NOT NULL,
  title                   VARCHAR(255) NOT NULL,
  description             TEXT,
  status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- status: DRAFT | WAITING | LIVE | QUESTION_ENDED | COMPLETED
  current_question_index  INTEGER DEFAULT 0,
  host_token_hash         VARCHAR(255) NOT NULL,
  host_token              VARCHAR(500) NOT NULL,  -- plain JWT for host to retrieve
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id               SERIAL PRIMARY KEY,
  quiz_id          INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_number  INTEGER NOT NULL,
  question_text    TEXT NOT NULL,
  option_a         TEXT NOT NULL,
  option_b         TEXT NOT NULL,
  option_c         TEXT NOT NULL,
  option_d         TEXT NOT NULL,
  correct_answer   CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  duration_seconds INTEGER NOT NULL DEFAULT 20 CHECK (duration_seconds >= 5 AND duration_seconds <= 300),
  points           INTEGER NOT NULL DEFAULT 10 CHECK (points > 0),
  started_at       TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  UNIQUE(quiz_id, question_number)
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  id            SERIAL PRIMARY KEY,
  quiz_id       INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  session_id    VARCHAR(64) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  connected     BOOLEAN DEFAULT TRUE,
  UNIQUE(quiz_id, session_id)
);

-- Answers table
-- One row per (question, participant) — UNIQUE enforces no duplicate answers
CREATE TABLE IF NOT EXISTS answers (
  id               SERIAL PRIMARY KEY,
  quiz_id          INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id      INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  participant_id   INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  selected_answer  CHAR(1) CHECK (selected_answer IN ('A','B','C','D')),
  is_correct       BOOLEAN,
  points_awarded   INTEGER DEFAULT 0,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, participant_id)
);

-- Scores table — updated after each question ends
-- Tie-breaking documented:
--   1. Higher total_score wins
--   2. If tied: higher correct_answers wins
--   3. If still tied: earlier last_correct_at wins (faster overall correct answers)
CREATE TABLE IF NOT EXISTS scores (
  id                  SERIAL PRIMARY KEY,
  quiz_id             INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  participant_id      INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  total_score         INTEGER DEFAULT 0,
  correct_answers     INTEGER DEFAULT 0,
  total_time_seconds  NUMERIC DEFAULT 0,
  accuracy_percent    NUMERIC DEFAULT 0,
  last_correct_at     TIMESTAMPTZ,
  previous_rank       INTEGER,
  rank                INTEGER,
  UNIQUE(quiz_id, participant_id)
);

-- ============================================================
-- Indexes for performance with 200 concurrent participants
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_quizzes_code
  ON quizzes(code);

CREATE INDEX IF NOT EXISTS idx_quizzes_status
  ON quizzes(status);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id
  ON questions(quiz_id);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_number
  ON questions(quiz_id, question_number);

CREATE INDEX IF NOT EXISTS idx_participants_quiz_id
  ON participants(quiz_id);

CREATE INDEX IF NOT EXISTS idx_participants_session_id
  ON participants(session_id);

CREATE INDEX IF NOT EXISTS idx_participants_quiz_session
  ON participants(quiz_id, session_id);

CREATE INDEX IF NOT EXISTS idx_answers_question_id
  ON answers(question_id);

CREATE INDEX IF NOT EXISTS idx_answers_participant_id
  ON answers(participant_id);

CREATE INDEX IF NOT EXISTS idx_answers_quiz_question
  ON answers(quiz_id, question_id);

CREATE INDEX IF NOT EXISTS idx_answers_question_participant
  ON answers(question_id, participant_id);

CREATE INDEX IF NOT EXISTS idx_scores_quiz_id
  ON scores(quiz_id);

CREATE INDEX IF NOT EXISTS idx_scores_quiz_rank
  ON scores(quiz_id, rank);

-- ============================================================
-- Done
-- ============================================================
