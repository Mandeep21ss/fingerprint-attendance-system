/**
 * Student Model
 * Stores student info with unique fingerprint ID mapping
 */

const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  fingerprintId: {
    type: Number,
    required: [true, 'Fingerprint ID is required'],
    unique: true,
    min: [1, 'Fingerprint ID must be at least 1'],
    max: [127, 'Fingerprint ID cannot exceed 127'],
  },
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true,
  },
  roll: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,  // Adds createdAt and updatedAt
});

// `unique: true` on fingerprintId already creates an index,
// so we avoid defining the same index twice.
studentSchema.index({ class: 1, roll: 1 });

module.exports = mongoose.model('Student', studentSchema);
