const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  certificateNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  publicVerificationToken: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  completionAwardKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  idempotencyKey: {
    type: String,
    index: true
  },
  
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true,
    index: true
  },
  programCode: {
    type: String,
    required: true
  },
  programTitle: {
    type: String,
    required: true
  },
  batchId: {
    type: String,
    required: true
  },
  
  // Frozen rendered snapshot
  renderedSnapshot: {
    recipientName: { type: String, required: true },
    programTitle: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    issueDate: { type: Date, required: true },
    authorizedSignatoryName: { type: String, required: true },
    authorizedSignatoryTitle: { type: String, required: true },
    templateVersion: { type: String, required: true, default: '1.0.0' }
  },
  
  status: {
    type: String,
    enum: ['DRAFT', 'APPROVED', 'GENERATING', 'ISSUED', 'FAILED', 'REVOKED', 'REPLACED'],
    default: 'APPROVED',
    index: true
  },
  
  fileStorage: {
    diskPath: { type: String },
    fileSizeBytes: { type: Number },
    sha256Checksum: { type: String },
    mimeType: { type: String, default: 'application/pdf' }
  },
  
  // Immutability & Replacement Chaining
  version: {
    type: Number,
    default: 1
  },
  revocationReason: {
    type: String
  },
  revokedAt: {
    type: Date
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  replacedByCertificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate'
  },
  supersedesCertificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  approvedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Certificate', CertificateSchema);
