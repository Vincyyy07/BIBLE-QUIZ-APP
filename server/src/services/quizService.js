const { query, getClient } = require('../models/db');
const { generateUniqueCode } = require('../utils/codeGenerator');
const { signHostToken } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * Create a new quiz
 */
const createQuiz = async ({ title, description, userId = null }) => {
  // Check if code already exists
  const checkExists = async (code) => {
    const res = await query('SELECT id FROM quizzes WHERE code = $1', [code]);
    return res.rows.length > 0;
  };

  const code = await generateUniqueCode(checkExists);
  const hostToken = signHostToken(null); // Will update with real quizId after insert

  const res = await query(
    `INSERT INTO quizzes (code, title, description, user_id, status, host_token, host_token_hash)
     VALUES ($1, $2, $3, $4, 'DRAFT', '', '')
     RETURNING id, code, title, description, user_id, status, created_at`,
    [code, title.trim(), description?.trim() || null, userId]
  );

  const quiz = res.rows[0];

  // Sign the real token with actual quizId
  const realToken = signHostToken(quiz.id);
  await query(
    `UPDATE quizzes SET host_token = $1 WHERE id = $2`,
    [realToken, quiz.id]
  );

  logger.info('Quiz created', { quizId: quiz.id, code: quiz.code, title: quiz.title, userId });
  return { ...quiz, hostToken: realToken };
};

/**
 * Get quiz by code (public info for join page)
 */
const getQuizByCode = async (code) => {
  const res = await query(
    `SELECT id, code, title, description, status, current_question_index, created_at
     FROM quizzes WHERE code = $1`,
    [code.toUpperCase()]
  );
  return res.rows[0] || null;
};

/**
 * Get quiz by id (full info for host)
 */
const getQuizById = async (id) => {
  const res = await query(
    `SELECT id, code, title, description, status, current_question_index,
            created_at, started_at, ended_at
     FROM quizzes WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
};

/**
 * Get all questions for a quiz
 */
const getQuizQuestions = async (quizId) => {
  const res = await query(
    `SELECT id, quiz_id, question_number, question_text,
            option_a, option_b, option_c, option_d,
            correct_answer, duration_seconds, points, started_at, ends_at
     FROM questions
     WHERE quiz_id = $1
     ORDER BY question_number ASC`,
    [quizId]
  );
  return res.rows;
};

/**
 * Add a question to a quiz
 */
const addQuestion = async (quizId, { questionNumber, questionText, optionA, optionB, optionC, optionD, correctAnswer, durationSeconds, points }) => {
  // If no questionNumber provided, auto-assign next
  let qNum = questionNumber;
  if (!qNum) {
    const maxRes = await query(
      `SELECT COALESCE(MAX(question_number), 0) + 1 AS next FROM questions WHERE quiz_id = $1`,
      [quizId]
    );
    qNum = maxRes.rows[0].next;
  }

  const res = await query(
    `INSERT INTO questions (quiz_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, duration_seconds, points)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [quizId, qNum, questionText.trim(), optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim(), correctAnswer.toUpperCase(), durationSeconds || 20, points || 10]
  );
  logger.info('Question added', { quizId, questionNumber: qNum });
  return res.rows[0];
};

/**
 * Update a question
 */
