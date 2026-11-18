const Certificate = require('../models/Certificate');
const DeliveryJob = require('../models/DeliveryJob');
const { getCertificateReadStream } = require('../services/storageService');

/**
 * Shared public lookup: by 128-bit public token OR human-readable certificate number.
 * Returns { cert, publicStatus } or { error: { status, body } } for a failed lookup.
 */
async function findPublicCertificate(rawToken) {
  const token = (rawToken || '').trim();

  if (!token || token.length < 8) {
    return { error: { status: 400, body: { success: false, message: 'Invalid verification token format' } } };
  }

  const cert = await Certificate.findOne({
    $or: [
      { publicVerificationToken: token },
      { certificateNumber: token.toUpperCase() }
    ]
  }).populate('replacedByCertificateId', 'certificateNumber publicVerificationToken');

  if (!cert) {
    return { error: { status: 404, body: { success: false, verified: false, message: 'No credential found matching this verification query. Please check the code or QR code.' } } };
  }

  // Map internal status to public verification status
  let publicStatus = 'VALID';
  if (cert.status === 'REVOKED') publicStatus = 'REVOKED';
  else if (cert.status === 'REPLACED') publicStatus = 'REPLACED';
  else if (cert.status !== 'ISSUED') {
    return { error: { status: 404, body: { success: false, verified: false, message: 'Credential is not currently in an active or issued state.' } } };
  }

  return { cert, publicStatus };
}

/**
 * Public Verification Endpoint - ZERO PII LEAKAGE GUARANTEED
 */
exports.verifyByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const { cert, publicStatus, error } = await findPublicCertificate(token);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    // Response strictly sanitizes all PII (NO email, NO phone, NO internal notes)
    const verificationPayload = {
      success: true,
      verified: publicStatus === 'VALID',
      status: publicStatus,
      certificateNumber: cert.certificateNumber,
      recipientName: cert.renderedSnapshot.recipientName,
      programTitle: cert.renderedSnapshot.programTitle,
      startDate: cert.renderedSnapshot.startDate,
      endDate: cert.renderedSnapshot.endDate,
      issueDate: cert.renderedSnapshot.issueDate,
      signatoryName: cert.renderedSnapshot.authorizedSignatoryName,
      signatoryTitle: cert.renderedSnapshot.authorizedSignatoryTitle,
      version: cert.version,
      // Whether this certificate has its issued PDF (admin-set design) available
      // at GET /api/v1/public/verify/:token/pdf
      pdfAvailable: Boolean(cert.fileStorage && cert.fileStorage.diskPath)
    };

    if (publicStatus === 'REVOKED' || publicStatus === 'REPLACED') {
      verificationPayload.revokedAt = cert.revokedAt;
      verificationPayload.revocationReason = cert.revocationReason;
    }

    if (publicStatus === 'REPLACED' && cert.replacedByCertificateId) {
      verificationPayload.replacement = {
        certificateNumber: cert.replacedByCertificateId.certificateNumber,
        publicVerificationToken: cert.replacedByCertificateId.publicVerificationToken
      };
    }

    res.json(verificationPayload);
  } catch (error) {
    next(error);
  }
};

/**
 * Public Certificate PDF - the exact issued design (admin-set template) frozen at issuance.
 * Streams the same document the recipient receives; it contains only the data the public
 * verification endpoint already returns (name, program, dates, certificate ID, QR, signatory),
 * so the zero-PII guarantee is preserved. Rate-limited like the verification endpoint.
 */
exports.streamPublicCertificatePdf = async (req, res, next) => {
  try {
    const { cert, error } = await findPublicCertificate(req.params.token);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    const diskPath = cert.fileStorage && cert.fileStorage.diskPath;
    if (!diskPath) {
      return res.status(404).json({ success: false, message: 'No issued file stored for this credential record' });
    }

    const safeFilename = `NOXIRA-${cert.certificateNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    const stream = getCertificateReadStream(diskPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Issued file is not available on this server' });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Secure Private Certificate PDF Download
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { downloadToken } = req.params;

    if (!downloadToken) {
      return res.status(400).json({ success: false, message: 'Download token is required' });
    }

    const job = await DeliveryJob.findOne({ downloadToken }).populate('certificateId');
    if (!job || !job.certificateId) {
      return res.status(404).json({ success: false, message: 'Invalid download link or credential record missing' });
    }

    // Check expiration (72 hour TTL)
    if (new Date() > new Date(job.downloadTokenExpiresAt)) {
      return res.status(410).json({
        success: false,
        message: 'This download link has expired for security reasons. Please contact administration for a refreshed link.'
      });
    }

    const cert = job.certificateId;
    if (cert.status !== 'ISSUED' && cert.status !== 'REPLACED') {
      return res.status(403).json({
        success: false,
        message: `This certificate is currently ${cert.status} and cannot be downloaded.`
      });
    }

    const diskPath = cert.fileStorage?.diskPath;
    if (!diskPath) {
      return res.status(404).json({ success: false, message: 'File storage path missing from credential record' });
    }

    // Increment download counter
    job.downloadCount += 1;
    job.lastDownloadedAt = new Date();
    await job.save();

    const safeFilename = `NOXIRA-${cert.certificateNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    const stream = getCertificateReadStream(diskPath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};
