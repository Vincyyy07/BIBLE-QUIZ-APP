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

// ── Middleware ──────────────────────────────────────────────
// Allow requests from localhost and phones connected to the same Wi-Fi/LAN
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

// ── Network Info Endpoint for QR code generation ──────────
app.get('/api/network-info', (req, res) => {
  const ip = getLocalIpAddress();
  res.json({
    ip,
    port: 5173,
    joinUrl: `http://${ip}:5173/join`,
  });
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/questions', questionRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
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
