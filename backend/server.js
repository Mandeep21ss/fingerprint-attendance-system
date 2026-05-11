/**
 * Fingerprint Attendance API — Express + Socket.io + MongoDB
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { getAllowedOrigins, corsOriginCallback } = require('./utils/corsOrigins');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

// Fail fast in production (and early in dev) so Render does not boot a broken API
requireEnv('MONGO_URI');
requireEnv('JWT_SECRET');

const app = express();
const server = http.createServer(app);

const socketCorsOrigins = getAllowedOrigins();

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigins.length === 1 ? socketCorsOrigins[0] : socketCorsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

app.use(cors({
  origin: corsOriginCallback,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/device', require('./routes/device'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Fingerprint Attendance API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found.`,
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    const mode = process.env.NODE_ENV || 'development';
    console.log(`Fingerprint Attendance API listening on port ${PORT} (${mode})`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
