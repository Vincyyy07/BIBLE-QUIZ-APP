const { Server } = require('socket.io');
const { registerHostHandlers, recoverActiveQuizzes } = require('./hostHandlers');
const { registerPlayerHandlers } = require('./playerHandlers');
const logger = require('../utils/logger');

/**
 * Initialize Socket.IO server with all handlers
 * @param {http.Server} httpServer
 * @param {string} clientUrl - CORS origin
 */
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Optimize for 200 concurrent connections
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    transports: ['websocket', 'polling'],
    // Reduce per-message overhead
    perMessageDeflate: {
      threshold: 1024,
    },
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id, ip: socket.handshake.address });

    // Register both host and player handlers on every connection
    // Authorization is enforced per-event inside each handler
    registerHostHandlers(io, socket);
    registerPlayerHandlers(io, socket);

    // Display mode: join the display room for a quiz
    socket.on('display_join', async ({ quizCode }) => {
      if (!quizCode) return;
      socket.join(`quiz:${quizCode.toUpperCase()}`);
      socket.join(`display:${quizCode.toUpperCase()}`);
      logger.info('Display joined', { quizCode, socketId: socket.id });
    });
  });

  // Automatically restore active quizzes & timers across server restarts (Railway)
  recoverActiveQuizzes(io);

  return io;
};

module.exports = { initializeSocket };
