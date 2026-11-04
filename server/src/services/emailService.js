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
    if (env.NODE_ENV === 'production') {
      if (!env.SMTP.USER || !env.SMTP.PASS || env.SMTP.HOST === 'smtp.ethereal.email' || env.SMTP.USER === 'test@example.com') {
        throw new Error('[CRITICAL] SMTP transporter unconfigured or using insecure placeholders in production mode. Refusing to simulate or send real emails.');
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
    } else if (process.env.NODE_ENV !== 'test' && env.SMTP.USER && env.SMTP.PASS && env.SMTP.USER !== 'test@example.com' && env.SMTP.PASS !== 'password') {
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
      // Mock transporter for development/testing ONLY
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

function setTransporter(customTransporter) {
  transporter = customTransporter;
}

/**
 * Creates or updates delivery jobs for a batch of certificates
 */
async function queueCertificateEmails(certificateIds, adminId) {
  const jobs = [];

  for (const certId of certificateIds) {
    const cert = await Certificate.findById(certId).populate('participantId');
    if (!cert || cert.status !== 'ISSUED') continue;

    let existingJob = await DeliveryJob.findOne({ certificateId: cert._id });
    if (!existingJob) {
      const downloadToken = generate128BitToken();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      existingJob = new DeliveryJob({
        certificateId: cert._id,
        participantId: cert.participantId._id,
        recipientEmail: cert.participantId.email,
        downloadToken,
        downloadTokenExpiresAt: expiresAt,
        status: 'QUEUED',
        providerIdempotencyKey: `noxira-dist-${cert._id}`
      });
      await existingJob.save();
    }
    jobs.push(existingJob);
  }

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
 * Sweeps and recovers stale PROCESSING jobs after an interrupted process or crash.
 * If attempts > 0, the email may have reached provider -> marked DELIVERY_UNKNOWN to prevent duplicate sends.
 * If attempts === 0, safely resets to QUEUED.
 */
async function recoverStaleProcessingJobs(staleThresholdMs = 2 * 60 * 1000) {
  const cutoff = new Date(Date.now() - staleThresholdMs);

  const staleJobs = await DeliveryJob.find({
    status: 'PROCESSING',
    $or: [
      { leaseExpiresAt: { $lt: new Date() } },
      { leaseExpiresAt: null, lastAttemptAt: { $lt: cutoff } }
    ]
  });

  let recoveredToUnknown = 0;
  let recoveredToQueued = 0;

  for (const job of staleJobs) {
    if (job.attempts > 0) {
      // Possible that provider already received it before crash
      job.status = 'DELIVERY_UNKNOWN';
      job.adminOverrideNeeded = true;
      job.leaseExpiresAt = null;
      job.lockId = null;
      job.reconciliationNotes = 'Interrupted mid-flight during server crash or timeout; potential unconfirmed provider acceptance. Reconcile with gateway before resending.';
      await job.save();
      recoveredToUnknown++;
    } else {
      // Claimed but never attempted
      job.status = 'QUEUED';
      job.leaseExpiresAt = null;
      job.lockId = null;
      await job.save();
      recoveredToQueued++;
    }
  }

  return { recoveredToUnknown, recoveredToQueued, total: staleJobs.length };
}

/**
 * Atomically claims the next QUEUED job with a lease
 */
async function claimNextQueuedJob(workerLockId, leaseDurationMs = 2 * 60 * 1000) {
  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

  return DeliveryJob.findOneAndUpdate(
    { status: 'QUEUED' },
    {
      $set: {
        status: 'PROCESSING',
        lockId: workerLockId,
        leaseExpiresAt
      }
    },
    { new: true, sort: { createdAt: 1 } }
  );
}

/**
 * Processes a claimed delivery job with provider idempotency headers and retry-safe guards
 */
async function processClaimedJob(jobId, workerLockId) {
  const job = await DeliveryJob.findById(jobId).populate({
    path: 'certificateId',
    populate: { path: 'participantId' }
  });

  if (!job) throw new Error('Job not found');

  // Verify lock ownership if workerLockId supplied
  if (workerLockId && job.lockId && job.lockId !== workerLockId) {
    throw new Error('Job lease belongs to another worker instance');
  }

  const cert = job.certificateId;
  const participant = cert.participantId;

  // Generate provider idempotency key if not already present (stable per certificate)
  if (!job.providerIdempotencyKey) {
    job.providerIdempotencyKey = `noxira-dist-${cert._id}`;
  }

  job.status = 'PROCESSING';
  job.attempts += 1;
  job.lastAttemptAt = new Date();
  job.leaseExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
  await job.save();

  const downloadLink = `${env.API_BASE_URL || env.VERIFY_BASE_URL}/api/v1/public/download/${job.downloadToken}`;
  const verificationLink = `${env.VERIFY_BASE_URL}/verify/${cert.publicVerificationToken}`;

  const mailOptions = {
    from: `"NOXIRA Credentials" <${env.SMTP.FROM}>`,
    to: job.recipientEmail,
    subject: `Your Certificate of Achievement: ${cert.programTitle} [${cert.certificateNumber}]`,
    headers: {
      'X-Idempotency-Key': job.providerIdempotencyKey
    },
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
    job.status = 'PROVIDER_ACCEPTED'; // Provider accepted transmission
    job.lastError = null;
    job.leaseExpiresAt = null;
    job.lockId = null;
    await job.save();

    return job;
  } catch (error) {
    job.lastError = error.message;
    job.leaseExpiresAt = null;
    job.lockId = null;
    
    // Check if network timeout / socket dropped after handshake
    const isTimeout = error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      (error.message && /timeout|hangup|reset/i.test(error.message));

    if (isTimeout) {
      job.status = 'DELIVERY_UNKNOWN';
      job.adminOverrideNeeded = true;
      job.reconciliationNotes = 'Network socket timed out or connection dropped during transmission. Outcome uncertain; reconcile before retrying.';
    } else {
      job.status = job.attempts >= 3 ? 'FAILED' : 'QUEUED';
    }
    await job.save();
    throw error;
  }
}

/**
 * Worker execution cycle: recovers stale jobs, then claims & processes queued jobs
 */
async function runWorkerCycle() {
  const workerLockId = `worker-${Date.now()}-${generate128BitToken().slice(0, 8)}`;

  // Step 1: Recover any stale processing jobs from previous crashes
  await recoverStaleProcessingJobs();

  // Step 2: Process queued jobs sequentially
  let job = await claimNextQueuedJob(workerLockId);
  const processed = [];

  while (job) {
    try {
      const outcome = await processClaimedJob(job._id, workerLockId);
      processed.push(outcome);
    } catch (err) {
      console.warn(`Worker processing job ${job._id} ended with status: ${job.status} (${err.message})`);
    }
    // Claim next
    job = await claimNextQueuedJob(workerLockId);
  }

  return processed;
}

// Legacy helper for direct single-job execution
async function processDeliveryJob(jobId) {
  const workerLockId = `direct-${Date.now()}`;
  return processClaimedJob(jobId, workerLockId);
}

module.exports = {
  queueCertificateEmails,
  processDeliveryJob,
  processClaimedJob,
  claimNextQueuedJob,
  recoverStaleProcessingJobs,
  runWorkerCycle,
  setTransporter,
  getTransporter
};
