const { query } = require('../models/db');
const { verifyHostTokenSocket } = require('../middleware/authMiddleware');
const { updateQuizStatus, getQuizQuestions, getQuizById } = require('../services/quizService');
const { processQuestionResults } = require('../services/scoringService');
const { getLeaderboardPayload, getFullLeaderboard, getFinalResults, getParticipantRank, getTopN } = require('../services/leaderboardService');
const logger = require('../utils/logger');

// In-memory store for active question timers (quizId -> timeout handle)
const activeTimers = new Map();
// In-memory store for active quiz state (quizId -> { currentQuestion, paused, pausedAt, remainingMs })
const activeQuizState = new Map();

const emitError = (socket, code, message) => {
  socket.emit('error', { code, message });
};

/**
 * Verify host socket authorization
 * Returns { quizId } if valid, null otherwise
 */
const authorizeHost = (socket, hostToken, expectedQuizId) => {
  const decoded = verifyHostTokenSocket(hostToken);
  if (!decoded || decoded.role !== 'host') {
    emitError(socket, 'UNAUTHORIZED', 'Invalid host token');
    logger.warn('Unauthorized host action attempt', { socketId: socket.id });
    return null;
  }
  if (expectedQuizId && decoded.quizId !== parseInt(expectedQuizId, 10)) {
    emitError(socket, 'FORBIDDEN', 'Token does not match this quiz');
    return null;
  }
  return decoded;
};

/**
 * Broadcast question_ended to host and participants with real-time standings
 */
const handleQuestionEnd = async (io, quizId, questionId, quizCode, allAnswered = false) => {
  try {
    const qId = parseInt(quizId, 10);
    // Clear any pending timer immediately
    if (activeTimers.has(qId)) {
      clearTimeout(activeTimers.get(qId));
      activeTimers.delete(qId);
    }

    await updateQuizStatus(qId, 'QUESTION_ENDED');

    // Score all answers in database
    const scoringResult = await processQuestionResults(qId, questionId);

    // Fetch updated live top 10 standings
    const top10 = await getTopN(qId, 10);

    // Update in-memory state
    const state = activeQuizState.get(qId);
    if (state) {
      state.ended = true;
      activeQuizState.set(qId, state);
    }

    // 1. Send complete analytics & standings to Host control room
    io.to(`host:${qId}`).emit('question_ended', {
      questionId,
      allAnswered,
      correctAnswer: scoringResult?.correctAnswer,
      stats: scoringResult?.stats,
      top10,
      message: allAnswered ? 'All participants have answered!' : "Time's up!",
    });

    // 2. Broadcast question_ended to general quiz room (for display/projector)
    io.to(`quiz:${quizCode}`).emit('question_ended', {
      questionId,
      allAnswered,
      top10,
      message: allAnswered ? 'All participants have answered!' : "Time's up!",
    });

    // 3. Send real-time rank and position to EACH participant phone in a single fast batch
    const participantsRes = await query(
      `SELECT p.id, p.session_id, s.rank, s.total_score
       FROM participants p
       JOIN scores s ON s.participant_id = p.id AND s.quiz_id = $1
       WHERE p.quiz_id = $1`,
      [qId]
    );

    const totalParticipants = participantsRes.rows.length || 1;

    for (const p of participantsRes.rows) {
      io.to(`session:${p.session_id}`).emit('question_result', {
        questionId,
        rank: p.rank,
        totalScore: p.total_score,
        totalParticipants,
        allAnswered,
      });
    }

    logger.info('Question ended and results dispatched to host and players', { quizId: qId, questionId, allAnswered });
  } catch (err) {
    logger.error('Error in handleQuestionEnd', { quizId, questionId, error: err.message });
  }
};

/**
 * Register host socket event handlers
 */
