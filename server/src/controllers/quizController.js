const { body, param, validationResult } = require('express-validator');
const {
  createQuiz, getQuizByCode, getQuizById, getQuizWithQuestions,
  addQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  updateQuiz, duplicateQuestion,
} = require('../services/quizService');
const { signHostToken } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
};

// POST /api/quizzes
const createQuizHandler = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;
  try {
    const { title, description } = req.body;
    const userId = req.user ? req.user.userId : null;
    const quiz = await createQuiz({ title, description, userId });
    res.status(201).json({
      id: quiz.id,
      code: quiz.code,
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
      hostToken: quiz.hostToken,
      createdAt: quiz.created_at,
    });
  } catch (err) {
    logger.error('Create quiz error', { error: err.message });
    res.status(500).json({ error: 'Failed to create quiz' });
  }
};

// GET /api/quizzes/code/:code  (public — for join page validation)
const getQuizByCodeHandler = async (req, res) => {
  try {
    const quiz = await getQuizByCode(req.params.code.toUpperCase());
    if (!quiz) return res.status(404).json({ error: 'Quiz not found. Check the code and try again.' });
    res.json({
      id: quiz.id,
      code: quiz.code,
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
    });
  } catch (err) {
    logger.error('Get quiz by code error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/quizzes/:id  (host — returns full quiz with questions)
const getQuizByIdHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const quiz = await getQuizWithQuestions(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Ensure valid hostToken is provided for this quiz
    const hostToken = signHostToken(quiz.id);
    res.json({ ...quiz, hostToken });
  } catch (err) {
    logger.error('Get quiz by id error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/quizzes/:id
const updateQuizHandler = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;
  try {
    const quizId = parseInt(req.params.id, 10);
    const updated = await updateQuiz(quizId, req.body);
    res.json(updated);
  } catch (err) {
    logger.error('Update quiz error', { error: err.message });
    res.status(500).json({ error: 'Failed to update quiz' });
  }
};

// POST /api/quizzes/:id/questions
const addQuestionHandler = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;
  try {
    const quizId = parseInt(req.params.id, 10);
    const q = await addQuestion(quizId, {
      questionText: req.body.questionText,
      optionA: req.body.optionA,
      optionB: req.body.optionB,
      optionC: req.body.optionC,
      optionD: req.body.optionD,
      correctAnswer: req.body.correctAnswer,
      durationSeconds: req.body.durationSeconds,
      points: req.body.points,
    });
    res.status(201).json(q);
  } catch (err) {
    logger.error('Add question error', { error: err.message });
    res.status(500).json({ error: 'Failed to add question' });
  }
};

// PUT /api/questions/:id
const updateQuestionHandler = async (req, res) => {
  const err = handleValidationErrors(req, res);
  if (err) return;
  try {
    const { query } = require('../models/db');
    const qRes = await query(`SELECT quiz_id FROM questions WHERE id = $1`, [req.params.id]);
    if (!qRes.rows[0]) return res.status(404).json({ error: 'Question not found' });

    const fields = {};
    if (req.body.questionText !== undefined) fields.question_text = req.body.questionText;
    if (req.body.optionA !== undefined) fields.option_a = req.body.optionA;
    if (req.body.optionB !== undefined) fields.option_b = req.body.optionB;
    if (req.body.optionC !== undefined) fields.option_c = req.body.optionC;
    if (req.body.optionD !== undefined) fields.option_d = req.body.optionD;
    if (req.body.correctAnswer !== undefined) fields.correct_answer = req.body.correctAnswer;
    if (req.body.durationSeconds !== undefined) fields.duration_seconds = req.body.durationSeconds;
    if (req.body.points !== undefined) fields.points = req.body.points;

    const updated = await updateQuestion(req.params.id, fields);
    res.json(updated);
  } catch (err) {
    logger.error('Update question error', { error: err.message });
    res.status(500).json({ error: 'Failed to update question' });
  }
};

// DELETE /api/questions/:id
const deleteQuestionHandler = async (req, res) => {
  try {
    const { query } = require('../models/db');
    const qRes = await query(`SELECT quiz_id FROM questions WHERE id = $1`, [req.params.id]);
    if (!qRes.rows[0]) return res.status(404).json({ error: 'Question not found' });

    await deleteQuestion(req.params.id, qRes.rows[0].quiz_id);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete question error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

// POST /api/quizzes/:id/questions/reorder
const reorderQuestionsHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
    await reorderQuestions(quizId, orderedIds);
    res.json({ success: true });
  } catch (err) {
    logger.error('Reorder questions error', { error: err.message });
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
};

// POST /api/questions/:id/duplicate
const duplicateQuestionHandler = async (req, res) => {
  try {
    const { query } = require('../models/db');
    const qRes = await query(`SELECT quiz_id FROM questions WHERE id = $1`, [req.params.id]);
    if (!qRes.rows[0]) return res.status(404).json({ error: 'Question not found' });
    const dup = await duplicateQuestion(req.params.id, qRes.rows[0].quiz_id);
    res.status(201).json(dup);
  } catch (err) {
    logger.error('Duplicate question error', { error: err.message });
    res.status(500).json({ error: 'Failed to duplicate question' });
  }
};

// GET /api/quizzes/:id/status  — update quiz status to WAITING (ready to accept participants)
const setWaitingHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const { updateQuizStatus } = require('../services/quizService');
    await updateQuizStatus(quizId, 'WAITING');
    res.json({ success: true, status: 'WAITING' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// Validation chains
const createQuizValidation = [
  body('title').trim().notEmpty().isLength({ max: 255 }).withMessage('Title is required (max 255 chars)'),
  body('description').optional().isLength({ max: 1000 }),
];

const addQuestionValidation = [
  body('questionText').trim().notEmpty().isLength({ max: 1000 }),
  body('optionA').trim().notEmpty().isLength({ max: 500 }),
  body('optionB').trim().notEmpty().isLength({ max: 500 }),
  body('optionC').trim().notEmpty().isLength({ max: 500 }),
  body('optionD').trim().notEmpty().isLength({ max: 500 }),
  body('correctAnswer').isIn(['A', 'B', 'C', 'D']),
  body('durationSeconds').isInt({ min: 5, max: 300 }),
  body('points').optional().isInt({ min: 1, max: 1000 }),
];

// GET /api/quizzes — list all quizzes for host dashboard
const getAllQuizzesHandler = async (req, res) => {
  try {
    const { getAllQuizzes } = require('../services/quizService');
    const userId = req.user ? req.user.userId : null;
    const quizzes = await getAllQuizzes(userId);
    res.json(quizzes);
  } catch (err) {
    logger.error('Get all quizzes error', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve quizzes' });
  }
};

// DELETE /api/quizzes/:id
const deleteQuizHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const { deleteQuiz } = require('../services/quizService');
    await deleteQuiz(quizId);
    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (err) {
    logger.error('Delete quiz error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
};

// POST /api/quizzes/:id/duplicate
const duplicateQuizHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const { duplicateQuiz } = require('../services/quizService');
    const userId = req.user ? req.user.userId : null;
    const dup = await duplicateQuiz(quizId, userId);
    res.status(201).json(dup);
  } catch (err) {
    logger.error('Duplicate quiz error', { error: err.message });
    res.status(500).json({ error: 'Failed to duplicate quiz' });
  }
};

// POST /api/quizzes/:id/reset
const resetQuizHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const { resetQuiz } = require('../services/quizService');
    const reset = await resetQuiz(quizId);
    res.json(reset);
  } catch (err) {
    logger.error('Reset quiz error', { error: err.message });
    res.status(500).json({ error: 'Failed to reset quiz' });
  }
};

module.exports = {
  createQuizHandler, getQuizByCodeHandler, getQuizByIdHandler,
  updateQuizHandler, addQuestionHandler, updateQuestionHandler,
  deleteQuestionHandler, reorderQuestionsHandler, duplicateQuestionHandler,
  setWaitingHandler, createQuizValidation, addQuestionValidation,
  getAllQuizzesHandler, deleteQuizHandler, duplicateQuizHandler, resetQuizHandler,
};
