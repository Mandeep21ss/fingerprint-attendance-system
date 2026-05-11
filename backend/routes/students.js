/**
 * Student Routes
 * POST   /api/students     — Add new student
 * GET    /api/students     — Get all students
 * GET    /api/students/:id — Get single student
 * PUT    /api/students/:id — Update student
 * DELETE /api/students/:id — Delete student
 */

const express = require('express');
const Student = require('../models/Student');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/students ─── Add New Student ───
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, fingerprintId: rawFpId, class: studentClass, roll, email } = req.body;
    const fingerprintId = parseInt(String(rawFpId), 10);

    // Validation
    if (!name || Number.isNaN(fingerprintId) || !studentClass || !roll) {
      return res.status(400).json({
        success: false,
        message: 'Name, fingerprintId (1–127), class, and roll are required.',
      });
    }

    if (fingerprintId < 1 || fingerprintId > 127) {
      return res.status(400).json({
        success: false,
        message: 'fingerprintId must be between 1 and 127.',
      });
    }

    // Check for duplicate fingerprint ID
    const existing = await Student.findOne({ fingerprintId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Fingerprint ID ${fingerprintId} is already assigned to ${existing.name}.`,
      });
    }

    const student = new Student({
      name,
      fingerprintId,
      class: studentClass,
      roll,
      email,
    });

    await student.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('studentAdded', student);
    }

    res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      student,
    });

  } catch (error) {
    console.error('Add student error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate fingerprint ID.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add student.',
      error: error.message,
    });
  }
});

// ─── GET /api/students ─── Get All Students ───
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, class: filterClass, active } = req.query;

    // Build query
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { roll: { $regex: search, $options: 'i' } },
      ];
    }

    if (filterClass) {
      query.class = filterClass;
    }

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const students = await Student.find(query)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: students.length,
      students,
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students.',
    });
  }
});

// ─── GET /api/students/:id ─── Get Single Student ───
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    res.json({
      success: true,
      student,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student.',
    });
  }
});

// ─── PUT /api/students/:id ─── Update Student ───
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, fingerprintId: rawFp, class: studentClass, roll, email, isActive } = req.body;
    const fingerprintId =
      rawFp === undefined || rawFp === null || rawFp === ''
        ? undefined
        : parseInt(String(rawFp), 10);

    // Check fingerprint ID uniqueness if being changed
    if (fingerprintId !== undefined) {
      if (Number.isNaN(fingerprintId) || fingerprintId < 1 || fingerprintId > 127) {
        return res.status(400).json({
          success: false,
          message: 'fingerprintId must be between 1 and 127.',
        });
      }
      const existing = await Student.findOne({
        fingerprintId,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Fingerprint ID ${fingerprintId} is already assigned to ${existing.name}.`,
        });
      }
    }

    const updates = { name, class: studentClass, roll, email, isActive };
    if (fingerprintId !== undefined) {
      updates.fingerprintId = fingerprintId;
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('studentUpdated', student);
    }

    res.json({
      success: true,
      message: 'Student updated successfully.',
      student,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update student.',
      error: error.message,
    });
  }
});

// ─── DELETE /api/students/:id ─── Delete Student ───
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('studentDeleted', { id: req.params.id });
    }

    res.json({
      success: true,
      message: 'Student deleted successfully.',
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete student.',
    });
  }
});

module.exports = router;
