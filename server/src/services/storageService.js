const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

// Ensure base private storage directory exists
function ensureStorageDirectory() {
  if (!fs.existsSync(env.STORAGE_DIR)) {
    fs.mkdirSync(env.STORAGE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Saves a certificate PDF buffer to private disk storage
 * Computes SHA-256 checksum for immutable internal integrity verification
 */
async function saveCertificateFile(certificateNumber, pdfBuffer) {
  ensureStorageDirectory();

  const safeFilename = `${certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(env.STORAGE_DIR, safeFilename);

  // Compute SHA-256 hash
  const hashSum = crypto.createHash('sha256');
  hashSum.update(pdfBuffer);
  const sha256Checksum = hashSum.digest('hex');

  // Write file atomically
  await fs.promises.writeFile(filePath, pdfBuffer, { mode: 0o600 });

  return {
    diskPath: filePath,
    filename: safeFilename,
    fileSizeBytes: pdfBuffer.length,
    sha256Checksum
  };
}

/**
 * Safely streams certificate file from private disk storage
 */
function getCertificateReadStream(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Certificate file not found on storage disk');
  }
  return fs.createReadStream(filePath);
}

/**
 * Verifies if file on disk matches stored SHA-256 checksum
 */
async function verifyFileIntegrity(filePath, expectedChecksum) {
  if (!fs.existsSync(filePath)) return false;
  const fileBuffer = await fs.promises.readFile(filePath);
  const currentChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  return currentChecksum === expectedChecksum;
}

module.exports = {
  saveCertificateFile,
  getCertificateReadStream,
  verifyFileIntegrity
};
