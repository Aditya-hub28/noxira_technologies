const nodemailer = require('nodemailer');
const env = require('../config/env');
const DeliveryJob = require('../models/DeliveryJob');
const Certificate = require('../models/Certificate');
const Participant = require('../models/Participant');
const AuditLog = require('../models/AuditLog');
const { generate128BitToken } = require('./qrService');

// Create reusable transporter
let transporter = null;
function getTransporter() {
  if (!transporter) {
    if (env.SMTP.USER && env.SMTP.PASS) {
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
      // Mock transporter for development/testing
      transporter = {
        sendMail: async (mailOptions) => {
          console.log(`[SIMULATED EMAIL SENT] to: ${mailOptions.to} | Subject: ${mailOptions.subject}`);
          return {
            messageId: `mock-msg-${Date.now()}-${generate128BitToken().slice(0, 8)}`,
            response: '250 OK: Simulated acceptance by mock gateway'
          };
        }
      };
    }
  }
  return transporter;
}

/**
 * Creates or updates delivery jobs for a batch of certificates
 */
async function queueCertificateEmails(certificateIds, adminId) {
  const jobs = [];

  for (const certId of certificateIds) {
    const cert = await Certificate.findById(certId).populate('participantId');
    if (!cert || cert.status !== 'ISSUED') continue;

    // Check if job already exists
    let existingJob = await DeliveryJob.findOne({ certificateId: cert._id });
    if (!existingJob) {
      // Generate 128-bit scoped token for private download (valid for 72 hours)
      const downloadToken = generate128BitToken();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      existingJob = new DeliveryJob({
        certificateId: cert._id,
        participantId: cert.participantId._id,
        recipientEmail: cert.participantId.email,
        downloadToken,
        downloadTokenExpiresAt: expiresAt,
        status: 'QUEUED'
      });
      await existingJob.save();
    }
    jobs.push(existingJob);
  }

  // Audit Log
  await AuditLog.create({
    actorId: adminId,
    actorType: 'ADMIN',
    action: 'EMAIL_DISPATCH_QUEUED',
    targetEntity: 'DELIVERY_JOB',
    summary: `Queued ${jobs.length} certificate email dispatch jobs`
  });

  return jobs;
}

/**
 * Dispatches a single queued delivery job with retry reconciliation
 */
async function processDeliveryJob(jobId) {
  const job = await DeliveryJob.findById(jobId).populate({
    path: 'certificateId',
    populate: { path: 'participantId' }
  });

  if (!job) throw new Error('Job not found');

  const cert = job.certificateId;
  const participant = cert.participantId;

  job.status = 'PROCESSING';
  job.attempts += 1;
  job.lastAttemptAt = new Date();
  await job.save();

  const downloadLink = `${env.VERIFY_BASE_URL}/api/v1/public/download/${job.downloadToken}`;
  const verificationLink = `${env.VERIFY_BASE_URL}/verify/${cert.publicVerificationToken}`;

  const mailOptions = {
    from: `"NOXIRA Credentials" <${env.SMTP.FROM}>`,
    to: job.recipientEmail,
    subject: `Your Certificate of Achievement: ${cert.programTitle} [${cert.certificateNumber}]`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #d97706; margin: 0; font-size: 20px; letter-spacing: 1px;">NOXIRA TECHNOLOGIES</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Official Credential Distribution</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Dear <strong>${participant.fullName}</strong>,</p>
          <p>Congratulations! Your official Certificate of Achievement for <strong>${cert.programTitle}</strong> has been issued.</p>
          
          <div style="background: #f8fafc; border-left: 4px solid #d97706; padding: 12px 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Certificate ID:</strong> ${cert.certificateNumber}</p>
            <p style="margin: 4px 0 0 0; font-size: 14px;"><strong>Issued On:</strong> ${new Date(cert.renderedSnapshot.issueDate).toLocaleDateString()}</p>
          </div>

          <p style="text-align: center; margin: 28px 0;">
            <a href="${downloadLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Download Official PDF
            </a>
          </p>

          <p style="font-size: 12px; color: #64748b; text-align: center;">
            (This private download link is valid for 72 hours. Do not share your private download link.)
          </p>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

          <p style="font-size: 13px; color: #475569;">
            Anyone can verify your certificate's authenticity online at our public verification portal:
            <br />
            <a href="${verificationLink}" style="color: #d97706;">${verificationLink}</a>
          </p>
        </div>
      </div>
    `
  };

  try {
    const mailClient = getTransporter();
    const info = await mailClient.sendMail(mailOptions);

    job.gatewayMessageId = info.messageId;
    job.status = 'PROVIDER_ACCEPTED'; // Gateway accepted for delivery
    job.lastError = null;
    await job.save();

    return job;
  } catch (error) {
    job.lastError = error.message;
    
    // Check if timeout or ambiguous
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      job.status = 'DELIVERY_UNKNOWN';
      job.adminOverrideNeeded = true; // Avoid blind resend
    } else {
      job.status = job.attempts >= 3 ? 'FAILED' : 'QUEUED';
    }
    await job.save();
    throw error;
  }
}

module.exports = {
  queueCertificateEmails,
  processDeliveryJob
};