const registerHostHandlers = (io, socket) => {

  // Host joins their control room
  socket.on('host_join', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    socket.join(`host:${quizId}`);
    socket.quizId = quizId;
    socket.role = 'host';

    // Also join quizCode room so host receives all room broadcasts
    const quizRes = await query(`SELECT code FROM quizzes WHERE id = $1`, [quizId]);
    if (quizRes.rows[0]) {
      socket.join(`quiz:${quizRes.rows[0].code}`);
    }

    // Restore state if quiz was live
    const state = activeQuizState.get(parseInt(quizId, 10));
    const top10 = await getTopN(parseInt(quizId, 10), 10);
    if (state) {
      socket.emit('session_restored', { currentState: { ...state, top10 } });
    }
    socket.emit('live_leaderboard', { top10 });

    const count = await query(
      `SELECT COUNT(*) as count FROM participants WHERE quiz_id = $1`,
      [quizId]
    );
    socket.emit('participant_count', { count: parseInt(count.rows[0].count, 10) });
    logger.info('Host joined', { quizId, socketId: socket.id });
  });

  // Start the quiz (transition from WAITING to LIVE, then start Q1)
  socket.on('start_quiz', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    try {
      const quiz = await getQuizById(quizId);
      if (!quiz) return emitError(socket, 'NOT_FOUND', 'Quiz not found');
      if (!['WAITING', 'DRAFT'].includes(quiz.status)) {
        return emitError(socket, 'INVALID_STATE', 'Quiz already started or completed');
      }

      const questions = await getQuizQuestions(quizId);
      if (questions.length === 0) {
        return emitError(socket, 'NO_QUESTIONS', 'Add at least one question before starting');
      }

      await updateQuizStatus(quizId, 'LIVE', { currentQuestionIndex: 0 });

      // Initialize scores for all registered participants with starting ranks
      await query(
        `INSERT INTO scores (quiz_id, participant_id, total_score, correct_answers, total_time_seconds, rank, previous_rank)
         SELECT $1, p.id, 0, 0, 0, ROW_NUMBER() OVER (ORDER BY p.joined_at ASC), ROW_NUMBER() OVER (ORDER BY p.joined_at ASC)
         FROM participants p
         WHERE p.quiz_id = $1
         ON CONFLICT (quiz_id, participant_id) DO NOTHING`,
        [quizId]
      );

      // Get quiz code for room broadcasting
      const quizRes = await query(`SELECT code FROM quizzes WHERE id = $1`, [quizId]);
      const quizCode = quizRes.rows[0].code;

      io.to(`quiz:${quizCode}`).emit('quiz_started', {
        quizId,
        totalQuestions: questions.length,
        quizTitle: quiz.title,
      });

      logger.info('Quiz started', { quizId, quizCode, totalQuestions: questions.length });

      // Auto-start first question
      await startQuestion(io, socket, quizId, quizCode, questions, 0, hostToken);
    } catch (err) {
      logger.error('Error starting quiz', { quizId, error: err.message });
      emitError(socket, 'SERVER_ERROR', 'Failed to start quiz');
    }
  });

  // Next question
  socket.on('next_question', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    try {
      const quiz = await getQuizById(quizId);
      if (!quiz) return emitError(socket, 'NOT_FOUND', 'Quiz not found');

      const questions = await getQuizQuestions(quizId);
      const currentQ = questions[quiz.current_question_index];

      // If host advances while timer is still running, close and score current question first
      if (quiz.status === 'LIVE' && currentQ) {
        await handleQuestionEnd(io, quizId, currentQ.id, quiz.code, false);
      }

      const nextIndex = quiz.current_question_index + 1;

      if (nextIndex >= questions.length) {
        // All questions completed! End the quiz and broadcast final celebration podium
        logger.info('All questions completed, ending quiz', { quizId });
        await updateQuizStatus(quizId, 'COMPLETED');
        const finalResults = await getFinalResults(quizId);

        io.to(`host:${quizId}`).emit('quiz_ended', {
          finalLeaderboard: finalResults.leaderboard,
          top3: finalResults.leaderboard.slice(0, 3),
        });

        io.to(`quiz:${quiz.code}`).emit('quiz_ended', {
          finalLeaderboard: finalResults.leaderboard.slice(0, 20),
          top3: finalResults.leaderboard.slice(0, 3),
        });

        // Send individual final rank to each participant
        const participantsRes = await query(
          `SELECT p.id, p.session_id FROM participants p WHERE p.quiz_id = $1`,
          [quizId]
        );
        for (const p of participantsRes.rows) {
          const rank = await getParticipantRank(quizId, p.id);
          io.to(`session:${p.session_id}`).emit('my_final_rank', rank);
        }

        return;
      }

      await startQuestion(io, socket, quizId, quiz.code, questions, nextIndex, hostToken);
    } catch (err) {
      logger.error('Error on next question', { quizId, error: err.message });
      emitError(socket, 'SERVER_ERROR', 'Failed to advance question');
    }
  });

  // Pause quiz
  socket.on('pause_quiz', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    const state = activeQuizState.get(parseInt(quizId, 10));
    if (!state || state.paused) return;

    // Cancel timer
    if (activeTimers.has(parseInt(quizId, 10))) {
      clearTimeout(activeTimers.get(parseInt(quizId, 10)));
      activeTimers.delete(parseInt(quizId, 10));
    }

    const remainingMs = Math.max(0, new Date(state.endsAt) - Date.now());
    state.paused = true;
    state.remainingMs = remainingMs;
    activeQuizState.set(parseInt(quizId, 10), state);

    const quizRes = await query(`SELECT code FROM quizzes WHERE id = $1`, [quizId]);
    const quizCode = quizRes.rows[0].code;

    io.to(`quiz:${quizCode}`).emit('quiz_paused', { remainingMs });
    logger.info('Quiz paused', { quizId, remainingMs });
  });

  // Resume quiz
  socket.on('resume_quiz', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    const state = activeQuizState.get(parseInt(quizId, 10));
    if (!state || !state.paused) return;

    const newEndsAt = new Date(Date.now() + state.remainingMs);
    state.paused = false;
    state.endsAt = newEndsAt.toISOString();
    state.remainingMs = null;
    activeQuizState.set(parseInt(quizId, 10), state);

    // Update DB
    await query(`UPDATE questions SET ends_at = $1 WHERE id = $2`, [newEndsAt, state.questionId]);

    // Set new timer
    const timer = setTimeout(() => {
      handleQuestionEnd(io, parseInt(quizId, 10), state.questionId, state.quizCode);
    }, state.remainingMs);
    activeTimers.set(parseInt(quizId, 10), timer);

    const quizRes = await query(`SELECT code FROM quizzes WHERE id = $1`, [quizId]);
    const quizCode = quizRes.rows[0].code;

    io.to(`quiz:${quizCode}`).emit('quiz_resumed', { endsAt: newEndsAt.toISOString() });
    logger.info('Quiz resumed', { quizId, newEndsAt });
  });

  // End quiz
  socket.on('end_quiz', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    try {
      // Cancel any running timer
      if (activeTimers.has(parseInt(quizId, 10))) {
        clearTimeout(activeTimers.get(parseInt(quizId, 10)));
        activeTimers.delete(parseInt(quizId, 10));
      }
      activeQuizState.delete(parseInt(quizId, 10));

      await updateQuizStatus(quizId, 'COMPLETED');

      const quizRes = await query(`SELECT code FROM quizzes WHERE id = $1`, [quizId]);
      const quizCode = quizRes.rows[0].code;

      const finalResults = await getFinalResults(quizId);

      io.to(`quiz:${quizCode}`).emit('quiz_ended', {
        finalLeaderboard: finalResults.leaderboard.slice(0, 20), // top 20 for broadcast
        top3: finalResults.leaderboard.slice(0, 3),
      });

      // Send individual final ranks privately to each participant at the end of the quiz
      const participantsRes = await query(
        `SELECT p.id, p.session_id, s.rank, s.previous_rank, s.total_score, s.correct_answers, s.total_time_seconds, s.accuracy_percent
         FROM participants p
         JOIN scores s ON s.participant_id = p.id AND s.quiz_id = $1
         WHERE p.quiz_id = $1`,
        [quizId]
      );
      for (const p of participantsRes.rows) {
        io.to(`session:${p.session_id}`).emit('my_final_rank', p);
      }

      logger.info('Quiz ended', { quizId, quizCode });
    } catch (err) {
      logger.error('Error ending quiz', { quizId, error: err.message });
      emitError(socket, 'SERVER_ERROR', 'Failed to end quiz');
    }
  });

  // Restart current question (emergency)
  socket.on('restart_question', async ({ quizId, hostToken }) => {
    const auth = authorizeHost(socket, hostToken, quizId);
    if (!auth) return;

    try {
      const quiz = await getQuizById(quizId);
      if (!quiz) return emitError(socket, 'NOT_FOUND', 'Quiz not found');

      const questions = await getQuizQuestions(quizId);
      const quizRes = await query(`SELECT code FROM quizzes WHERE id = $1`, [quizId]);
      const quizCode = quizRes.rows[0].code;

      // Clear existing answers for this question
      const currentQ = questions[quiz.current_question_index];
      if (currentQ) {
        await query(`DELETE FROM answers WHERE question_id = $1`, [currentQ.id]);
      }

      await startQuestion(io, socket, quizId, quizCode, questions, quiz.current_question_index, hostToken);
    } catch (err) {
      logger.error('Error restarting question', { quizId, error: err.message });
      emitError(socket, 'SERVER_ERROR', 'Failed to restart question');
    }
  });
};

