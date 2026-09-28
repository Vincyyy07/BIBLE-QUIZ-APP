require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initializeSocket } = require('./socket');
const quizRoutes = require('./routes/quizRoutes');
const questionRoutes = require('./routes/questionRoutes');
const authRoutes = require('./routes/authRoutes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { pool } = require('./models/db');
const logger = require('./utils/logger');

const os = require('os');
const app = express();
const httpServer = http.createServer(app);

// Helper to determine the host machine's LAN IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Trust reverse proxy (Railway edge)
app.set('trust proxy', 1);

// ── Middleware ──────────────────────────────────────────────
// Allow requests from all origins (Railway client domain, localhost, mobile devices)
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
app.options('*', cors());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging for production visibility in Railway
app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.originalUrl}`);
  next();
});

app.use('/api', apiLimiter);

// ── Network Info Endpoint for QR code generation ──────────
const networkHandler = (req, res) => {
  const ip = getLocalIpAddress();
  res.json({
    ip,
    port: 5173,
    joinUrl: `http://${ip}:5173/join`,
  });
};
app.get('/api/network-info', networkHandler);
app.get('/network-info', networkHandler);

// ── Routes (Flexible prefixes to handle /api, root, and double /api/api) ────
app.use(['/api/auth', '/auth', '/api/api/auth'], authRoutes);
app.use(['/api/quizzes', '/quizzes', '/api/api/quizzes'], quizRoutes);
app.use(['/api/questions', '/questions', '/api/api/questions'], questionRoutes);

const healthHandler = async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// 404 handler with detailed error info
app.use((req, res) => {
  logger.warn(`404 Route Not Found: [${req.method}] ${req.originalUrl}`);
  res.status(404).json({
    error: `Route not found: [${req.method}] ${req.originalUrl}`,
    hint: 'Check requested path and HTTP method.'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.originalUrl });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Socket.IO ───────────────────────────────────────────────
const io = initializeSocket(httpServer);

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info(`Bible Quiz Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    pool.end();
    process.exit(0);
  });
});

module.exports = { app, httpServer };
