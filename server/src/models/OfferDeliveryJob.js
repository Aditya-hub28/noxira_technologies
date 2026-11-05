const mongoose = require('mongoose');

const OfferDeliveryJobSchema = new mongoose.Schema(
  {
    offerLetterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfferLetter',
      required: true,
      unique: true,
      index: true
    },
    applicationId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    status: {
      type: String,
      enum: [
        'BLOCKED_TEMPLATE',
        'QUEUED',
        'PROCESSING',
        'PROVIDER_ACCEPTED',
        'FAILED',
        'DELIVERY_UNKNOWN',
        'SIMULATED'
      ],
      default: 'QUEUED',
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    claimedAt: {
      type: Date
    },
    claimToken: {
      type: String
    },
    providerMessageId: {
      type: String
    },
    providerResponse: {
      type: String
    },
    lastAttemptAt: {
      type: Date
    },
    lastError: {
      type: String
    },
    reconciliationRequired: {
      type: Boolean,
      default: false
    },
    reconciliationNotes: {
      type: String,
      trim: true
    },
    reconciledAt: {
      type: Date
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('OfferDeliveryJob', OfferDeliveryJobSchema);
