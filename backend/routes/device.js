/**
 * Device Control Routes
 * Controls ESP32 mode AND commands remotely from the web dashboard
 *
 * POST /api/device/mode    — Set device mode (enroll/attend)
 * GET  /api/device/mode    — Get current mode + pending command (polled by ESP32)
 * POST /api/device/command — Queue a command (delete/count/empty)
 * POST /api/device/ack     — ESP32 acknowledges command result
 * GET  /api/device/status  — Get full device status info
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ─── In-memory device state ───
// (persists while server is running; resets to 'attend' on restart)
let deviceState = {
  mode: 'attend',            // 'attend' or 'enroll'
  enrollId: null,             // fingerprint ID to enroll (1-127)
  enrollName: '',             // student name for reference
  lastPollTime: null,         // last time ESP32 polled
  lastAttendanceTime: null,   // last attendance timestamp
  isOnline: false,            // true if ESP32 polled recently
  commandAck: true,           // true if ESP32 acknowledged last command
  pendingCommand: null,       // { type: 'delete'|'count'|'empty', id?: number }
  lastCommandResult: null,    // { type, status, message, data, timestamp }
  sensorInfo: null,           // { count, capacity } from last count command
};

// ─── POST /api/device/mode ─── Set Mode (from frontend) ───
router.post('/mode', authMiddleware, (req, res) => {
  const { mode, enrollId, enrollName } = req.body;

  if (!mode || !['attend', 'enroll'].includes(mode)) {
    return res.status(400).json({
      success: false,
      message: 'Mode must be "attend" or "enroll".',
    });
  }

  if (mode === 'enroll') {
    if (!enrollId || enrollId < 1 || enrollId > 127) {
      return res.status(400).json({
        success: false,
        message: 'Enroll mode requires enrollId (1-127).',
      });
    }
  }

  deviceState.mode = mode;
  deviceState.enrollId = mode === 'enroll' ? parseInt(enrollId) : null;
  deviceState.enrollName = enrollName || '';
  deviceState.commandAck = false;

  // Notify frontend via Socket.io
  const io = req.app.get('io');
  if (io) {
    io.emit('deviceModeChanged', {
      mode: deviceState.mode,
      enrollId: deviceState.enrollId,
      enrollName: deviceState.enrollName,
    });
  }

  console.log(`Device mode: ${mode}${mode === 'enroll' ? ` (ID #${enrollId})` : ''}`);

  res.json({
    success: true,
    message: `Mode set to ${mode}${mode === 'enroll' ? ` for ID #${enrollId}` : ''}.`,
    device: deviceState,
  });
});

// ─── POST /api/device/command ─── Queue a command for ESP32 ───
router.post('/command', authMiddleware, (req, res) => {
  const { type, id } = req.body;

  const validCommands = ['delete', 'count', 'empty'];
  if (!type || !validCommands.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Command type must be one of: ${validCommands.join(', ')}.`,
    });
  }

  if (type === 'delete') {
    if (!id || id < 1 || id > 127) {
      return res.status(400).json({
        success: false,
        message: 'Delete command requires id (1-127).',
      });
    }
  }

  // Don't allow commands while enrolling
  if (deviceState.mode === 'enroll') {
    return res.status(409).json({
      success: false,
      message: 'Cannot run commands while enrollment is in progress.',
    });
  }

  // Don't queue if device is offline
  if (!deviceState.isOnline) {
    return res.status(503).json({
      success: false,
      message: 'ESP32 device is offline. Command cannot be delivered.',
    });
  }

  deviceState.pendingCommand = { type, id: id ? parseInt(id) : null };
  deviceState.lastCommandResult = null;
  deviceState.commandAck = false;

  // Notify frontend that command was queued
  const io = req.app.get('io');
  if (io) {
    io.emit('deviceCommandQueued', { type, id });
  }

  console.log(`Device command queued: ${type}${id ? ` (ID #${id})` : ''}`);

  res.json({
    success: true,
    message: `Command '${type}' queued. ESP32 will execute on next poll.`,
  });
});

// ─── GET /api/device/mode ─── Get Mode + Pending Command (polled by ESP32) ───
router.get('/mode', (req, res) => {
  // Update poll time and online status
  deviceState.lastPollTime = new Date().toISOString();
  deviceState.isOnline = true;

  // Notify frontend that ESP32 is online
  const io = req.app.get('io');
  if (io) {
    io.emit('deviceStatus', {
      isOnline: true,
      lastPollTime: deviceState.lastPollTime,
    });
  }

  const response = {
    mode: deviceState.mode,
    enrollId: deviceState.enrollId,
    enrollName: deviceState.enrollName,
  };

  // Include pending command if any — ESP32 picks it up and executes
  if (deviceState.pendingCommand) {
    response.command = deviceState.pendingCommand;
    // Clear after sending so it only runs once
    deviceState.pendingCommand = null;
  }

  res.json(response);
});

// ─── POST /api/device/ack ─── ESP32 acknowledges command result ───
router.post('/ack', (req, res) => {
  const { mode, status, message, data } = req.body;

  deviceState.commandAck = true;

  // On enrollment complete/failed: clear the current enrollment target
  // but DON'T switch mode — user controls mode manually from the web
  if (status === 'enroll_complete' || status === 'enroll_failed') {
    deviceState.enrollId = null;
    deviceState.enrollName = '';
  }

  // Store command result for status endpoint
  deviceState.lastCommandResult = {
    status,
    message,
    data: data || null,
    timestamp: new Date().toISOString(),
  };

  // Update sensor info on count result
  if (status === 'count_result' && data !== undefined) {
    deviceState.sensorInfo = {
      ...(deviceState.sensorInfo || {}),
      count: parseInt(data),
      lastUpdated: new Date().toISOString(),
    };
  }

  // Clear sensor count on empty
  if (status === 'empty_complete') {
    deviceState.sensorInfo = {
      ...(deviceState.sensorInfo || {}),
      count: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Notify frontend with full result
  const io = req.app.get('io');
  if (io) {
    io.emit('deviceAck', {
      mode,
      status,
      message: message || `ESP32: ${status}`,
      data: data || null,
    });
  }

  console.log(`ESP32 ACK: ${status} — ${message || ''}`);

  res.json({ success: true });
});

// ─── GET /api/device/status ─── Full device status ───
router.get('/status', authMiddleware, (req, res) => {
  // Check if ESP32 has polled in last 10 seconds
  if (deviceState.lastPollTime) {
    const lastPoll = new Date(deviceState.lastPollTime).getTime();
    deviceState.isOnline = (Date.now() - lastPoll) < 10000;
  }

  res.json({
    success: true,
    device: deviceState,
  });
});

module.exports = router;
