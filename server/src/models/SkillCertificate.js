const mongoose = require('mongoose');
const crypto = require('crypto');

const SkillCertificateSchema = new mongoose.Schema({
  certificateNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  verificationToken: { type: String, required: true, unique: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt', required: true, unique: true },
  courseCode: { type: String, required: true, uppercase: true },
  studentName: { type: String, required: true },
  courseTitle: { type: String, required: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  scorePercent: { type: Number, required: true },
  issuedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

// One skill certificate per student per course (first pass wins; retakes do not reissue)
SkillCertificateSchema.index({ studentId: 1, courseCode: 1 }, { unique: true });

module.exports = mongoose.model('SkillCertificate', SkillCertificateSchema);
