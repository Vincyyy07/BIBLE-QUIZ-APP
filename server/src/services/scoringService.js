const { query, getClient } = require('../models/db');
const logger = require('../utils/logger');

/**
 * Bulk recalculate and update scores, ranks, and accuracy for an entire quiz.
 * Idempotent, safe, and guarantees correct numbers across all questions.
 */
const recalculateQuizScores = async (quizId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Ensure response_time_seconds column exists in answers table
    await client.query(`ALTER TABLE answers ADD COLUMN IF NOT EXISTS response_time_seconds NUMERIC DEFAULT 0;`);

    // 2. Score all answers for this quiz against each question's correct answer and points
    await client.query(
      `UPDATE answers a
       SET
         is_correct = (a.selected_answer IS NOT NULL AND UPPER(TRIM(a.selected_answer)) = UPPER(TRIM(q.correct_answer))),
         points_awarded = CASE 
           WHEN a.selected_answer IS NOT NULL AND UPPER(TRIM(a.selected_answer)) = UPPER(TRIM(q.correct_answer)) 
           THEN COALESCE(q.points, 100) 
           ELSE 0 
         END,
         response_time_seconds = GREATEST(0.1, ROUND(EXTRACT(EPOCH FROM (a.submitted_at - COALESCE(q.started_at, a.submitted_at)))::numeric, 2))
       FROM questions q
       WHERE a.question_id = q.id AND a.quiz_id = $1`,
      [quizId]
    );

    // 3. Compute exact cumulative totals for all participants
    await client.query(
      `INSERT INTO scores (quiz_id, participant_id, total_score, correct_answers, total_time_seconds, last_correct_at)
       SELECT
         $1,
         p.id,
         COALESCE(SUM(a.points_awarded), 0),
         COALESCE(COUNT(a.id) FILTER (WHERE a.is_correct = true), 0),
         COALESCE(ROUND(SUM(a.response_time_seconds)::numeric, 2), 0),
         MAX(CASE WHEN a.is_correct = true THEN a.submitted_at ELSE NULL END)
       FROM participants p
       LEFT JOIN answers a ON a.participant_id = p.id AND a.quiz_id = $1
       WHERE p.quiz_id = $1
       GROUP BY p.id
       ON CONFLICT (quiz_id, participant_id) DO UPDATE SET
         total_score        = EXCLUDED.total_score,
         correct_answers    = EXCLUDED.correct_answers,
         total_time_seconds = EXCLUDED.total_time_seconds,
         last_correct_at    = EXCLUDED.last_correct_at`,
      [quizId]
    );

    // 4. Total questions count for accuracy calculation
    const qCountRes = await client.query(`SELECT COUNT(*) as count FROM questions WHERE quiz_id = $1`, [quizId]);
    const totalQuestions = parseInt(qCountRes.rows[0].count, 10) || 1;

    // 5. Update previous rank for rank change display
    await client.query(`UPDATE scores SET previous_rank = rank WHERE quiz_id = $1`, [quizId]);

    // 6. Recalculate ranks:
    //    1. total_score DESC
    //    2. correct_answers DESC
    //    3. total_time_seconds ASC (faster timing wins tie-break)
    //    4. last_correct_at ASC
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
    logger.info('Quiz scores successfully recalculated', { quizId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error recalculating quiz scores', { quizId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Calculate and update scores after an individual question ends.
 */
const processQuestionResults = async (quizId, questionId) => {
  // First recalculate the quiz scores comprehensively
  await recalculateQuizScores(quizId);

  // Fetch question details for response
  const qRes = await query(
    `SELECT correct_answer, points FROM questions WHERE id = $1`,
    [questionId]
  );
  const { correct_answer } = qRes.rows[0] || {};

  // Get question analytics
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

  logger.info('Question processed', { quizId, questionId, stats: statsRes.rows[0] });
  return { correctAnswer: correct_answer, stats: statsRes.rows[0] };
};

module.exports = { processQuestionResults, recalculateQuizScores };
