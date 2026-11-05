const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Application = require('../models/Application');
const Participant = require('../models/Participant');
const Program = require('../models/Program');
const OfferLetterTemplate = require('../models/OfferLetterTemplate');
const OfferLetter = require('../models/OfferLetter');
const OfferDeliveryJob = require('../models/OfferDeliveryJob');
const AuditLog = require('../models/AuditLog');
const storageService = require('./storageService');
const offerPdfService = require('./offerPdfService');
const nodemailer = require('nodemailer');

let transporter = null;
function getOfferTransporter() {
  if (!transporter) {
    if (env.NODE_ENV === 'production') {
      if (!env.SMTP.USER || !env.SMTP.PASS || env.SMTP.HOST === 'smtp.ethereal.email' || env.SMTP.USER === 'test@example.com') {
        throw new Error('[CRITICAL] SMTP transporter unconfigured or using insecure placeholders in production mode.');
      }
      transporter = nodemailer.createTransport({
        host: env.SMTP.HOST,
        port: env.SMTP.PORT,
        secure: env.SMTP.PORT === 465,
        auth: {
          user: env.SMTP.USER,
          pass: env.SMTP.PASS
        }
      });
    } else if (process.env.NODE_ENV !== 'test' && env.SMTP.USER && env.SMTP.PASS && env.SMTP.USER !== 'test@example.com') {
      transporter = nodemailer.createTransport({
        host: env.SMTP.HOST,
        port: env.SMTP.PORT,
        secure: env.SMTP.PORT === 465,
        auth: {
          user: env.SMTP.USER,
          pass: env.SMTP.PASS
        }
      });
    } else {
      transporter = {
        sendMail: async (mailOptions) => {
          return {
            messageId: `mock-offer-msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            response: '250 OK: Simulated offer email acceptance'
          };
        }
      };
    }
  }
  return transporter;
}

function setOfferTransporter(customTransporter) {
  transporter = customTransporter;
}

/**
 * Signs a 72-hour expiring bearer token for downloading an offer letter.
 */
function createOfferDownloadToken(offerLetterId, applicationId, jti) {
  const payload = {
    sub: String(offerLetterId),
    appId: applicationId,
    purpose: 'OFFER_DOWNLOAD',
    jti: jti || crypto.randomUUID()
  };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '72h' });
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  return { token, jti: payload.jti, expiresAt };
}

/**
 * Generates an OfferLetter record and PDF for an approved Application.
 * Idempotent: if an offer letter already exists for this application, returns the existing record.
 */
async function generateOfferForApplication(applicationId, options = {}) {
  const application = await Application.findOne({ applicationId }).populate('participantId');
  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }
  if (application.status !== 'APPROVED') {
    throw new Error(`Cannot generate offer letter for application in ${application.status} status. Must be APPROVED.`);
  }

  // Idempotency: check if an offer already exists
  let offerLetter = await OfferLetter.findOne({ applicationRef: application._id });
  if (offerLetter && offerLetter.generationStatus === 'GENERATED' && !options.forceRegenerate) {
    const deliveryJob = await OfferDeliveryJob.findOne({ offerLetterId: offerLetter._id });
    return { offerLetter, deliveryJob, created: false };
  }

  // Find active template, or fall back to sample template
  let template = await OfferLetterTemplate.findOne({ isActive: true });
  if (!template) {
    template = await OfferLetterTemplate.findOne({ isSample: true });
  }

  if (!template) {
    // If absolutely no template exists, update application state to BLOCKED_TEMPLATE
    application.offerState = 'BLOCKED_TEMPLATE';
    application.offerDeliveryState = 'BLOCKED_TEMPLATE';
    await application.save();
    return { offerLetter: null, blocked: true, reason: 'NO_TEMPLATE_AVAILABLE' };
  }

  const participant = application.participantId;
  const program = await Program.findOne({ code: application.programCode }).lean();

  const recipientSnapshot = {
    fullName: participant ? participant.fullName : 'Applicant',
    email: participant ? participant.email : '',
    phone: participant ? participant.phone || '' : ''
  };

  const programSnapshot = {
    code: application.programCode,
    title: application.programTitle || (program ? program.title : application.programCode),
    batchId: application.batchId || (program ? program.defaultBatch : ''),
    durationWeeks: program ? program.durationWeeks : undefined,
    startDate: program ? program.startDate || program.defaultStartDate : undefined,
    endDate: program ? program.endDate || program.defaultEndDate : undefined,
    feeLocked: application.feeLocked
  };

  const uniqueOfferId = `OFR-${application.applicationId.replace('NOX-', '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const jti = crypto.randomUUID();

  // Create or reuse offer record
  if (!offerLetter) {
    offerLetter = new OfferLetter({
      offerLetterId: uniqueOfferId,
      applicationId: application.applicationId,
      applicationRef: application._id,
      participantId: participant ? participant._id : application.participantId,
      templateId: template._id,
      templateVersion: template.version,
      recipientSnapshot,
      programSnapshot,
      pdfPath: 'pending',
      pdfSha256: 'pending',
      pdfSizeBytes: 0,
      generationStatus: 'GENERATING',
      downloadToken: jti,
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    });
  } else {
    offerLetter.templateId = template._id;
    offerLetter.templateVersion = template.version;
    offerLetter.recipientSnapshot = recipientSnapshot;
    offerLetter.programSnapshot = programSnapshot;
    offerLetter.generationStatus = 'GENERATING';
    offerLetter.downloadToken = jti;
    offerLetter.downloadTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  }

  try {
    // Render PDF buffer
    const pdfBuffer = await offerPdfService.renderOfferPdf(template, {
      ...recipientSnapshot,
      ...programSnapshot,
      recipientSnapshot,
      programSnapshot,
      programTitle: programSnapshot.title,
      studentName: recipientSnapshot.fullName,
      applicationId: application.applicationId,
      issueDate: new Date()
    }, { isSample: template.isSample });

    const sha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const filename = `${uniqueOfferId}.pdf`;
    const savedStorage = await storageService.saveOfferLetterPdf(uniqueOfferId, pdfBuffer);
    const savedPath = savedStorage.diskPath || String(savedStorage);

    offerLetter.pdfPath = savedPath;
    offerLetter.pdfSha256 = sha256;
    offerLetter.pdfSizeBytes = pdfBuffer.length;
    offerLetter.generationStatus = 'GENERATED';
    offerLetter.generationError = undefined;
    await offerLetter.save();

    // Link offer letter to application
    application.offerLetterId = offerLetter._id;
    application.offerState = template.isSample ? 'BLOCKED_TEMPLATE' : 'GENERATED';

    // Handle delivery job
    let deliveryJob = await OfferDeliveryJob.findOne({ offerLetterId: offerLetter._id });
    if (!deliveryJob) {
      deliveryJob = new OfferDeliveryJob({
        offerLetterId: offerLetter._id,
        applicationId: application.applicationId,
        recipientEmail: recipientSnapshot.email,
        status: template.isSample ? 'BLOCKED_TEMPLATE' : 'QUEUED'
      });
      await deliveryJob.save();
    } else {
      deliveryJob.status = template.isSample ? 'BLOCKED_TEMPLATE' : 'QUEUED';
      await deliveryJob.save();
    }

    offerLetter.deliveryJobId = deliveryJob._id;
    await offerLetter.save();

    application.offerDeliveryState = deliveryJob.status;
    await application.save();

    return { offerLetter, deliveryJob, created: true, isSample: template.isSample };
  } catch (err) {
    offerLetter.generationStatus = 'FAILED';
    offerLetter.generationError = err.message;
    await offerLetter.save();

    application.offerState = 'FAILED';
    application.offerDeliveryState = 'FAILED';
    await application.save();

    throw err;
  }
}

/**
 * Sends or simulates the offer letter email for a queued OfferDeliveryJob.
 */
async function processOfferDeliveryJob(jobId) {
  const claimToken = crypto.randomUUID();
  const job = await OfferDeliveryJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ['QUEUED', 'FAILED'] } },
    {
      $set: {
        status: 'PROCESSING',
        claimedAt: new Date(),
        claimToken
      },
      $inc: { attempts: 1 }
    },
    { new: true }
  );

  if (!job) {
    return { success: false, reason: 'Job already claimed or not queued' };
  }

  const offerLetter = await OfferLetter.findById(job.offerLetterId);
  const application = await Application.findOne({ applicationId: job.applicationId });
  if (!offerLetter || !application) {
    job.status = 'FAILED';
    job.lastError = 'OfferLetter or Application missing';
    await job.save();
    return { success: false, reason: job.lastError };
  }

  // Safety: Sample template never dispatches live email
  const template = await OfferLetterTemplate.findById(offerLetter.templateId);
  if (template && template.isSample) {
    job.status = 'BLOCKED_TEMPLATE';
    await job.save();
    application.offerDeliveryState = 'BLOCKED_TEMPLATE';
    await application.save();
    return { success: false, reason: 'Sample template active; email blocked.' };
  }

  const { token } = createOfferDownloadToken(offerLetter._id, job.applicationId, offerLetter.downloadToken);
  const downloadUrl = `${env.FRONTEND_URL || 'http://localhost:5173'}/api/v1/offers/download/${token}`;

  const mailOptions = {
    from: (env.SMTP && env.SMTP.FROM) || 'NOXIRA Admissions <admissions@noxira.tech>',
    to: job.recipientEmail,
    subject: `NOXIRA Internship Offer: ${application.programTitle || application.programCode}`,
    text: `Congratulations! Your application ${application.applicationId} for ${application.programTitle || application.programCode} has been approved.\n\nYou can access your official offer letter at the secure link below:\n${downloadUrl}\n\nNote: This secure link is valid for 72 hours.`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
        <h2>NOXIRA Internship Offer</h2>
        <p>Congratulations! Your application (<strong>${application.applicationId}</strong>) for <strong>${application.programTitle || application.programCode}</strong> has been approved.</p>
        <p>Your official offer letter is now available for download:</p>
        <p><a href="${downloadUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Download Offer Letter (PDF)</a></p>
        <p style="font-size: 13px; color: #64748b;">This secure download link is valid for 72 hours.</p>
      </div>
    `
  };

  try {
    const transport = getOfferTransporter();
    const info = await transport.sendMail(mailOptions);

    const isSimulated = info.messageId && info.messageId.startsWith('mock-');
    job.status = isSimulated ? 'SIMULATED' : 'PROVIDER_ACCEPTED';
    job.providerMessageId = info.messageId;
    job.providerResponse = typeof info.response === 'string' ? info.response : JSON.stringify(info.response);
    job.lastAttemptAt = new Date();
    job.lastError = undefined;
    await job.save();

    application.offerDeliveryState = job.status;
    await application.save();

    return { success: true, status: job.status, messageId: info.messageId };
  } catch (err) {
    job.lastAttemptAt = new Date();
    job.lastError = err.message;

    // Distinguish unknown connection timeouts from definitive rejection
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
      job.status = 'DELIVERY_UNKNOWN';
      job.reconciliationRequired = true;
    } else if (job.attempts >= job.maxAttempts) {
      job.status = 'FAILED';
    } else {
      job.status = 'QUEUED'; // Re-queue for next attempt
    }
    await job.save();

    application.offerDeliveryState = job.status;
    await application.save();

    return { success: false, status: job.status, error: err.message };
  }
}

/**
 * Reconciles an OfferDeliveryJob that was in DELIVERY_UNKNOWN status.
 */
async function reconcileOfferJob(jobId, resolution, notes, adminId, providerMessageId) {
  const job = await OfferDeliveryJob.findById(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (resolution !== 'RESOLVED_ACCEPTED' && resolution !== 'RESOLVED_FAILED') {
    throw new Error('Resolution must be either RESOLVED_ACCEPTED or RESOLVED_FAILED');
  }

  job.status = resolution === 'RESOLVED_ACCEPTED' ? 'PROVIDER_ACCEPTED' : 'FAILED';
  job.reconciliationRequired = false;
  job.reconciliationNotes = notes;
  job.reconciledAt = new Date();
  job.reconciledBy = adminId;
  if (providerMessageId) {
    job.providerMessageId = providerMessageId;
  }
  await job.save();

  await Application.updateOne(
    { applicationId: job.applicationId },
    { $set: { offerDeliveryState: job.status } }
  );

  await AuditLog.create({
    actorId: adminId,
    actorType: 'ADMIN',
    action: 'RECONCILE_DELIVERY_JOB',
    targetEntity: 'OFFER_DELIVERY_JOB',
    targetId: job._id,
    summary: `Reconciled job ${job._id} to ${job.status}. Notes: ${notes || 'none'}`
  });

  return job;
}

/**
 * Renews an expiring offer download bearer link without regenerating the PDF.
 * Revokes the previous token JTI and creates a fresh 72-hour token.
 */
async function renewOfferDownloadLink(offerLetterId, adminId) {
  const offer = await OfferLetter.findById(offerLetterId);
  if (!offer) {
    throw new Error(`Offer letter ${offerLetterId} not found`);
  }

  // Revoke old token and assign fresh JTI
  const newJti = crypto.randomUUID();
  const { token, expiresAt } = createOfferDownloadToken(offer._id, offer.applicationId, newJti);

  offer.downloadToken = newJti;
  offer.downloadTokenExpiresAt = expiresAt;
  offer.downloadTokenRevokedAt = null;
  await offer.save();

  await AuditLog.create({
    actorId: adminId,
    actorType: 'ADMIN',
    action: 'RENEW_OFFER_DOWNLOAD_TOKEN',
    targetEntity: 'OFFER_LETTER',
    targetId: offer._id,
    summary: `Renewed offer download token for application ${offer.applicationId}`
  });

  const downloadUrl = `${env.FRONTEND_URL || 'http://localhost:5173'}/api/v1/offers/download/${token}`;

  return { token, downloadUrl, expiresAt };
}

module.exports = {
  createOfferDownloadToken,
  generateOfferForApplication,
  processOfferDeliveryJob,
  reconcileOfferJob,
  renewOfferDownloadLink,
  getOfferTransporter,
  setOfferTransporter
};
