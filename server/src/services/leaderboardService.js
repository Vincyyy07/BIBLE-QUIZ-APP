const { query } = require('../models/db');

/**
 * Get full leaderboard for a quiz (for host and final projector screen)
 */
const getFullLeaderboard = async (quizId) => {
  const res = await query(
    `SELECT s.rank, s.previous_rank, s.total_score, s.correct_answers, s.total_time_seconds, s.accuracy_percent, p.name, p.session_id,
       CASE
         WHEN s.previous_rank IS NULL THEN 0
         ELSE (s.previous_rank - s.rank)
       END AS rank_change
     FROM scores s
     JOIN participants p ON p.id = s.participant_id
     WHERE s.quiz_id = $1
     ORDER BY s.rank ASC`,
    [quizId]
  );
  return res.rows;
};

/**
 * Get top N participants for projector/display (after each question or final)
 */
const getTopN = async (quizId, n = 10) => {
  const res = await query(
    `SELECT s.rank, s.previous_rank, s.total_score, s.correct_answers, s.total_time_seconds, s.accuracy_percent, p.name,
       CASE
         WHEN s.previous_rank IS NULL THEN 0
         ELSE (s.previous_rank - s.rank)
       END AS rank_change
     FROM scores s
     JOIN participants p ON p.id = s.participant_id
     WHERE s.quiz_id = $1
     ORDER BY s.rank ASC
     LIMIT $2`,
    [quizId, n]
  );
  return res.rows;
};

/**
 * Get a single participant's rank and score
 */
const getParticipantRank = async (quizId, participantId) => {
  const res = await query(
    `SELECT s.rank, s.previous_rank, s.total_score, s.correct_answers, s.total_time_seconds, s.accuracy_percent,
       CASE
         WHEN s.previous_rank IS NULL THEN 0
         ELSE (s.previous_rank - s.rank)
       END AS rank_change
     FROM scores s
     WHERE s.quiz_id = $1 AND s.participant_id = $2`,
    [quizId, participantId]
  );
  return res.rows[0] || { rank: null, previous_rank: null, rank_change: 0, total_score: 0, correct_answers: 0, total_time_seconds: 0, accuracy_percent: 0 };
};

/**
 * Get leaderboard payload optimized for 200 participants:
 * Returns top 10 (for projector) + individual rank for each participant
 * Does NOT broadcast the full 200-person list to every phone.
 */
const getLeaderboardPayload = async (quizId) => {
  const top10 = await getTopN(quizId, 10);
  return { top10 };
};

/**
 * Get final results with statistics
 */
const getFinalResults = async (quizId) => {
  const leaderboard = await getFullLeaderboard(quizId);

  const statsRes = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM participants WHERE quiz_id = $1) AS total_participants,
       (SELECT COUNT(DISTINCT participant_id)::int FROM answers WHERE quiz_id = $1) AS participated,
       (SELECT COUNT(*)::int FROM questions WHERE quiz_id = $1) AS total_questions`,
    [quizId]
  );

  // Per-question stats
  const questionStatsRes = await query(
    `SELECT q.question_number, q.question_text,
       COUNT(a.id) AS answered,
       COUNT(a.id) FILTER (WHERE a.is_correct = true) AS correct,
       COUNT(a.id) FILTER (WHERE a.is_correct = false) AS incorrect
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.quiz_id = $1
     GROUP BY q.id, q.question_number, q.question_text
     ORDER BY q.question_number`,
    [quizId]
  );

  return {
    leaderboard,
    stats: statsRes.rows[0],
    questionStats: questionStatsRes.rows,
  };
};

module.exports = { getFullLeaderboard, getTopN, getParticipantRank, getLeaderboardPayload, getFinalResults };
