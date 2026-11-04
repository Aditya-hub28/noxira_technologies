const Certificate = require('../models/Certificate');
const DeliveryJob = require('../models/DeliveryJob');
const { getCertificateReadStream } = require('../services/storageService');

/**
 * Public Verification Endpoint - ZERO PII LEAKAGE GUARANTEED
 */
exports.verifyByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token || token.trim().length < 8) {
      return res.status(400).json({ success: false, message: 'Invalid verification token format' });
    }

    // Lookup by 128-bit public token OR by exact human-readable Certificate Number
    const cert = await Certificate.findOne({
      $or: [
        { publicVerificationToken: token.trim() },
        { certificateNumber: token.trim().toUpperCase() }
      ]
    }).populate('replacedByCertificateId', 'certificateNumber publicVerificationToken');

    if (!cert) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'No credential found matching this verification query. Please check the code or QR code.'
      });
    }

    // Map internal status to public verification status
    let publicStatus = 'VALID';
    if (cert.status === 'REVOKED') publicStatus = 'REVOKED';
    else if (cert.status === 'REPLACED') publicStatus = 'REPLACED';
    else if (cert.status !== 'ISSUED') {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'Credential is not currently in an active or issued state.'
      });
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
      version: cert.version
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
