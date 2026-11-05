const mongoose = require('mongoose');

const OfferLetterSchema = new mongoose.Schema(
  {
    offerLetterId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true
    },
    applicationId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true
    },
    applicationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      unique: true,
      index: true
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
      index: true
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfferLetterTemplate',
      required: true
    },
    templateVersion: {
      type: Number,
      required: true
    },
    recipientSnapshot: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String }
    },
    programSnapshot: {
      code: { type: String, required: true },
      title: { type: String, required: true },
      batchId: { type: String },
      durationWeeks: { type: Number },
      startDate: { type: Date },
      endDate: { type: Date },
      feeLocked: { type: Number, default: null }
    },
    pdfPath: {
      type: String,
      required: true
    },
    pdfSha256: {
      type: String,
      required: true
    },
    pdfSizeBytes: {
      type: Number,
      required: true
    },
    generationStatus: {
      type: String,
      enum: ['GENERATING', 'GENERATED', 'FAILED'],
      default: 'GENERATING',
      index: true
    },
    generationError: {
      type: String
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    downloadToken: {
      type: String,
      index: true
    },
    downloadTokenExpiresAt: {
      type: Date
    },
    downloadTokenRevokedAt: {
      type: Date
    },
    deliveryJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfferDeliveryJob'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('OfferLetter', OfferLetterSchema);
