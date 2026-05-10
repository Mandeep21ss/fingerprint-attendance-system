/**
 * Authentication Routes
 * POST /api/auth/login  — Admin login
 * POST /api/auth/seed   — Create default admin (dev only)
 * GET  /api/auth/me     — Get current admin info
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/auth/login ─── Admin Login ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
});

// ─── POST /api/auth/seed ─── Create Default Admin ───
router.post('/seed', async (req, res) => {
  try {
    const existingAdmin = await Admin.findOne({ email: 'admin@attendance.com' });
    if (existingAdmin) {
      return res.json({
        success: true,
        message: 'Admin already exists.',
      });
    }

    const admin = new Admin({
      email: process.env.ADMIN_EMAIL || 'admin@attendance.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      name: 'System Administrator',
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Default admin created successfully.',
      credentials: {
        email: admin.email,
        password: '(as set in .env)',
      },
    });

  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin.',
    });
  }
});

// ─── GET /api/auth/me ─── Get Current Admin ───
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found.',
      });
    }

    res.json({
      success: true,
      admin,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

module.exports = router;
