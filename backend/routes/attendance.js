/**
 * Attendance Routes
 * POST /api/attendance        — Record attendance (from ESP32)
 * GET  /api/attendance        — Get attendance records
 * GET  /api/attendance/stats  — Get dashboard statistics
 * GET  /api/attendance/today  — Get today's attendance
 */

const express = require('express');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/attendance ─── Record Attendance (ESP32 endpoint) ───
router.post('/', async (req, res) => {
  try {
    const { fingerprintId: rawFp, status = 'present', device = 'ESP32-01' } = req.body;
    const fingerprintId = parseInt(String(rawFp), 10);

    if (Number.isNaN(fingerprintId) || fingerprintId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid fingerprint ID is required.',
      });
    }

    // Look up student by fingerprint ID
    const student = await Student.findOne({ fingerprintId, isActive: true });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No student found with fingerprint ID ${fingerprintId}.`,
      });
    }

    // Generate current date and time
    const now = new Date();
    const date = now.toISOString().split('T')[0];  // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0];  // HH:MM:SS

    // Check if attendance already recorded today
    const existingToday = await Attendance.findOne({
      fingerprintId,
      date,
    });

    if (existingToday) {
      return res.status(200).json({
        success: true,
        message: `Attendance already recorded for ${student.name} today.`,
        attendance: existingToday,
        alreadyMarked: true,
      });
    }

    // Create attendance record
    const attendance = new Attendance({
      studentId: student._id,
      name: student.name,
      fingerprintId,
      date,
      time,
      status,
      device,
    });

    await attendance.save();

    // Emit real-time event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('attendanceMarked', {
        ...attendance.toObject(),
        studentClass: student.class,
        roll: student.roll,
      });
    }

    console.log(`Attendance: ${student.name} (ID: ${fingerprintId}) at ${time}`);

    res.status(201).json({
      success: true,
      message: `Attendance recorded for ${student.name}.`,
      attendance,
    });

  } catch (error) {
    console.error('Attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record attendance.',
      error: error.message,
    });
  }
});

// ─── GET /api/attendance ─── Get Attendance Records ───
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      fingerprintId,
      studentId,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    let query = {};

    // Filter by specific date
    if (date) {
      query.date = date;
    }

    // Filter by date range
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    // Filter by fingerprint ID
    if (fingerprintId) {
      query.fingerprintId = parseInt(fingerprintId);
    }

    // Filter by student ID
    if (studentId) {
      query.studentId = studentId;
    }

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('studentId', 'class roll'),
      Attendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: records.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      records,
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records.',
    });
  }
});

// ─── GET /api/attendance/today ─── Today's Attendance ───
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const records = await Attendance.find({ date: today })
      .sort({ time: -1 })
      .populate('studentId', 'class roll');

    const totalStudents = await Student.countDocuments({ isActive: true });

    res.json({
      success: true,
      date: today,
      present: records.length,
      absent: totalStudents - records.length,
      total: totalStudents,
      records,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s attendance.',
    });
  }
});

// ─── GET /api/attendance/stats ─── Dashboard Statistics ───
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get counts
    const [
      totalStudents,
      todayPresent,
      totalRecords,
      last7DaysRecords,
    ] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Attendance.countDocuments({ date: today }),
      Attendance.countDocuments(),
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0],
            },
          },
        },
        {
          $group: {
            _id: '$date',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Recent attendance (last 10)
    const recentAttendance = await Attendance.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('studentId', 'class roll');

    res.json({
      success: true,
      stats: {
        totalStudents,
        todayPresent,
        todayAbsent: totalStudents - todayPresent,
        totalRecords,
        attendanceRate: totalStudents > 0
          ? Math.round((todayPresent / totalStudents) * 100)
          : 0,
        last7Days: last7DaysRecords,
      },
      recentAttendance,
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics.',
    });
  }
});

module.exports = router;
