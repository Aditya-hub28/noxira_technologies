const crypto = require('crypto');
const Certificate = require('../models/Certificate');
const Participant = require('../models/Participant');
const Program = require('../models/Program');
const Template = require('../models/Template');
const AuditLog = require('../models/AuditLog');
const { generate128BitToken } = require('./qrService');
const { generateCertificatePdf } = require('./pdfService');
const { saveCertificateFile } = require('./storageService');

/**
 * Computes deterministic award key to prevent duplicate certification awards
 */
function computeAwardKey(participantId, programCode, batchId) {
  return crypto
    .createHash('sha256')
    .update(`${participantId}:${programCode.toUpperCase()}:${batchId.toUpperCase()}`)
    .digest('hex');
}

/**
 * Generates human readable certificate ID: NOX-<YEAR>-<PROGRAM>-<SEQUENCE>
 * Collision-safe with collision check
 */
async function generateNextCertificateNumber(programCode) {
  const year = new Date().getFullYear();
  const cleanCode = programCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  
  const count = await Certificate.countDocuments();
  let sequence = count + 1;
  let candidate = `NOX-${year}-${cleanCode}-${String(sequence).padStart(4, '0')}`;

  while (await Certificate.exists({ certificateNumber: candidate })) {
    sequence++;
    candidate = `NOX-${year}-${cleanCode}-${String(sequence).padStart(4, '0')}`;
  }
  
  return candidate;
}

/**
 * Issues a certificate for an approved/eligible participant with strict idempotency and durability
 */
async function issueCertificateForParticipant({
  participantId,
  adminId,
  idempotencyKey,
  overrideDates
}) {
  const participant = await Participant.findById(participantId);
  if (!participant) {
    throw new Error('Participant not found');
  }

  // 1. Completion Gate Validation
  if (participant.completionStatus !== 'ELIGIBLE') {
    throw new Error(`Participant completion status is "${participant.completionStatus}". Only "ELIGIBLE" participants can receive a certificate.`);
  }

  // 2. Deterministic Award Key
  const completionAwardKey = computeAwardKey(participant._id, participant.programCode, participant.batchId);

  // 3. Check for existing certificate record
  let existingCert = await Certificate.findOne({ completionAwardKey });
  
  if (existingCert) {
    if (existingCert.status === 'ISSUED') {
      // Idempotent return: already successfully issued
      return { certificate: existingCert, isResumed: false, message: 'Already issued' };
    }
    if (existingCert.status === 'GENERATING') {
      throw new Error('Certificate generation is currently in-progress. Please wait.');
    }
    // If FAILED, we will resume this exact record instead of creating another one
  }

  // 4. Resolve dates & template
  const program = await Program.findOne({ code: participant.programCode });
  const startDate = overrideDates?.startDate || program?.defaultStartDate || new Date();
  const endDate = overrideDates?.endDate || program?.defaultEndDate || new Date();
  const issueDate = new Date();

  // Validate dates: same-day allowed, but end date cannot precede start date
  if (new Date(endDate) < new Date(startDate)) {
    throw new Error('Program end date cannot precede start date');
  }

  const template = await Template.findOne({ isActive: true }) || {
    signatory: { name: 'Aditya Jha', title: 'Managing Director & Lead Architect' },
    version: '1.0.0'
  };

  // Safe Signatory resolution (supports both top-level and layout.signatory)
  const activeSignatory = (template && (template.signatory || template.layout?.signatory)) || {
    name: 'Aditya Jha',
    title: 'Managing Director & Lead Architect'
  };

  // 5. Create or reuse Certificate Draft Record
  let certRecord = existingCert;
  if (!certRecord) {
    const certNumber = await generateNextCertificateNumber(participant.programCode);
    const publicToken = generate128BitToken();

    certRecord = new Certificate({
      certificateNumber: certNumber,
      publicVerificationToken: publicToken,
      completionAwardKey,
      idempotencyKey: idempotencyKey || publicToken,
      participantId: participant._id,
      programCode: participant.programCode,
      programTitle: participant.programTitle,
      batchId: participant.batchId,
      renderedSnapshot: {
        recipientName: participant.fullName,
        programTitle: participant.programTitle,
        startDate,
        endDate,
        issueDate,
        authorizedSignatoryName: activeSignatory.name,
        authorizedSignatoryTitle: activeSignatory.title,
        templateVersion: template.version || '1.0.0'
      },
      status: 'GENERATING',
      approvedBy: adminId,
      approvedAt: new Date()
    });
    await certRecord.save();
  } else {
    certRecord.status = 'GENERATING';
    await certRecord.save();
  }

  // 6. Generate PDF and Save to Disk (Atomic Storage Gate)
  try {
    const pdfBuffer = await generateCertificatePdf({
      recipientName: certRecord.renderedSnapshot.recipientName,
      programTitle: certRecord.renderedSnapshot.programTitle,
      startDate: certRecord.renderedSnapshot.startDate,
      endDate: certRecord.renderedSnapshot.endDate,
      issueDate: certRecord.renderedSnapshot.issueDate,
      certificateNumber: certRecord.certificateNumber,
      publicVerificationToken: certRecord.publicVerificationToken,
      signatoryName: certRecord.renderedSnapshot.authorizedSignatoryName,
      signatoryTitle: certRecord.renderedSnapshot.authorizedSignatoryTitle,
      isDraft: false,
      backgroundImagePath: template.backgroundAssetPath,
      customLayout: template.layout
    });

    const fileMeta = await saveCertificateFile(certRecord.certificateNumber, pdfBuffer);

    // 7. Atomic Commit: Mark ISSUED only when file is safely stored on disk
    certRecord.fileStorage = {
      diskPath: fileMeta.diskPath,
      fileSizeBytes: fileMeta.fileSizeBytes,
      sha256Checksum: fileMeta.sha256Checksum,
      mimeType: 'application/pdf'
    };
    certRecord.status = 'ISSUED';
    await certRecord.save();

    // Link participant
    participant.isIssued = true;
    participant.activeCertificateId = certRecord._id;
    await participant.save();

    // Audit Log
    await AuditLog.create({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'CERTIFICATE_ISSUED',
      targetEntity: 'CERTIFICATE',
      targetId: certRecord._id,
      summary: `Certificate ${certRecord.certificateNumber} issued to ${participant.fullName}`,
      metadata: {
        certificateNumber: certRecord.certificateNumber,
        checksum: fileMeta.sha256Checksum,
        filesize: fileMeta.fileSizeBytes
      }
    });

    return { certificate: certRecord, isResumed: !!existingCert, message: 'Successfully issued' };
  } catch (err) {
    // If generation or file storage fails, mark as FAILED (resumable)
    certRecord.status = 'FAILED';
    await certRecord.save();
    throw new Error(`Failed to store certificate: ${err.message}`);
  }
}

module.exports = {
  issueCertificateForParticipant,
  computeAwardKey
};