const updateQuestion = async (questionId, fields) => {
  const allowed = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'duration_seconds', 'points'];
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key) && val !== undefined) {
      setClauses.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (setClauses.length === 0) throw new Error('No valid fields to update');

  values.push(questionId);
  const res = await query(
    `UPDATE questions SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return res.rows[0];
};

/**
 * Delete a question and renumber remaining
 */
const deleteQuestion = async (questionId, quizId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const deleted = await client.query(
      `DELETE FROM questions WHERE id = $1 AND quiz_id = $2 RETURNING question_number`,
      [questionId, quizId]
    );
    if (deleted.rows.length === 0) throw new Error('Question not found');
    const deletedNum = deleted.rows[0].question_number;

    // Renumber questions after the deleted one
    await client.query(
      `UPDATE questions SET question_number = question_number - 1
       WHERE quiz_id = $1 AND question_number > $2`,
      [quizId, deletedNum]
    );
    await client.query('COMMIT');
    logger.info('Question deleted', { questionId, quizId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Reorder questions — accepts array of {id, questionNumber}
 */
const reorderQuestions = async (quizId, orderedIds) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE questions SET question_number = $1 WHERE id = $2 AND quiz_id = $3`,
        [i + 1, orderedIds[i], quizId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Update quiz status
 */
const updateQuizStatus = async (quizId, status, extra = {}) => {
  const fields = { status };
  if (status === 'LIVE') fields.started_at = new Date();
  if (status === 'COMPLETED') fields.ended_at = new Date();
  if (extra.currentQuestionIndex !== undefined) fields.current_question_index = extra.currentQuestionIndex;

  const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`);
  const values = Object.values(fields);
  values.push(quizId);

  await query(
    `UPDATE quizzes SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
    values
  );
};

/**
 * Get quiz with questions (for host dashboard load)
 */
const getQuizWithQuestions = async (quizId) => {
  const quiz = await getQuizById(quizId);
  if (!quiz) return null;
  const questions = await getQuizQuestions(quizId);
  return { ...quiz, questions };
};

/**
 * Get participant count for a quiz
 */
const getParticipantCount = async (quizId) => {
  const res = await query(
    `SELECT COUNT(*) as count FROM participants WHERE quiz_id = $1`,
    [quizId]
  );
  return parseInt(res.rows[0].count, 10);
};

/**
 * Update quiz title/description
 */
const updateQuiz = async (quizId, { title, description }) => {
  const res = await query(
    `UPDATE quizzes SET title = $1, description = $2 WHERE id = $3 RETURNING id, title, description`,
    [title.trim(), description?.trim() || null, quizId]
  );
  return res.rows[0];
};

/**
 * Duplicate a question
 */
const duplicateQuestion = async (questionId, quizId) => {
  const src = await query(`SELECT * FROM questions WHERE id = $1 AND quiz_id = $2`, [questionId, quizId]);
  if (!src.rows[0]) throw new Error('Question not found');
  const q = src.rows[0];

  const maxRes = await query(
    `SELECT COALESCE(MAX(question_number), 0) + 1 AS next FROM questions WHERE quiz_id = $1`,
    [quizId]
  );
  const nextNum = maxRes.rows[0].next;

  const res = await query(
    `INSERT INTO questions (quiz_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, duration_seconds, points)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [quizId, nextNum, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.duration_seconds, q.points]
  );
  return res.rows[0];
};

/**
 * Get all quizzes for the host dashboard (filtered by user if provided)
 */
const getAllQuizzes = async (userId = null) => {
  let queryText = `
    SELECT 
       q.id, q.code, q.title, q.description, q.status, 
       q.current_question_index, q.created_at, q.started_at, q.ended_at,
       COUNT(DISTINCT qu.id)::int AS question_count,
       COUNT(DISTINCT p.id)::int AS participant_count
     FROM quizzes q
     LEFT JOIN questions qu ON qu.quiz_id = q.id
     LEFT JOIN participants p ON p.quiz_id = q.id
  `;
  const params = [];
  if (userId) {
    queryText += ` WHERE q.user_id = $1 `;
    params.push(userId);
  }
  queryText += ` GROUP BY q.id ORDER BY q.created_at DESC`;

  const res = await query(queryText, params);
  return res.rows.map((quiz) => ({
    ...quiz,
    hostToken: signHostToken(quiz.id),
  }));
};

/**
 * Delete a quiz and all associated records
 */
const deleteQuiz = async (quizId) => {
  await query(`DELETE FROM quizzes WHERE id = $1`, [quizId]);
  logger.info('Quiz deleted', { quizId });
  return { success: true };
};

/**
 * Duplicate a quiz along with all its questions
 */
const duplicateQuiz = async (quizId, userId = null) => {
  const src = await query(`SELECT * FROM quizzes WHERE id = $1`, [quizId]);
  if (!src.rows[0]) throw new Error('Quiz not found');
  const q = src.rows[0];

  const checkExists = async (c) => {
    const res = await query('SELECT id FROM quizzes WHERE code = $1', [c]);
    return res.rows.length > 0;
  };
  const newCode = await generateUniqueCode(checkExists);

  const newQuizRes = await query(
    `INSERT INTO quizzes (code, title, description, user_id, status, host_token, host_token_hash)
     VALUES ($1, $2, $3, $4, 'DRAFT', '', '')
     RETURNING id, code, title, description, status, created_at`,
    [newCode, `${q.title} (Copy)`, q.description, userId || q.user_id]
  );
  const newQuiz = newQuizRes.rows[0];
  const hostToken = signHostToken(newQuiz.id);
  await query(`UPDATE quizzes SET host_token = $1 WHERE id = $2`, [hostToken, newQuiz.id]);

  const questionsRes = await query(
    `SELECT question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, duration_seconds, points
     FROM questions WHERE quiz_id = $1 ORDER BY question_number`,
    [quizId]
  );
  for (const qu of questionsRes.rows) {
    await query(
      `INSERT INTO questions (quiz_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, duration_seconds, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [newQuiz.id, qu.question_number, qu.question_text, qu.option_a, qu.option_b, qu.option_c, qu.option_d, qu.correct_answer, qu.duration_seconds, qu.points]
    );
  }

  logger.info('Quiz duplicated', { originalQuizId: quizId, newQuizId: newQuiz.id, userId });
  return { ...newQuiz, hostToken, question_count: questionsRes.rows.length };
};

/**
 * Reset a quiz so church host can replay with new participants
 */
const resetQuiz = async (quizId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM answers WHERE quiz_id = $1`, [quizId]);
    await client.query(`DELETE FROM scores WHERE quiz_id = $1`, [quizId]);
    await client.query(`DELETE FROM participants WHERE quiz_id = $1`, [quizId]);
    await client.query(`UPDATE questions SET started_at = NULL, ends_at = NULL WHERE quiz_id = $1`, [quizId]);
    const res = await client.query(
      `UPDATE quizzes SET status = 'WAITING', current_question_index = 0, started_at = NULL, ended_at = NULL
       WHERE id = $1 RETURNING id, code, title, status`,
      [quizId]
    );
    await client.query('COMMIT');
    logger.info('Quiz reset for replay', { quizId });
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createQuiz, getQuizByCode, getQuizById, getQuizQuestions,
  addQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  updateQuizStatus, getQuizWithQuestions, getParticipantCount,
  updateQuiz, duplicateQuestion,
  getAllQuizzes, deleteQuiz, duplicateQuiz, resetQuiz,
};
