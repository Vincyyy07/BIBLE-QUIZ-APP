const express = require('express');
const router = express.Router();
const { verifyHostToken, verifyUserToken } = require('../middleware/authMiddleware');
const { createLimiter, joinLimiter } = require('../middleware/rateLimiter');
const {
  createQuizHandler, getQuizByCodeHandler, getQuizByIdHandler,
  updateQuizHandler, addQuestionHandler, updateQuestionHandler,
  deleteQuestionHandler, reorderQuestionsHandler, duplicateQuestionHandler,
  setWaitingHandler, createQuizValidation, addQuestionValidation,
  getAllQuizzesHandler, deleteQuizHandler, duplicateQuizHandler, resetQuizHandler,
} = require('../controllers/quizController');
const { getResultsHandler, getLeaderboardHandler, exportResultsHandler } = require('../controllers/resultController');

// Public routes (participants)
router.get('/code/:code', joinLimiter, getQuizByCodeHandler);
router.get('/:id/leaderboard', getLeaderboardHandler);

// Host routes
router.get('/', verifyUserToken, getAllQuizzesHandler);
router.post('/', verifyUserToken, createLimiter, createQuizValidation, createQuizHandler);
router.get('/:id', getQuizByIdHandler);
router.put('/:id', updateQuizHandler);
router.delete('/:id', deleteQuizHandler);
router.post('/:id/duplicate', verifyUserToken, duplicateQuizHandler);
router.post('/:id/reset', resetQuizHandler);
router.post('/:id/waiting', setWaitingHandler);
router.post('/:id/questions', addQuestionValidation, addQuestionHandler);
router.post('/:id/questions/reorder', reorderQuestionsHandler);
router.get('/:id/results', getResultsHandler);
router.get('/:id/export', exportResultsHandler);

module.exports = router;