/**
 * Start a specific question by index
 * Sets DB timestamps, broadcasts to room, sets server timer
 */
const startQuestion = async (io, socket, quizId, quizCode, questions, index, hostToken) => {
  const q = questions[index];
  if (!q) return;

  // Cancel any existing timer
  if (activeTimers.has(parseInt(quizId, 10))) {
    clearTimeout(activeTimers.get(parseInt(quizId, 10)));
    activeTimers.delete(parseInt(quizId, 10));
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + q.duration_seconds * 1000);

  // Update DB with timing
  await query(
    `UPDATE questions SET started_at = $1, ends_at = $2 WHERE id = $3`,
    [now, endsAt, q.id]
  );
  await updateQuizStatus(quizId, 'LIVE', { currentQuestionIndex: index });

  // Store in-memory state for reconnection
  const state = {
    questionId: q.id,
    questionNumber: q.question_number,
    questionText: q.question_text,
    options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
    endsAt: endsAt.toISOString(),
    totalQuestions: questions.length,
    paused: false,
    quizCode,
  };
  activeQuizState.set(parseInt(quizId, 10), state);

  // Broadcast to general quiz room (participants, display)
  // NOTE: correct_answer is NOT included here — only sent after question_ended
  io.to(`quiz:${quizCode}`).emit('question_started', {
    questionId: q.id,
    questionNumber: q.question_number,
    questionText: q.question_text,
    options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
    endsAt: endsAt.toISOString(),
    durationSeconds: q.duration_seconds,
    totalQuestions: questions.length,
    points: q.points,
  });

  // Specifically emit to host with correctAnswer and live leaderboard with position movements
  const top10 = await getTopN(parseInt(quizId, 10), 10);
  io.to(`host:${quizId}`).emit('question_started', {
    questionId: q.id,
    questionNumber: q.question_number,
    questionText: q.question_text,
    options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
    correctAnswer: q.correct_answer,
    endsAt: endsAt.toISOString(),
    durationSeconds: q.duration_seconds,
    totalQuestions: questions.length,
    points: q.points,
    top10,
  });
  io.to(`host:${quizId}`).emit('live_leaderboard', { top10 });

  // Set server-authoritative timer
  const timer = setTimeout(() => {
    handleQuestionEnd(io, parseInt(quizId, 10), q.id, quizCode);
  }, q.duration_seconds * 1000);
  activeTimers.set(parseInt(quizId, 10), timer);

  logger.info('Question started', {
    quizId, quizCode, questionId: q.id,
    questionNumber: q.question_number, endsAt: endsAt.toISOString(),
  });
};

module.exports = { registerHostHandlers, handleQuestionEnd, activeQuizState, activeTimers };
