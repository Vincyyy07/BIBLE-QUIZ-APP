const bcrypt = require('bcryptjs');
const db = require('../models/db');
const { signUserToken } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * Register a new host account.
 */
const register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (cleanEmail.length < 5 || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const insertRes = await db.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [cleanEmail, passwordHash, cleanName]
    );

    const user = insertRes.rows[0];

    // Assign any unassigned existing quizzes to this first/new host so no quizzes are lost
    try {
      const claimRes = await db.query(
        'UPDATE quizzes SET user_id = $1 WHERE user_id IS NULL',
        [user.id]
      );
      if (claimRes.rowCount > 0) {
        logger.info(`Assigned ${claimRes.rowCount} existing quizzes to new host ${user.email}`);
      }
    } catch (claimErr) {
      logger.warn('Error assigning unowned quizzes to user', { error: claimErr.message });
    }

    const token = signUserToken(user);
    logger.info(`Host registered successfully: ${user.email} (ID: ${user.id})`);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    logger.error('Host registration error', { error: err.message });
    return res.status(500).json({ error: 'Failed to create host account' });
  }
};

/**
 * Login with existing host account.
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const result = await db.query(
      'SELECT id, email, password_hash, name, created_at FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signUserToken(user);
    logger.info(`Host logged in successfully: ${user.email} (ID: ${user.id})`);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    logger.error('Host login error', { error: err.message });
    return res.status(500).json({ error: 'Failed to log in' });
  }
};

/**
 * Get current authenticated host profile.
 */
const getMe = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    logger.error('Get profile error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

module.exports = {
  register,
  login,
  getMe
};
