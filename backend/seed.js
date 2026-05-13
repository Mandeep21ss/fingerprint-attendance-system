/**
 * Seed Script — Creates default admin account
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const seed = async () => {
  try {
    if (!process.env.MONGO_URI || !String(process.env.MONGO_URI).trim()) {
      console.error('MONGO_URI is required. Copy .env.example to .env and set MONGO_URI.');
      process.exit(1);
    }
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required in .env');
      process.exit(1);
    }

    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (existing) {
      console.log('Admin already exists. Skipping seed.');
      process.exit(0);
    }

    const admin = new Admin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: 'System Administrator',
    });

    await admin.save();
    console.log('✅ Default admin created successfully');
    console.log(`   Email: ${admin.email}`);
    console.log('   Password: (as configured in .env)');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
