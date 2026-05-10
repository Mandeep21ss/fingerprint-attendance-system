/**
 * Seed Script — Creates default admin account
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL || 'admin@attendance.com' });
    if (existing) {
      console.log('Admin already exists. Skipping seed.');
      process.exit(0);
    }

    const admin = new Admin({
      email: process.env.ADMIN_EMAIL || 'admin@attendance.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      name: 'System Administrator',
    });

    await admin.save();
    console.log('✅ Default admin created:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: (as set in .env or Admin@123)`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
