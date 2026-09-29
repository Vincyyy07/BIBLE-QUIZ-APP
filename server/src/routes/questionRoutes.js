const express = require('express');
const router = express.Router();
const { verifyUserToken } = require('../middleware/authMiddleware');
const { updateQuestionHandler, deleteQuestionHandler, duplicateQuestionHandler, addQuestionValidation } = require('../controllers/quizController');

// All question-level routes require authenticated user
router.put('/:id', verifyUserToken, addQuestionValidation, updateQuestionHandler);
router.delete('/:id', verifyUserToken, deleteQuestionHandler);
router.post('/:id/duplicate', verifyUserToken, duplicateQuestionHandler);

module.exports = router;
