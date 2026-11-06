const mongoose = require('mongoose');

/**
 * Module 6: Google Form 2 final-submission record.
 *
 * Created ONLY via the admin Form 2 CSV import bridge. The student-facing
 * Google Form 2 itself is created and owned by the business owner; this
 * system never generates the form, the payment QR, or collects payment.
 *
 * The transactionId (UTR) stored here is an UNTRUSTED student-provided
 * claim. It is never treated as proof of payment. Actual payment
 * verification is a manual admin action (Module 7) and is not represented
 * in this model.
 */
const SubmissionSchema = new mongoose.Schema({
  submissionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Normalized student-provided email (identity CLAIM, not proof)
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  programCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  // Student-provided application ID claim (optional column in Form 2)
  claimedApplicationId: {
    type: String,
    trim: true,
    uppercase: true
  },
  // Matched application when crosschecks pass; null for unmatched rows
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    default: null
  },
  matchState: {
    type: String,
    enum: ['MATCHED', 'UNMATCHED'],
    required: true,
    index: true
  },
  projectLink: {
    type: String,
    required: true,
    trim: true
  },
  // UNTRUSTED student-provided UTR / transaction reference. NOT payment proof.
  transactionId: {
    type: String,
    required: true,
    trim: true
  },
  // Optional form timestamp column (student-visible submission time)
  formSubmittedAt: {
    type: Date
  },
  importBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImportBatch',
    required: true
  },
  // Original CSV row preserved for audit
  rawRow: {
    type: mongoose.Schema.Types.Mixed
  },
  // Set when this submission's UTR was also claimed by a DIFFERENT applicant
  // (within the file or in an earlier import). Review flag only - it neither
  // proves nor disproves any payment.
  utrSharedFlag: {
    type: Boolean,
    default: false
  },

  // Module 7: manual payment verification. Set ONLY by an explicit admin
  // action after the admin has checked the bank/UPI app. The transactionId
  // above remains an untrusted student claim regardless of this state.
  paymentState: {
    type: String,
    enum: ['UNVERIFIED', 'VERIFIED', 'NOT_FOUND'],
    default: 'UNVERIFIED',
    index: true
  },
  paymentMarkedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  paymentMarkedAt: {
    type: Date
  },
  paymentNote: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, { timestamps: true });

// Idempotent re-import: same email+programme+transactionId never imports twice
SubmissionSchema.index({ email: 1, programCode: 1, transactionId: 1 }, { unique: true });

/**
 * Human-friendly submission IDs: SUB- + 6 unambiguous chars
 * (same alphabet as NOX- application IDs: no 0/O/1/I/L).
 */
const UNAMBIGUOUS_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function generateSubmissionId() {
  let id = 'SUB-';
  for (let i = 0; i < 6; i++) {
    id += UNAMBIGUOUS_CHARS[Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length)];
  }
  return id;
}

module.exports = mongoose.model('Submission', SubmissionSchema);
module.exports.generateSubmissionId = generateSubmissionId;
