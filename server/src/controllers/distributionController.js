const DeliveryJob = require('../models/DeliveryJob');
const { queueCertificateEmails, processDeliveryJob } = require('../services/emailService');

exports.queueBatch = async (req, res, next) => {
  try {
    const { certificateIds } = req.body;

    if (!certificateIds || !Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of issued certificate IDs' });
    }

    const queuedJobs = await queueCertificateEmails(certificateIds, req.admin._id);

    // Process queued jobs asynchronously in the background
    setImmediate(async () => {
      for (const job of queuedJobs) {
        try {
          await processDeliveryJob(job._id);
        } catch (err) {
          console.error(`Error processing job ${job._id}:`, err.message);
        }
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
    const job = await DeliveryJob.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Delivery job not found' });
    }

    // Reset admin override if previously blocked
    job.adminOverrideNeeded = false;
    await job.save();

    const processed = await processDeliveryJob(job._id);

    res.json({
      success: true,
      message: `Delivery attempt completed with status: ${processed.status}`,
      job: processed
    });
  } catch (error) {
    next(error);
  }
};
