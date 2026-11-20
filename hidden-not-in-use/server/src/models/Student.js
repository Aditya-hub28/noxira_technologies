const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [80, 'Name cannot exceed 80 characters']
  },
  email: {
    type: String,
    required: [true, 'Student email is required'],
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
  resetOtpHash: {
    type: String
  },
  resetOtpExpiresAt: {
    type: Date
  },
  resetOtpAttempts: {
    type: Number,
    default: 0
  },
  resetOtpSentAt: {
    type: Date
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

// Ensure sensitive fields are never returned in JSON/Object conversions
StudentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.resetOtpHash;
    delete ret.resetOtpExpiresAt;
    delete ret.resetOtpAttempts;
    delete ret.resetOtpSentAt;
    return ret;
  }
});

StudentSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.resetOtpHash;
    delete ret.resetOtpExpiresAt;
    delete ret.resetOtpAttempts;
    delete ret.resetOtpSentAt;
    return ret;
  }
});

module.exports = mongoose.model('Student', StudentSchema);
