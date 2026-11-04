const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  normalizedName: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  normalizedEmail: {
    type: String,
    required: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  programCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  programTitle: {
    type: String,
    required: true,
    trim: true
  },
  batchId: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  source: {
    type: String,
    enum: ['WEBSITE', 'CSV_IMPORT'],
    required: true,
    default: 'WEBSITE'
  },
  sourceImportBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImportBatch'
  },
  
  // Completion Gate (Registration NEVER auto-issues)
  completionStatus: {
    type: String,
    enum: ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'REWORK'],
    default: 'PENDING',
    index: true
  },
  completionEvidence: {
    type: String,
    trim: true
  },
  completionReviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  completionReviewedAt: {
    type: Date
  },
  
  // Issuance State
  isIssued: {
    type: Boolean,
    default: false,
    index: true
  },
  activeCertificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate'
  }
}, {
  timestamps: true
});

// Compound unique key: One participant per email per program per batch
ParticipantSchema.index({ normalizedEmail: 1, programCode: 1, batchId: 1 }, { unique: true });

ParticipantSchema.pre('validate', function(next) {
  if (this.fullName) {
    this.normalizedName = this.fullName.toLowerCase().trim();
  }
  if (this.email) {
    this.normalizedEmail = this.email.toLowerCase().trim();
  }
  next();
});

module.exports = mongoose.model('Participant', ParticipantSchema);
