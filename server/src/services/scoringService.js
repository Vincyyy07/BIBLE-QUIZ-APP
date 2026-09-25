const { query, getClient } = require('../models/db');
const logger = require('../utils/logger');

/**
 * Calculate and update scores for all participants after a question ends.
 *
 * Scoring rules (modular — swap this function to change scoring):
 *   Correct answer submitted before deadline: +points (from question.points)
 *   Incorrect or unanswered: +0
 *
 * Tie-breaking (documented):
 *   1. Higher total_score wins
 *   2. If tied: higher correct_answers wins
 *   3. If still tied: earlier last_correct_at wins (faster correct answers overall)
 */
const processQuestionResults = async (quizId, questionId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get question details (correct answer, points, started_at, ends_at)
    const qRes = await client.query(
      `SELECT correct_answer, points, started_at, ends_at FROM questions WHERE id = $1`,
      [questionId]
    );
    if (!qRes.rows[0]) throw new Error('Question not found');
    const { correct_answer, points, started_at, ends_at } = qRes.rows[0];

    // 1. Bulk score all answers for this question in a single set-based query
    await client.query(
      `UPDATE answers
       SET
         is_correct = (selected_answer = $2 AND submitted_at <= $4),
         points_awarded = CASE WHEN (selected_answer = $2 AND submitted_at <= $4) THEN $3 ELSE 0 END,
         response_time_seconds = GREATEST(0.1, ROUND(EXTRACT(EPOCH FROM (submitted_at - COALESCE($5, submitted_at)))::numeric, 2))
       WHERE question_id = $1`,
      [questionId, correct_answer, points, ends_at, started_at]
    );

    // 2. Bulk upsert into scores table for all participants who answered
    await client.query(
      `INSERT INTO scores (quiz_id, participant_id, total_score, correct_answers, total_time_seconds, last_correct_at)
       SELECT
         $1,
         a.participant_id,
         a.points_awarded,
         CASE WHEN a.is_correct THEN 1 ELSE 0 END,
         COALESCE(a.response_time_seconds, 0),
         CASE WHEN a.is_correct THEN a.submitted_at ELSE NULL END
       FROM answers a
       WHERE a.question_id = $2
       ON CONFLICT (quiz_id, participant_id) DO UPDATE SET
         total_score        = scores.total_score + EXCLUDED.total_score,
         correct_answers    = scores.correct_answers + EXCLUDED.correct_answers,
         total_time_seconds = scores.total_time_seconds + EXCLUDED.total_time_seconds,
         last_correct_at    = CASE
           WHEN EXCLUDED.correct_answers > 0 THEN EXCLUDED.last_correct_at
           ELSE scores.last_correct_at
         END`,
      [quizId, questionId]
    );

    // Ensure all participants have a scores row
    await client.query(
      `INSERT INTO scores (quiz_id, participant_id, total_score, correct_answers, total_time_seconds)
       SELECT $1, p.id, 0, 0, 0 FROM participants p
       WHERE p.quiz_id = $1
       ON CONFLICT (quiz_id, participant_id) DO NOTHING`,
      [quizId]
    );

    // Total questions for accuracy calculation
    const qCountRes = await client.query(`SELECT COUNT(*) as count FROM questions WHERE quiz_id = $1`, [quizId]);
    const totalQuestions = parseInt(qCountRes.rows[0].count, 10) || 1;

    // Save previous rank before recalculating new ranks for position movement tracking
    await client.query(`UPDATE scores SET previous_rank = rank WHERE quiz_id = $1`, [quizId]);

    // Recalculate ranks:
    // 1. total_score DESC
    // 2. correct_answers (accuracy) DESC
    // 3. total_time_seconds ASC (faster timing wins tie-break)
    // 4. last_correct_at ASC
    await client.query(
      `UPDATE scores SET rank = sub.rank, accuracy_percent = sub.accuracy
       FROM (
          SELECT id,
            ROUND((correct_answers::numeric / GREATEST($2, 1)) * 100, 1) AS accuracy,
            ROW_NUMBER() OVER (
              PARTITION BY quiz_id
              ORDER BY 
                total_score DESC, 
                correct_answers DESC, 
                total_time_seconds ASC, 
                last_correct_at ASC NULLS LAST
            ) AS rank
          FROM scores WHERE quiz_id = $1
        ) sub
        WHERE scores.id = sub.id`,
      [quizId, totalQuestions]
    );

    await client.query('COMMIT');

    // Get comprehensive question analytics (option breakdown + response times)
    const statsRes = await query(
      `SELECT
         COUNT(*) FILTER (WHERE a.selected_answer IS NOT NULL) AS answered,
         COUNT(*) FILTER (WHERE a.is_correct = true) AS correct,
         COUNT(*) FILTER (WHERE a.is_correct = false AND a.selected_answer IS NOT NULL) AS incorrect,
         COUNT(p.id) - COUNT(a.id) AS unanswered,
         COUNT(*) FILTER (WHERE a.selected_answer = 'A') AS count_a,
         COUNT(*) FILTER (WHERE a.selected_answer = 'B') AS count_b,
         COUNT(*) FILTER (WHERE a.selected_answer = 'C') AS count_c,
         COUNT(*) FILTER (WHERE a.selected_answer = 'D') AS count_d,
         ROUND(AVG(a.response_time_seconds)::numeric, 1) AS avg_time_seconds,
         MIN(a.response_time_seconds) AS fastest_time_seconds
       FROM participants p
       LEFT JOIN answers a ON a.participant_id = p.id AND a.question_id = $1
       WHERE p.quiz_id = $2`,
      [questionId, quizId]
    );

    logger.info('Question scored', { quizId, questionId, stats: statsRes.rows[0] });
    return { correctAnswer: correct_answer, stats: statsRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error processing question results', { quizId, questionId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { processQuestionResults };
