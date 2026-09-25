const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Verify host JWT token from REST request headers.
 * Supports both quiz-scoped tokens (HOST_SECRET) and user account tokens (JWT_SECRET).
 */
const verifyHostToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing host authorization token' });
  }

  const token = authHeader.slice(7);
  // Try verifying with HOST_SECRET first
  try {
    const decoded = jwt.verify(token, process.env.HOST_SECRET);
    req.hostPayload = decoded;
    return next();
  } catch (err) {
    // Fallback: try verifying with JWT_SECRET / user token
    try {
      const secret = process.env.JWT_SECRET || process.env.HOST_SECRET;
      const userDecoded = jwt.verify(token, secret);
      req.user = userDecoded;
      req.hostPayload = { userId: userDecoded.userId, role: 'host' };
      return next();
    } catch (userErr) {
      logger.warn('Invalid host token attempt', { error: err.message });
      return res.status(403).json({ error: 'Invalid or expired host token' });
    }
  }
};

/**
 * Verify host token from Socket.IO event payload.
 * Returns decoded payload or null.
 */
const verifyHostTokenSocket = (token) => {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.HOST_SECRET);
  } catch {
    try {
      const secret = process.env.JWT_SECRET || process.env.HOST_SECRET;
      const userDecoded = jwt.verify(token, secret);
      return { userId: userDecoded.userId, role: 'host' };
    } catch {
      return null;
    }
  }
};

/**
 * Sign a new host token for a given quizId.
 */
const signHostToken = (quizId) => {
  return jwt.sign(
    { quizId, role: 'host' },
    process.env.HOST_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Sign a new user/host authentication token.
 */
const signUserToken = (user) => {
  const secret = process.env.JWT_SECRET || process.env.HOST_SECRET;
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' }
  );
};

/**
 * Verify logged-in user/host JWT token from REST request headers.
 */
const verifyUserToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    const secret = process.env.JWT_SECRET || process.env.HOST_SECRET;
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid user token attempt', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

module.exports = {
  verifyHostToken,
  verifyHostTokenSocket,
  signHostToken,
  signUserToken,
  verifyUserToken
};
