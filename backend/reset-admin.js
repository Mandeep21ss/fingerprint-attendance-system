/**
 * Reset Admin Script — Delete all admins and create fresh one
 * Run: node reset-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const resetAdmin = async () => {
  try {
    if (!process.env.MONGO_URI || !String(process.env.MONGO_URI).trim()) {
      console.error('❌ MONGO_URI is required. Check your .env file.');
      process.exit(1);
    }

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD are required in .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Delete all existing admins
    const deleteResult = await Admin.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing admin(s)`);

    // Create new admin
    const admin = new Admin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      name: 'System Administrator',
    });

    await admin.save();
    console.log('✅ Fresh admin created successfully');
    console.log(`   Email: ${admin.email}`);
    console.log('   Password: (as configured in .env)');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset error:', error.message);
    process.exit(1);
  }
};

resetAdmin();
