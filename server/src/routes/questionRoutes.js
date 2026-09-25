const express = require('express');
const router = express.Router();
const { verifyHostToken } = require('../middleware/authMiddleware');
const { updateQuestionHandler, deleteQuestionHandler, duplicateQuestionHandler, addQuestionValidation } = require('../controllers/quizController');

// All question-level routes require host auth
router.put('/:id', verifyHostToken, addQuestionValidation, updateQuestionHandler);
router.delete('/:id', verifyHostToken, deleteQuestionHandler);
router.post('/:id/duplicate', verifyHostToken, duplicateQuestionHandler);

module.exports = router;
