/**
 * ══════════════════════════════════════════════════════════
 *  Fingerprint Attendance System — Express Server
 * ══════════════════════════════════════════════════════════
 *  Features:
 *    • REST API for ESP32, students, attendance
 *    • Socket.io for real-time attendance updates
 *    • JWT authentication for admin routes
 *    • MongoDB via Mongoose
 *    • CORS support
 * ══════════════════════════════════════════════════════════
 */

require('dotenv').config();

const express  = require('express');
const http     = require('http');
const cors     = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// ─── Initialize Express ───
const app    = express();
const server = http.createServer(app);

// ─── Socket.io Setup ───
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in routes via req.app.get('io')
app.set('io', io);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// ─── API Routes ───
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/students',   require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/device',     require('./routes/device'));

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Fingerprint Attendance API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found.`,
  });
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ─── Start Server ───
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  server.listen(PORT, () => {
    console.log();
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  Fingerprint Attendance System Backend   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  🚀 Server  : http://localhost:${PORT}       ║`);
    console.log(`║  📡 Socket  : ws://localhost:${PORT}         ║`);
    console.log(`║  🌐 Mode    : ${(process.env.NODE_ENV || 'development').padEnd(22)}║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log();
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
