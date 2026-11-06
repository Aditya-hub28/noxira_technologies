const mongoose = require('mongoose');

const ImportBatchSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  fileSizeBytes: {
    type: Number
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  kind: {
    type: String,
    enum: ['PARTICIPANT_CSV', 'FORM1_RESPONSES'],
    default: 'PARTICIPANT_CSV',
    required: true
  },
  programCode: {
    type: String,
    required: function() {
      return this.kind === 'PARTICIPANT_CSV';
    }
  },
  batchId: {
    type: String,
    required: true
  },
  columnMapping: {
    type: mongoose.Schema.Types.Mixed
  },
  domainMapping: [
    {
      value: { type: String, trim: true },
      programCode: { type: String, trim: true, uppercase: true },
      _id: false
    }
  ],
  totalRows: {
    type: Number,
    default: 0
  },
  validRows: {
    type: Number,
    default: 0
  },
  duplicateRows: {
    type: Number,
    default: 0
  },
  errorRows: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PREVIEW', 'COMMITTED', 'DISCARDED'],
    default: 'PREVIEW'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ImportBatch', ImportBatchSchema);
