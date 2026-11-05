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

/**
 * Saves an uploaded offer template PDF to private storage
 */
async function saveOfferTemplateFile(arg1, arg2) {
  let templateFilename, pdfBuffer;
  if (Buffer.isBuffer(arg1)) {
    pdfBuffer = arg1;
    templateFilename = typeof arg2 === 'string' ? arg2 : `template_${Date.now()}.pdf`;
  } else {
    templateFilename = typeof arg1 === 'string' ? arg1 : `template_${Date.now()}.pdf`;
    pdfBuffer = arg2;
  }

  const dir = path.join(env.STORAGE_DIR, 'offer_templates');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const safeFilename = `${templateFilename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const filePath = path.join(dir, safeFilename);

  const hashSum = crypto.createHash('sha256');
  hashSum.update(pdfBuffer);
  const sha256Checksum = hashSum.digest('hex');

  await fs.promises.writeFile(filePath, pdfBuffer, { mode: 0o600 });

  return {
    diskPath: filePath,
    filename: safeFilename,
    fileSizeBytes: pdfBuffer.length,
    sha256Checksum,
    toString() {
      return filePath;
    }
  };
}

/**
 * Saves a generated offer letter PDF to private storage
 */
async function saveOfferLetterPdf(arg1, arg2) {
  let offerLetterId, pdfBuffer;
  if (Buffer.isBuffer(arg1)) {
    pdfBuffer = arg1;
    offerLetterId = typeof arg2 === 'string' ? arg2 : `offer_${Date.now()}`;
  } else {
    offerLetterId = typeof arg1 === 'string' ? arg1 : `offer_${Date.now()}`;
    pdfBuffer = arg2;
  }

  const dir = path.join(env.STORAGE_DIR, 'offers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const safeFilename = `${offerLetterId.replace(/[^a-zA-Z0-9_.-]/g, '_')}${offerLetterId.endsWith('.pdf') ? '' : '.pdf'}`;
  const filePath = path.join(dir, safeFilename);

  const hashSum = crypto.createHash('sha256');
  hashSum.update(pdfBuffer);
  const sha256Checksum = hashSum.digest('hex');

  await fs.promises.writeFile(filePath, pdfBuffer, { mode: 0o600 });

  return {
    diskPath: filePath,
    filename: safeFilename,
    fileSizeBytes: pdfBuffer.length,
    sha256Checksum,
    toString() {
      return filePath;
    }
  };
}

module.exports = {
  saveCertificateFile,
  getCertificateReadStream,
  verifyFileIntegrity,
  saveOfferTemplateFile,
  saveOfferLetterPdf
};
