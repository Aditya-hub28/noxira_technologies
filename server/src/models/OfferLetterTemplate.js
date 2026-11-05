const mongoose = require('mongoose');

const TemplateFieldSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    page: {
      type: Number,
      required: true,
      default: 1
    },
    x: {
      type: Number,
      required: true,
      default: 50
    },
    y: {
      type: Number,
      required: true,
      default: 100
    },
    fontSize: {
      type: Number,
      default: 12
    },
    fontColor: {
      type: String,
      default: '#0f172a'
    },
    alignment: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'left'
    },
    maxWidth: {
      type: Number,
      default: 450
    },
    isRequired: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const PageDimensionSchema = new mongoose.Schema(
  {
    pageNumber: {
      type: Number,
      required: true
    },
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const OfferLetterTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    version: {
      type: Number,
      required: true,
      default: 1
    },
    isSample: {
      type: Boolean,
      default: false,
      index: true
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true
    },
    pdfStoragePath: {
      type: String,
      required: true
    },
    pdfSizeBytes: {
      type: Number,
      default: 0
    },
    pdfSha256: {
      type: String,
      default: ''
    },
    pageCount: {
      type: Number,
      default: 1
    },
    pageDimensions: [PageDimensionSchema],
    fields: [TemplateFieldSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    activatedAt: {
      type: Date
    },
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

OfferLetterTemplateSchema.index({ isActive: 1, isSample: 1 });

module.exports = mongoose.model('OfferLetterTemplate', OfferLetterTemplateSchema);
