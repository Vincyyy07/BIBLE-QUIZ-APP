const { getFinalResults } = require('../services/leaderboardService');
const { getQuizById } = require('../services/quizService');
const { query } = require('../models/db');
const { Parser } = require('json2csv');
const logger = require('../utils/logger');

// GET /api/quizzes/:id/results  (host only)
const getResultsHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const results = await getFinalResults(quizId);
    res.json(results);
  } catch (err) {
    logger.error('Get results error', { error: err.message });
    res.status(500).json({ error: 'Failed to get results' });
  }
};

// GET /api/quizzes/:id/leaderboard  (public after quiz is completed)
const getLeaderboardHandler = async (req, res) => {
  try {
    const quiz = await getQuizById(parseInt(req.params.id, 10));
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (quiz.status !== 'COMPLETED') return res.status(403).json({ error: 'Results not yet available' });

    const leaderboard = await query(
      `SELECT s.rank, s.total_score, s.correct_answers, p.name
       FROM scores s JOIN participants p ON p.id = s.participant_id
       WHERE s.quiz_id = $1 ORDER BY s.rank ASC`,
      [parseInt(req.params.id, 10)]
    );
    res.json({ leaderboard: leaderboard.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

// GET /api/quizzes/:id/export  (CSV export, host only)
const exportResultsHandler = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    const results = await getFinalResults(quizId);
    const quiz = await getQuizById(quizId);

    const csvData = results.leaderboard.map((row) => ({
      Rank: row.rank,
      Name: row.name,
      'Total Score': row.total_score,
      'Correct Answers': row.correct_answers,
    }));

    // Simple CSV without extra library
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map((row) => headers.map((h) => `"${row[h]}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${quiz.title}_results.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error('Export results error', { error: err.message });
    res.status(500).json({ error: 'Failed to export results' });
  }
};

module.exports = { getResultsHandler, getLeaderboardHandler, exportResultsHandler };
