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
 * Strict Safety Requirements:
 * - Atomic conditional state transition (findOneAndUpdate on status: DELIVERY_UNKNOWN) to prevent concurrent races.
 * - Detailed reconciliationNotes (min 10 chars) are strictly required.
 * - For MARK_DELIVERED: providerMessageId is mandatory proof from provider logs.
 * - For RESET_FOR_RETRY: safely resets status to FAILED and clears override flags for clean retry.
 */
exports.reconcileJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolution, reconciliationNotes, providerMessageId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery job ID format' });
    }

    // 1. Mandatory resolution validation
    if (!resolution || !['MARK_DELIVERED', 'RESET_FOR_RETRY'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resolution. Must be either "MARK_DELIVERED" or "RESET_FOR_RETRY".'
      });
    }

    // 2. Mandatory detailed reconciliation evidence notes (prevents unverified arbitrary status flipping)
    if (!reconciliationNotes || typeof reconciliationNotes !== 'string' || reconciliationNotes.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Detailed reconciliation notes are required (minimum 10 characters) citing evidence from the email provider gateway logs.'
      });
    }
    const cleanNotes = reconciliationNotes.trim();

    // 3. For MARK_DELIVERED: providerMessageId is mandatory concrete evidence of delivery
    let cleanProviderMsgId = null;
    if (resolution === 'MARK_DELIVERED') {
      if (!providerMessageId || typeof providerMessageId !== 'string' || providerMessageId.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'A valid providerMessageId is mandatory when marking a job as DELIVERED (e.g. message ID from SendGrid/SES/Postmark gateway logs).'
        });
      }
      cleanProviderMsgId = providerMessageId.trim();
    } else if (providerMessageId && typeof providerMessageId === 'string') {
      cleanProviderMsgId = providerMessageId.trim();
    }

    // 4. Check existence and current status
    const existingJob = await DeliveryJob.findById(id);
    if (!existingJob) {
      return res.status(404).json({ success: false, message: 'Delivery job not found' });
    }

    if (existingJob.status !== 'DELIVERY_UNKNOWN') {
      return res.status(409).json({
        success: false,
        message: `Job is currently in status "${existingJob.status}". Only DELIVERY_UNKNOWN jobs can be reconciled.`
      });
    }

    const adminEmail = req.admin?.email || 'admin@noxira.com';
    const timestamp = new Date().toISOString();

    const updateFields = {
      adminOverrideNeeded: false,
      lockId: null,
      leaseExpiresAt: null
    };

    let actionSummary = '';
    let auditAction = '';

    if (resolution === 'MARK_DELIVERED') {
      updateFields.status = 'DELIVERED';
      updateFields.providerMessageId = cleanProviderMsgId;
      updateFields.gatewayMessageId = cleanProviderMsgId;
      actionSummary = `[RECONCILED: MARK_DELIVERED by ${adminEmail} at ${timestamp} (Gateway ID: ${cleanProviderMsgId})]: ${cleanNotes}`;
      auditAction = 'DELIVERY_RECONCILED_DELIVERED';
    } else {
      updateFields.status = 'FAILED';
      // Reset unfulfilled attempt count so the un-sent dispatch does not count against future retry caps
      updateFields.attempts = Math.max(0, (existingJob.attempts || 1) - 1);
      actionSummary = `[RECONCILED: RESET_FOR_RETRY by ${adminEmail} at ${timestamp}]: ${cleanNotes} (Attempt counter restored)`;
      auditAction = 'DELIVERY_RECONCILED_RESET';
    }

    updateFields.reconciliationNotes = (existingJob.reconciliationNotes ? `${existingJob.reconciliationNotes}\n` : '') + actionSummary;

    // 5. ATOMIC conditional update: strictly match where status is still DELIVERY_UNKNOWN
    const updatedJob = await DeliveryJob.findOneAndUpdate(
      { _id: id, status: 'DELIVERY_UNKNOWN' },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedJob) {
      return res.status(409).json({
        success: false,
        message: 'Reconciliation conflict: This job was concurrently modified or already reconciled by another administrator.'
      });
    }

    // 6. Audit Trail (only executed by the winning atomic update)
    await AuditLog.create({
      actorId: req.admin?._id,
      actorType: 'ADMIN',
      action: auditAction,
      targetEntity: 'DELIVERY_JOB',
      summary: `Admin ${adminEmail} reconciled DELIVERY_UNKNOWN job ${updatedJob._id} as ${updateFields.status}`
    });

    res.json({
      success: true,
      message: resolution === 'MARK_DELIVERED'
        ? 'Delivery job confirmed and marked as DELIVERED after provider gateway reconciliation.'
        : 'Delivery job reset to FAILED. It is now safely eligible for retry.',
      job: updatedJob
    });
  } catch (error) {
    next(error);
  }
};
