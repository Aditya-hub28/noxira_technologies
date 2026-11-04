const mongoose = require('mongoose');

const DeliveryJobSchema = new mongoose.Schema({
  certificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate',
    required: true,
    index: true
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  recipientEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  // Independent 128-bit scoped download token
  downloadToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  downloadTokenExpiresAt: {
    type: Date,
    required: true,
    index: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date
  },
  
  // Delivery State Machine
  status: {
    type: String,
    enum: [
      'QUEUED',
      'PROCESSING',
      'PROVIDER_ACCEPTED',
      'DELIVERED',
      'BOUNCED',
      'FAILED',
      'DELIVERY_UNKNOWN'
    ],
    default: 'QUEUED',
    index: true
  },
  gatewayMessageId: {
    type: String,
    index: true
  },
  providerMessageId: {
    type: String,
    index: true
  },
  providerIdempotencyKey: {
    type: String,
    index: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastAttemptAt: {
    type: Date
  },
  lastError: {
    type: String
  },
  adminOverrideNeeded: {
    type: Boolean,
    default: false
  },
  // Atomic Lease & Worker Locks (For Crash Recovery & Exactly-Once Guard)
  leaseExpiresAt: {
    type: Date,
    index: true
  },
  lockId: {
    type: String
  },
  reconciliationNotes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeliveryJob', DeliveryJobSchema);
