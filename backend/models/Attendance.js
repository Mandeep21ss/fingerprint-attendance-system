/**
 * Attendance Model
 * Records each attendance event with student reference
 */

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  fingerprintId: {
    type: Number,
    required: [true, 'Fingerprint ID is required'],
  },
  date: {
    type: String,
    required: true,
    // Format: YYYY-MM-DD
  },
  time: {
    type: String,
    required: true,
    // Format: HH:MM:SS
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent'],
    default: 'present',
  },
  device: {
    type: String,
    default: 'ESP32-01',
  },
}, {
  timestamps: true,
});

// Index for date-based queries
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ fingerprintId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
