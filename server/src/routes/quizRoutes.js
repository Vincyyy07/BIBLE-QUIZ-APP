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

// Host-only protected routes (requires valid user login & ownership check)
router.get('/', verifyUserToken, getAllQuizzesHandler);
router.post('/', verifyUserToken, createLimiter, createQuizValidation, createQuizHandler);
router.get('/:id', verifyUserToken, getQuizByIdHandler);
router.put('/:id', verifyUserToken, updateQuizHandler);
router.delete('/:id', verifyUserToken, deleteQuizHandler);
router.post('/:id/duplicate', verifyUserToken, duplicateQuizHandler);
router.post('/:id/reset', verifyUserToken, resetQuizHandler);
router.post('/:id/waiting', verifyUserToken, setWaitingHandler);
router.post('/:id/questions', verifyUserToken, addQuestionValidation, addQuestionHandler);
router.post('/:id/questions/reorder', verifyUserToken, reorderQuestionsHandler);
router.get('/:id/results', verifyUserToken, getResultsHandler);
router.get('/:id/export', verifyUserToken, exportResultsHandler);

module.exports = router;
