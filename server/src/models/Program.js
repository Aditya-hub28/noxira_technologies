const mongoose = require('mongoose');

const ProgramSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  defaultBatch: {
    type: String,
    default: 'BATCH-2026-Q4'
  },
  defaultStartDate: {
    type: Date,
    default: Date.now
  },
  defaultEndDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Program', ProgramSchema);
