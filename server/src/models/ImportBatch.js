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
  programCode: {
    type: String,
    required: true
  },
  batchId: {
    type: String,
    required: true
  },
  columnMapping: {
    type: Map,
    of: String
  },
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
