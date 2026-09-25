const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Join endpoint limiter (allows full groups/congregations sharing same Wi-Fi NAT)
const joinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many join attempts. Please wait a moment.' },
});

// Quiz creation limiter
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many quizzes created. Please wait.' },
});

module.exports = { apiLimiter, joinLimiter, createLimiter };
