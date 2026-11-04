const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false // May be null for public intake
  },
  actorType: {
    type: String,
    enum: ['ADMIN', 'SYSTEM', 'PUBLIC_USER'],
    default: 'ADMIN'
  },
  action: {
    type: String,
    required: true,
    index: true
    // e.g., 'INTAKE_SUBMITTED', 'CSV_COMMITTED', 'COMPLETION_APPROVED', 'COMPLETION_REWORK',
    // 'CERTIFICATE_ISSUED', 'CERTIFICATE_REVOKED', 'CERTIFICATE_REPLACED', 'EMAIL_DISPATCHED'
  },
  targetEntity: {
    type: String,
    enum: ['PARTICIPANT', 'CERTIFICATE', 'BATCH', 'TEMPLATE', 'DELIVERY_JOB', 'ADMIN'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  summary: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
