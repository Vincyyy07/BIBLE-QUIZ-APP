const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyUserToken } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', verifyUserToken, authController.getMe);

module.exports = router;
