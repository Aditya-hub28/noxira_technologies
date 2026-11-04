const mongoose = require('mongoose');
const DeliveryJob = require('../models/DeliveryJob');
const AuditLog = require('../models/AuditLog');
const { queueCertificateEmails, processClaimedJob, runWorkerCycle } = require('../services/emailService');
const { generate128BitToken } = require('../services/qrService');

exports.queueBatch = async (req, res, next) => {
  try {
    const { certificateIds } = req.body;

    if (!certificateIds || !Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of issued certificate IDs' });
    }

    const queuedJobs = await queueCertificateEmails(certificateIds, req.admin._id);

    // Launch worker cycle asynchronously to process queued jobs with atomic leases
    setImmediate(async () => {
      try {
        await runWorkerCycle();
      } catch (err) {
        console.error('Background email worker error:', err.message);
      }
    });

    res.json({
      success: true,
      message: `Successfully queued ${queuedJobs.length} email delivery jobs for dispatch.`,
      jobsCount: queuedJobs.length
    });
  } catch (error) {
    next(error);
  }
};

exports.listJobs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await DeliveryJob.countDocuments(query);
    const jobs = await DeliveryJob.find(query)
      .populate('certificateId', 'certificateNumber status renderedSnapshot')
      .populate('participantId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      jobs
    });
  } catch (error) {
    next(error);
  }
};

exports.retryJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery job ID format' });
    }
    
    // Read current state
    const job = await DeliveryJob.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Delivery job not found' });
    }

    // Protection against duplicate email sends
    if (['PROVIDER_ACCEPTED', 'DELIVERED'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'This email has already been accepted or delivered by the provider. Resending is blocked to prevent duplicate emails.'
      });
    }

    if (job.status === 'DELIVERY_UNKNOWN') {
      return res.status(409).json({
        success: false,
        message: 'Previous attempt outcome is uncertain (timeout). Please reconcile gateway logs before retrying to prevent duplicate emails.'
      });
    }

    if (job.status === 'PROCESSING') {
      return res.status(409).json({
        success: false,
        message: 'This delivery job is currently in-flight. Concurrent retry blocked.'
      });
    }

    // Atomic claim with lease: only proceed if status is FAILED
    const workerLockId = `retry-${Date.now()}-${generate128BitToken().slice(0, 8)}`;
    const claimedJob = await DeliveryJob.findOneAndUpdate(
      { _id: id, status: 'FAILED' },
      {
        $set: {
          status: 'PROCESSING',
          lockId: workerLockId,
          leaseExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
          adminOverrideNeeded: false,
          lastAttemptAt: new Date()
        }
      },
      { new: true }
    );

    if (!claimedJob) {
      return res.status(409).json({
        success: false,
        message: 'Job could not be claimed for retry. It may have already been retried or is currently processing.'
      });
    }

    const processed = await processClaimedJob(claimedJob._id, workerLockId);

    res.json({
      success: true,
      message: `Delivery attempt completed with status: ${processed.status}`,
      job: processed
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reconcile a DELIVERY_UNKNOWN job after administrator checks provider gateway logs.
 * Allowed resolutions:
 * - MARK_DELIVERED: Provider confirmed email arrived; marks status DELIVERED.
 * - RESET_FOR_RETRY: Provider confirmed email never sent; resets status to FAILED so it can be retried cleanly.
 */
exports.reconcileJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolution, reconciliationNotes, providerMessageId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery job ID format' });
    }

    const job = await DeliveryJob.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Delivery job not found' });
    }

    if (job.status !== 'DELIVERY_UNKNOWN') {
      return res.status(400).json({
        success: false,
        message: `Job is currently in status "${job.status}". Only DELIVERY_UNKNOWN jobs require reconciliation.`
      });
    }

    if (!['MARK_DELIVERED', 'RESET_FOR_RETRY'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resolution. Must be either "MARK_DELIVERED" or "RESET_FOR_RETRY".'
      });
    }

    const adminEmail = req.admin?.email || 'admin@noxira.com';
    const timestamp = new Date().toISOString();

    if (resolution === 'MARK_DELIVERED') {
      job.status = 'DELIVERED';
      job.adminOverrideNeeded = false;
      job.lockId = null;
      job.leaseExpiresAt = null;
      if (providerMessageId) {
        job.providerMessageId = providerMessageId;
        job.gatewayMessageId = providerMessageId;
      }
      job.reconciliationNotes = (job.reconciliationNotes ? `${job.reconciliationNotes}\n` : '') +
        `[RECONCILED: MARK_DELIVERED by ${adminEmail} at ${timestamp}]: ${reconciliationNotes || 'Verified delivered on email provider gateway.'}`;
      await job.save();

      await AuditLog.create({
        actorId: req.admin?._id,
        actorType: 'ADMIN',
        action: 'DELIVERY_RECONCILED_DELIVERED',
        targetEntity: 'DELIVERY_JOB',
        summary: `Admin ${adminEmail} reconciled DELIVERY_UNKNOWN job ${job._id} as DELIVERED`
      });

      return res.json({
        success: true,
        message: 'Delivery job marked as DELIVERED after provider reconciliation.',
        job
      });
    }

    if (resolution === 'RESET_FOR_RETRY') {
      job.status = 'FAILED';
      job.adminOverrideNeeded = false;
      job.lockId = null;
      job.leaseExpiresAt = null;
      job.reconciliationNotes = (job.reconciliationNotes ? `${job.reconciliationNotes}\n` : '') +
        `[RECONCILED: RESET_FOR_RETRY by ${adminEmail} at ${timestamp}]: ${reconciliationNotes || 'Confirmed not delivered on provider. Safely unlocked for retry.'}`;
      await job.save();

      await AuditLog.create({
        actorId: req.admin?._id,
        actorType: 'ADMIN',
        action: 'DELIVERY_RECONCILED_RESET',
        targetEntity: 'DELIVERY_JOB',
        summary: `Admin ${adminEmail} reset DELIVERY_UNKNOWN job ${job._id} to FAILED for retry`
      });

      return res.json({
        success: true,
        message: 'Delivery job reset to FAILED. It is now safely eligible for retry.',
        job
      });
    }
  } catch (error) {
    next(error);
  }
};
