const mongoose = require('mongoose');

const QuizAttemptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  courseCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QuizQuestion' }],
  answers: { type: Map, of: Number, default: {} },
  // Questions whose feedback was shown to the student. A revealed answer is
  // locked: neither autosave nor submit may change it afterwards, so instant
  // feedback can never be used to improve the recorded score.
  revealed: { type: Map, of: Boolean, default: {} },
  startedAt: { type: Date, required: true, default: Date.now },
  deadlineAt: { type: Date, required: true },
  submittedAt: { type: Date, default: null },
  score: { type: Number, default: null },
  totalQuestions: { type: Number, default: null },
  scorePercent: { type: Number, default: null },
  passed: { type: Boolean, default: null },
  lateSubmit: { type: Boolean, default: false }
}, { timestamps: true });

// One open (unsubmitted) attempt per student per course
QuizAttemptSchema.index(
  { studentId: 1, courseCode: 1 },
  { unique: true, partialFilterExpression: { submittedAt: null } }
);

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
