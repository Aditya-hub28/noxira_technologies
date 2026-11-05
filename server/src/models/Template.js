const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'Official NOXIRA Certificate Template v1'
  },
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  orientation: {
    type: String,
    enum: ['LANDSCAPE', 'PORTRAIT'],
    default: 'LANDSCAPE'
  },
  dimensions: {
    width: { type: Number, default: 841.89 }, // A4 Landscape points
    height: { type: Number, default: 595.28 }
  },
  backgroundAssetPath: {
    type: String,
    default: null
  },
  backgroundAssetUrl: {
    type: String,
    default: null
  },
  useCustomBackground: {
    type: Boolean,
    default: false
  },
  signatory: {
    name: { type: String, default: 'Aditya Jha' },
    title: { type: String, default: 'Managing Director & Lead Architect' },
    organization: { type: String, default: 'NOXIRA Technologies' }
  },
  layout: {
    name: {
      y: { type: Number, default: 395 }, // From bottom
      fontSize: { type: Number, default: 34 },
      color: { type: String, default: '#0F172A' }
    },
    program: {
      y: { type: Number, default: 320 },
      fontSize: { type: Number, default: 20 },
      color: { type: String, default: '#D97706' }
    },
    date: {
      y: { type: Number, default: 287 },
      fontSize: { type: Number, default: 11 },
      color: { type: String, default: '#334155' }
    },
    qr: {
      x: { type: Number, default: 382 }, // Centered horizontally
      y: { type: Number, default: 55 },
      size: { type: Number, default: 78 }
    },
    certId: {
      x: { type: Number, default: 60 },
      y: { type: Number, default: 110 },
      fontSize: { type: Number, default: 10 },
      color: { type: String, default: '#0F172A' }
    },
    signatory: {
      x: { type: Number, default: 600 },
      y: { type: Number, default: 90 },
      name: { type: String, default: 'Aditya Jha' },
      title: { type: String, default: 'Managing Director & Lead Architect' },
      organization: { type: String, default: 'NOXIRA Technologies' },
      color: { type: String, default: '#0F172A' }
    }
  },
  branding: {
    organizationName: { type: String, default: 'NOXIRA TECHNOLOGIES' },
    organizationTagline: { type: String, default: 'INNOVATION & EXCELLENCE IN DIGITAL ENGINEERING' },
    primaryColor: { type: String, default: '#0F172A' },
    accentColor: { type: String, default: '#D97706' },
    textColor: { type: String, default: '#1E293B' }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Template', TemplateSchema);
