const { query } = require('../models/db');
const { getQuizByCode } = require('../services/quizService');
const { getParticipantRank } = require('../services/leaderboardService');
const { activeQuizState, handleQuestionEnd } = require('./hostHandlers');
const logger = require('../utils/logger');

const emitError = (socket, code, message) => socket.emit('error', { code, message });

/**
 * Validate participant name
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
};

/**
 * Validate quiz code format
 */
const validateCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9]{4,10}$/.test(code.toUpperCase());
};

/**
 * Register participant socket event handlers
 */
const registerPlayerHandlers = (io, socket) => {

  // Join quiz
  socket.on('join_quiz', async ({ quizCode, name, sessionId }) => {
    if (!validateCode(quizCode)) return emitError(socket, 'INVALID_CODE', 'Invalid quiz code format');
    if (!validateName(name)) return emitError(socket, 'INVALID_NAME', 'Name must be 1–100 characters');
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 128) {
      return emitError(socket, 'INVALID_SESSION', 'Invalid session ID');
    }

    const code = quizCode.toUpperCase();
    const playerName = name.trim();

    try {
      const quiz = await getQuizByCode(code);

      if (!quiz) return emitError(socket, 'QUIZ_NOT_FOUND', 'Quiz not found. Check the code and try again.');

      if (quiz.status === 'COMPLETED') {
        return emitError(socket, 'QUIZ_COMPLETED', 'This quiz has already ended.');
      }
      if (!['WAITING', 'DRAFT'].includes(quiz.status) && quiz.status !== 'LIVE' && quiz.status !== 'QUESTION_ENDED') {
        return emitError(socket, 'QUIZ_NOT_ACCEPTING', 'This quiz is not accepting participants.');
      }

      // Check if session already exists (reconnect path)
      const existingRes = await query(
        `SELECT id, name FROM participants WHERE session_id = $1 AND quiz_id = $2`,
        [sessionId, quiz.id]
      );

      let participant;
      if (existingRes.rows.length > 0) {
        // Reconnection: update connection status
        participant = existingRes.rows[0];
        await query(
          `UPDATE participants SET connected = true, last_seen_at = NOW() WHERE id = $1`,
          [participant.id]
        );
        logger.info('Participant reconnected', { participantId: participant.id, quizId: quiz.id });
      } else {
        // New participant
        if (!['WAITING', 'DRAFT'].includes(quiz.status)) {
          return emitError(socket, 'QUIZ_STARTED', 'This quiz has already started and is no longer accepting new participants.');
        }

        const newP = await query(
          `INSERT INTO participants (quiz_id, session_id, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (quiz_id, session_id) DO UPDATE
             SET name = EXCLUDED.name, connected = true, last_seen_at = NOW()
           RETURNING id, name`,
          [quiz.id, sessionId, playerName]
        );
        participant = newP.rows[0];
        logger.info('Participant joined', { participantId: participant.id, name: playerName, quizId: quiz.id });
      }

      // Store metadata on socket for later use
      socket.participantId = participant.id;
      socket.sessionId = sessionId;
      socket.quizId = quiz.id;
      socket.quizCode = code;

      // Join room
      socket.join(`quiz:${code}`);
      socket.join(`session:${sessionId}`);

      // Get participant count
      const countRes = await query(
        `SELECT COUNT(*) as count FROM participants WHERE quiz_id = $1`,
        [quiz.id]
      );
      const count = parseInt(countRes.rows[0].count, 10);

      // Notify participant they're in
      socket.emit('joined', {
        participantId: participant.id,
        name: participant.name,
        quizTitle: quiz.title,
        quizStatus: quiz.status,
        count,
      });

      // Notify host + display of participant count
      io.to(`host:${quiz.id}`).emit('participant_count', { count });
      io.to(`quiz:${code}`).emit('participant_joined', { count, name: participant.name });

      // If quiz is already live, send current question state
      const state = activeQuizState.get(quiz.id);
      if (state && !state.paused) {
        const remaining = new Date(state.endsAt) - Date.now();
        if (remaining > 0) {
          socket.emit('question_started', {
            questionId: state.questionId,
            questionNumber: state.questionNumber,
            questionText: state.questionText,
            options: state.options,
            endsAt: state.endsAt,
            durationSeconds: Math.floor(remaining / 1000),
            totalQuestions: state.totalQuestions,
          });
        }
      }
    } catch (err) {
      logger.error('Error in join_quiz', { error: err.message, sessionId });
      emitError(socket, 'SERVER_ERROR', 'An error occurred. Please try again.');
    }
  });

  // Submit answer
  socket.on('submit_answer', async ({ quizCode, questionId, selectedOption, sessionId }) => {
    // Validate inputs
    if (!socket.participantId || !socket.quizId) {
      return emitError(socket, 'NOT_JOINED', 'You are not in a quiz. Please rejoin.');
    }
    if (!['A', 'B', 'C', 'D'].includes(String(selectedOption).toUpperCase())) {
      return emitError(socket, 'INVALID_OPTION', 'Invalid answer option.');
    }

    const option = selectedOption.toUpperCase();

    try {
      // 1. Check active question in memory first for zero-latency validation
      const state = activeQuizState.get(socket.quizId);
      let endsAt = state?.currentQuestion?.ends_at;

      if (!endsAt) {
        // Fallback to database if memory state is missing
        const qRes = await query(
          `SELECT q.status, qu.ends_at 
           FROM quizzes q 
           JOIN questions qu ON qu.quiz_id = q.id 
           WHERE q.id = $1 AND qu.id = $2`,
          [socket.quizId, questionId]
        );
        if (!qRes.rows[0]) {
          return emitError(socket, 'INVALID_QUESTION', 'Invalid question ID.');
        }
        if (qRes.rows[0].status !== 'LIVE') {
          return emitError(socket, 'NOT_LIVE', 'Quiz is not currently active.');
        }
        endsAt = qRes.rows[0].ends_at;
      }

      // 2. Server-authoritative time check
      if (new Date() > new Date(endsAt)) {
        return emitError(socket, 'TIME_UP', "Time's up. Your answer was not recorded.");
      }

      // 3. Atomically store answer and detect duplicates in 1 single query
      const insertRes = await query(
        `INSERT INTO answers (quiz_id, question_id, participant_id, selected_answer, submitted_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (question_id, participant_id) DO NOTHING
         RETURNING id`,
        [socket.quizId, questionId, socket.participantId, option]
      );

      if (insertRes.rows.length === 0) {
        return emitError(socket, 'ALREADY_ANSWERED', 'You have already submitted an answer.');
      }

      // 6. Acknowledge to participant
      socket.emit('answer_accepted', {
        questionId,
        selectedOption: option,
        message: 'Answer submitted!',
      });

      logger.info('Answer submitted', {
        participantId: socket.participantId,
        questionId,
        option,
        quizId: socket.quizId,
      });

      // 7. Check if all participants in this quiz have answered and get live option distribution
      const answersCountRes = await query(
        `SELECT
           COUNT(DISTINCT participant_id) as count,
           COUNT(*) FILTER (WHERE selected_answer = 'A') as count_a,
           COUNT(*) FILTER (WHERE selected_answer = 'B') as count_b,
           COUNT(*) FILTER (WHERE selected_answer = 'C') as count_c,
           COUNT(*) FILTER (WHERE selected_answer = 'D') as count_d
         FROM answers WHERE question_id = $1`,
        [questionId]
      );
      const answeredCount = parseInt(answersCountRes.rows[0].count, 10);

      const totalParticipantsRes = await query(
        `SELECT COUNT(*) as count FROM participants WHERE quiz_id = $1`,
        [socket.quizId]
      );
      const totalCount = parseInt(totalParticipantsRes.rows[0].count, 10);

      // Broadcast progress and live option distribution to host
      io.to(`host:${socket.quizId}`).emit('answers_progress', {
        questionId,
        answeredCount,
        totalCount,
        optionCounts: {
          A: parseInt(answersCountRes.rows[0].count_a, 10) || 0,
          B: parseInt(answersCountRes.rows[0].count_b, 10) || 0,
          C: parseInt(answersCountRes.rows[0].count_c, 10) || 0,
          D: parseInt(answersCountRes.rows[0].count_d, 10) || 0,
        },
        allAnswered: totalCount > 0 && answeredCount >= totalCount,
      });

      // If all participants have answered, stop timer immediately and close question
      if (totalCount > 0 && answeredCount >= totalCount) {
        logger.info('All participants have answered! Stopping timer early', {
          quizId: socket.quizId,
          questionId,
          answeredCount,
          totalCount,
        });
        await handleQuestionEnd(io, socket.quizId, questionId, socket.quizCode, true);
      }
    } catch (err) {
      logger.error('Error submitting answer', { error: err.message, participantId: socket.participantId });
      emitError(socket, 'SERVER_ERROR', 'Failed to submit answer. Please try again.');
    }
  });

  // Reconnect session (called when client detects session_id in localStorage)
  socket.on('reconnect_session', async ({ quizCode, sessionId }) => {
    if (!validateCode(quizCode) || !sessionId) return;

    const code = quizCode.toUpperCase();
    try {
      const quiz = await getQuizByCode(code);
      if (!quiz) return emitError(socket, 'QUIZ_NOT_FOUND', 'Quiz not found.');

      const pRes = await query(
        `SELECT id, name FROM participants WHERE session_id = $1 AND quiz_id = $2`,
        [sessionId, quiz.id]
      );
      if (!pRes.rows[0]) {
        // Session not found — must join fresh
        return emitError(socket, 'SESSION_NOT_FOUND', 'Session expired. Please join again.');
      }

      const participant = pRes.rows[0];
      await query(
        `UPDATE participants SET connected = true, last_seen_at = NOW() WHERE id = $1`,
        [participant.id]
      );

      socket.participantId = participant.id;
      socket.sessionId = sessionId;
      socket.quizId = quiz.id;
      socket.quizCode = code;

      socket.join(`quiz:${code}`);
      socket.join(`session:${sessionId}`);

      // Get current score
      const scoreRes = await getParticipantRank(quiz.id, participant.id);

      // Build restoration state
      const state = activeQuizState.get(quiz.id);
      const restorationPayload = {
        participantId: participant.id,
        name: participant.name,
        quizTitle: quiz.title,
        quizStatus: quiz.status,
        score: scoreRes,
        currentState: state || null,
      };

      socket.emit('session_restored', restorationPayload);

      // If question is live, resend it
      if (state && !state.paused) {
        const remaining = new Date(state.endsAt) - Date.now();
        if (remaining > 0) {
          // Check if already answered
          const answeredRes = await query(
            `SELECT selected_answer FROM answers WHERE question_id = $1 AND participant_id = $2`,
            [state.questionId, participant.id]
          );
          socket.emit('question_started', {
            questionId: state.questionId,
            questionNumber: state.questionNumber,
            questionText: state.questionText,
            options: state.options,
            endsAt: state.endsAt,
            durationSeconds: Math.ceil(remaining / 1000),
            totalQuestions: state.totalQuestions,
            alreadyAnswered: answeredRes.rows[0]?.selected_answer || null,
          });
        }
      }

      logger.info('Session restored', { participantId: participant.id, quizId: quiz.id });
    } catch (err) {
      logger.error('Error restoring session', { error: err.message, sessionId });
      emitError(socket, 'SERVER_ERROR', 'Failed to restore session.');
    }
  });

  // Handle disconnect
  socket.on('disconnect', async (reason) => {
    if (socket.participantId) {
      try {
        await query(
          `UPDATE participants SET connected = false, last_seen_at = NOW() WHERE id = $1`,
          [socket.participantId]
        );
        logger.info('Participant disconnected', {
          participantId: socket.participantId,
          reason,
          quizId: socket.quizId,
        });

        // Update host of new count
        if (socket.quizId) {
          const countRes = await query(
            `SELECT COUNT(*) as count FROM participants WHERE quiz_id = $1 AND connected = true`,
            [socket.quizId]
          );
          io.to(`host:${socket.quizId}`).emit('participant_count', {
            count: parseInt(countRes.rows[0].count, 10),
          });
        }
      } catch (err) {
        logger.error('Error handling disconnect', { error: err.message });
      }
    }
  });
};

module.exports = { registerPlayerHandlers };
