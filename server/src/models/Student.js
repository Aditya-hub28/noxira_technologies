const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 120
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  emailVerifyCodeHash: {
    type: String,
    default: null
  },
  emailVerifyExpiresAt: {
    type: Date,
    default: null
  },
  emailVerifyAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

StudentSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

StudentSchema.statics.hashPassword = async function(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

module.exports = mongoose.model('Student', StudentSchema);
