/**
 * Change Admin Password Script
 * Run: node change-password.js <new-password>
 * Example: node change-password.js MyNewPassword@123
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const changePassword = async () => {
  try {
    const newPassword = process.argv[2];

    if (!newPassword) {
      console.error('❌ Please provide a new password');
      console.error('Usage: node change-password.js <new-password>');
      process.exit(1);
    }

    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI is required in .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const admin = await Admin.findOne({ email: process.env.ADMIN_EMAIL || 'mandeepkafle@attendance.com' });
    
    if (!admin) {
      console.error('❌ Admin not found');
      process.exit(1);
    }

    admin.password = newPassword;
    await admin.save();

    console.log('✅ Password changed successfully');
    console.log(`   Email: ${admin.email}`);
    console.log(`   New Password: ${newPassword}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

changePassword();
