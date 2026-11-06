const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'site',
    trim: true
  },
  googleForm1Url: {
    type: String,
    default: '',
    trim: true
  },
  form1ColumnMapping: [
    {
      header: { type: String, required: true },
      target: { type: String, required: true },
      _id: false
    }
  ],
  form1DomainMapping: [
    {
      value: { type: String, required: true },
      programCode: { type: String, required: true, uppercase: true },
      _id: false
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('Setting', SettingSchema);
