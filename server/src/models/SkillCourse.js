const mongoose = require('mongoose');

const SkillCourseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  level: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], default: 'BEGINNER' },
  description: { type: String, required: true, trim: true },
  durationMinutes: { type: Number, required: true, min: 1 },
  passPercent: { type: Number, default: 60, min: 1, max: 100 },
  questionCount: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('SkillCourse', SkillCourseSchema);
