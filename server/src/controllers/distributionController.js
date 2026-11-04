const DeliveryJob = require('../models/DeliveryJob');
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
