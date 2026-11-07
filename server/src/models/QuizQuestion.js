const mongoose = require('mongoose');

const QuizQuestionSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  question: { type: String, required: true, trim: true },
  options: {
    type: [String],
    validate: {
      validator: (v) => Array.isArray(v) && v.length === 4 && v.every(o => typeof o === 'string' && o.trim().length > 0),
      message: 'Every question must have exactly 4 non-empty options.'
    },
    required: true
  },
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('QuizQuestion', QuizQuestionSchema);
