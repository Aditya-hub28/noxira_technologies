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
  },
  category: {
    type: String,
    trim: true,
    enum: ['Development', 'Programming', 'AI & Data Science', 'Design', 'Business', 'Engineering']
  },
  durationWeeks: {
    type: Number
  },
  feeInr: {
    type: Number
  },
  seats: {
    type: Number
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  syllabus: {
    type: [String]
  },
  tasks: {
    type: [String]
  },
  learningMaterials: {
    type: [String]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Program', ProgramSchema);
