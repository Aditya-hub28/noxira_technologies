const mongoose = require('mongoose');
const crypto = require('crypto');

const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateApplicationId() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `NOX-${code}`;
}

const ApplicationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
      unique: true,
      index: true
    },
    programCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    programTitle: {
      type: String,
      trim: true
    },
    batchId: {
      type: String,
      trim: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ['APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'APPLIED',
      index: true
    },
    intakeSource: {
      type: String,
      enum: ['WEBSITE', 'FORM1_IMPORT'],
      default: undefined
    },
    // Locked fee amount copied from Program.feeInr at apply time.
    // Always a number (>= 0) for applications created under fee rules; default null for legacy records.
    feeLocked: {
      type: Number,
      default: null
    },
    adminNotes: {
      type: String,
      trim: true
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    offerLetterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfferLetter'
    },
    offerState: {
      type: String,
      enum: ['NONE', 'BLOCKED_TEMPLATE', 'GENERATING', 'GENERATED', 'FAILED'],
      default: 'NONE',
      index: true
    },
    offerDeliveryState: {
      type: String,
      enum: ['NONE', 'BLOCKED_TEMPLATE', 'QUEUED', 'PROCESSING', 'PROVIDER_ACCEPTED', 'FAILED', 'DELIVERY_UNKNOWN', 'SIMULATED'],
      default: 'NONE',
      index: true
    },
    offerError: {
      type: String,
      trim: true
    },
    history: [
      {
        fromStatus: String,
        toStatus: String,
        action: String,
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Admin'
        },
        actorName: String,
        reason: String,
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],
    appliedAt: {
      type: Date,
      default: Date.now
    },
    decidedAt: {
      type: Date
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

const Application = mongoose.model('Application', ApplicationSchema);

module.exports = Application;
module.exports.generateApplicationId = generateApplicationId;
