const Certificate = require('../models/Certificate');
const Participant = require('../models/Participant');
const AuditLog = require('../models/AuditLog');
const { issueCertificateForParticipant } = require('../services/issuanceService');
const { generate128BitToken } = require('../services/qrService');
const { generateCertificatePdf } = require('../services/pdfService');
const { saveCertificateFile } = require('../services/storageService');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Issues certificates in bulk for approved participants
 */
exports.issueBatch = async (req, res, next) => {
  try {
    const { participantIds, overrideDates, idempotencyKey } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of participant IDs' });
    }

    const results = {
      totalRequested: participantIds.length,
      issued: 0,
      alreadyIssued: 0,
      failed: 0,
      details: []
    };

    for (const participantId of participantIds) {
      try {
        const outcome = await issueCertificateForParticipant({
          participantId,
          adminId: req.admin._id,
          idempotencyKey,
          overrideDates
        });

        if (outcome.message === 'Already issued') {
          results.alreadyIssued++;
        } else {
          results.issued++;
        }

        results.details.push({
          participantId,
          status: 'SUCCESS',
          certificateNumber: outcome.certificate.certificateNumber,
          isResumed: outcome.isResumed
        });
      } catch (err) {
        results.failed++;
        results.details.push({
          participantId,
          status: 'FAILED',
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Batch processed: ${results.issued} newly issued, ${results.alreadyIssued} already existed, ${results.failed} failed.`,
      results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List issued / managed certificates
 */
exports.getCertificates = async (req, res, next) => {
  try {
    const { status, programCode, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (programCode) query.programCode = programCode.toUpperCase();

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { certificateNumber: searchRegex },
        { 'renderedSnapshot.recipientName': searchRegex },
        { programTitle: searchRegex }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Certificate.countDocuments(query);
    const certificates = await Certificate.find(query)
      .populate('participantId', 'fullName email phone source')
      .populate('approvedBy', 'name email')
      .populate('replacedByCertificateId', 'certificateNumber')
      .populate('supersedesCertificateId', 'certificateNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      certificates
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revokes an issued certificate with mandatory reason
 */
exports.revokeCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A detailed reason (at least 5 characters) is required for certificate revocation'
      });
    }

    const cert = await Certificate.findById(id).populate('participantId');
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    if (cert.status === 'REVOKED') {
      return res.status(400).json({ success: false, message: 'Certificate is already revoked' });
    }

    // Strict State Machine Check: Only actively ISSUED certificates can be revoked
    if (cert.status !== 'ISSUED') {
      return res.status(400).json({
        success: false,
        message: `Only actively ISSUED certificates can be revoked (current state is ${cert.status})`
      });
    }

    cert.status = 'REVOKED';
    cert.revocationReason = reason.trim();
    cert.revokedAt = new Date();
    cert.revokedBy = req.admin._id;
    await cert.save();

    // Mark participant as no longer actively certified
    if (cert.participantId) {
      cert.participantId.isIssued = false;
      await cert.participantId.save();
    }

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'CERTIFICATE_REVOKED',
      targetEntity: 'CERTIFICATE',
      targetId: cert._id,
      summary: `Certificate ${cert.certificateNumber} revoked by ${req.admin.email}. Reason: ${reason.trim()}`
    });

    res.json({
      success: true,
      message: `Certificate ${cert.certificateNumber} has been revoked.`,
      certificate: cert
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Replaces an existing certificate with a corrected version (Atomic Replacement)
 */
exports.replaceCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, correctedName, correctedProgramTitle, correctedStartDate, correctedEndDate } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason is required for issuing a corrected replacement certificate'
      });
    }

    const oldCert = await Certificate.findById(id).populate('participantId');
    if (!oldCert) {
      return res.status(404).json({ success: false, message: 'Original certificate not found' });
    }

    if (oldCert.status === 'REPLACED') {
      return res.status(400).json({
        success: false,
        message: 'This certificate has already been replaced by a successor certificate.'
      });
    }

    if (oldCert.status !== 'ISSUED') {
      return res.status(400).json({
        success: false,
        message: `Only actively ISSUED certificates can be replaced with a correction (current state is ${oldCert.status})`
      });
    }

    // Prepare corrected details
    const finalName = (correctedName || oldCert.renderedSnapshot.recipientName).trim();
    const finalProgramTitle = (correctedProgramTitle || oldCert.renderedSnapshot.programTitle).trim();
    const finalStartDate = correctedStartDate ? new Date(correctedStartDate) : oldCert.renderedSnapshot.startDate;
    const finalEndDate = correctedEndDate ? new Date(correctedEndDate) : oldCert.renderedSnapshot.endDate;
    
    // Generate new unique identifiers (collision safe)
    const year = new Date().getFullYear();
    const cleanCode = oldCert.programCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const count = await Certificate.countDocuments();
    let sequence = count + 1;
    let newCertNumber = `NOX-${year}-${cleanCode}-${String(sequence).padStart(4, '0')}`;
    while (await Certificate.exists({ certificateNumber: newCertNumber })) {
      sequence++;
      newCertNumber = `NOX-${year}-${cleanCode}-${String(sequence).padStart(4, '0')}`;
    }

    const newPublicToken = generate128BitToken();

    // 1. Render new PDF
    const pdfBuffer = await generateCertificatePdf({
      recipientName: finalName,
      programTitle: finalProgramTitle,
      startDate: finalStartDate,
      endDate: finalEndDate,
      issueDate: new Date(),
      certificateNumber: newCertNumber,
      publicVerificationToken: newPublicToken,
      signatoryName: oldCert.renderedSnapshot.authorizedSignatoryName,
      signatoryTitle: oldCert.renderedSnapshot.authorizedSignatoryTitle,
      isDraft: false
    });

    const fileMeta = await saveCertificateFile(newCertNumber, pdfBuffer);

    // 2. Mint new Certificate document
    const newCert = new Certificate({
      certificateNumber: newCertNumber,
      publicVerificationToken: newPublicToken,
      completionAwardKey: `${oldCert.completionAwardKey}:v${oldCert.version + 1}`,
      participantId: oldCert.participantId._id,
      programCode: oldCert.programCode,
      programTitle: finalProgramTitle,
      batchId: oldCert.batchId,
      renderedSnapshot: {
        recipientName: finalName,
        programTitle: finalProgramTitle,
        startDate: finalStartDate,
        endDate: finalEndDate,
        issueDate: new Date(),
        authorizedSignatoryName: oldCert.renderedSnapshot.authorizedSignatoryName,
        authorizedSignatoryTitle: oldCert.renderedSnapshot.authorizedSignatoryTitle,
        templateVersion: oldCert.renderedSnapshot.templateVersion
      },
      status: 'ISSUED',
      fileStorage: {
        diskPath: fileMeta.diskPath,
        fileSizeBytes: fileMeta.fileSizeBytes,
        sha256Checksum: fileMeta.sha256Checksum,
        mimeType: 'application/pdf'
      },
      version: oldCert.version + 1,
      supersedesCertificateId: oldCert._id,
      approvedBy: req.admin._id,
      approvedAt: new Date()
    });
    await newCert.save();

    // 3. Mark old certificate as REPLACED and point to new
    oldCert.status = 'REPLACED';
    oldCert.revocationReason = reason.trim();
    oldCert.revokedAt = new Date();
    oldCert.revokedBy = req.admin._id;
    oldCert.replacedByCertificateId = newCert._id;
    await oldCert.save();

    // 4. Update Participant active link and name if changed
    if (correctedName) {
      oldCert.participantId.fullName = finalName;
      oldCert.participantId.normalizedName = finalName.toLowerCase();
    }
    oldCert.participantId.isIssued = true;
    oldCert.participantId.activeCertificateId = newCert._id;
    await oldCert.participantId.save();

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'CERTIFICATE_REPLACED',
      targetEntity: 'CERTIFICATE',
      targetId: newCert._id,
      summary: `Certificate ${oldCert.certificateNumber} replaced by corrected certificate ${newCert.certificateNumber}. Reason: ${reason}`
    });

    res.json({
      success: true,
      message: `Successfully issued replacement certificate ${newCert.certificateNumber}. Old certificate marked as REPLACED.`,
      oldCertificate: oldCert,
      newCertificate: newCert
    });
  } catch (error) {
    next(error);
  }
};
