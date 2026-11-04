const crypto = require('crypto');
const QRCode = require('qrcode');
const env = require('../config/env');

/**
 * Generates a cryptographically secure token with at least 128 bits of entropy
 * 16 bytes = 128 bits -> represented as a 32-character hexadecimal string
 */
function generate128BitToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a high-resolution QR Code PNG buffer for the public verification URL
 * @param {string} token - 128-bit public verification token
 * @returns {Promise<Buffer>} - PNG image buffer
 */
async function generateVerificationQRCodeBuffer(token) {
  const verificationUrl = `${env.VERIFY_BASE_URL}/verify/${token}`;
  
  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    type: 'png',
    errorCorrectionLevel: 'H', // High error correction level for reliable phone scanning
    margin: 1,
    width: 250,
    color: {
      dark: '#0F172A', // Slate 900
      light: '#FFFFFF'
    }
  });

  return qrBuffer;
}

module.exports = {
  generate128BitToken,
  generateVerificationQRCodeBuffer
};
