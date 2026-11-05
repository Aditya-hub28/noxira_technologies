const Application = require('../models/Application');
const Participant = require('../models/Participant');
const OfferLetter = require('../models/OfferLetter');
const OfferDeliveryJob = require('../models/OfferDeliveryJob');
const OfferLetterTemplate = require('../models/OfferLetterTemplate');
const AuditLog = require('../models/AuditLog');
const offerService = require('../services/offerService');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * List applications with filtering, search, and pagination.
 */
exports.getApplications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.status) {
      const allowed = ['APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
      if (allowed.includes(req.query.status.toUpperCase())) {
        query.status = req.query.status.toUpperCase();
      }
    }

    if (req.query.programCode) {
      query.programCode = req.query.programCode.trim().toUpperCase();
    }

    if (req.query.batchId) {
      query.batchId = req.query.batchId.trim().toUpperCase();
    }

    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const cleanSearch = req.query.search.trim();
      const safeSearchRegex = new RegExp(escapeRegex(cleanSearch), 'i');

      // Find matching participants first
      const matchingParticipants = await Participant.find({
        $or: [
          { fullName: safeSearchRegex },
          { email: safeSearchRegex }
        ]
      }).select('_id').lean();

      const participantIds = matchingParticipants.map((p) => p._id);

      query.$or = [
        { applicationId: safeSearchRegex },
        { participantId: { $in: participantIds } }
      ];
    }

    const sortField = req.query.sortBy || 'appliedAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortDir };

    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('participantId', 'fullName email phone college branch graduationYear')
      .populate({
        path: 'offerLetterId',
        select: 'offerLetterId generationStatus issuedAt downloadTokenExpiresAt downloadTokenRevokedAt'
      })
      .lean();

    res.json({
      success: true,
      applications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detail for a single application.
 */
exports.getApplicationDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cleanId = id.trim().toUpperCase();

    const application = await Application.findOne({
      $or: [{ applicationId: cleanId }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    })
      .populate('participantId')
      .populate({
        path: 'offerLetterId',
        populate: { path: 'deliveryJobId' }
      })
      .populate('decidedBy', 'fullName email')
      .lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({
      success: true,
      application
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update single application status (APPROVE, REJECT, UNDER_REVIEW).
 */
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, adminNotes } = req.body;
    const cleanId = id.trim().toUpperCase();

    const allowed = ['UNDER_REVIEW', 'APPROVED', 'REJECTED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowed.join(', ')}`
      });
    }

    if (status === 'REJECTED' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting an application.'
      });
    }

    // Atomic conditional check: must be in APPLIED or UNDER_REVIEW
    const application = await Application.findOne({
      $or: [{ applicationId: cleanId }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status === 'APPROVED' || application.status === 'REJECTED') {
      return res.status(409).json({
        success: false,
        message: `Cannot transition application from final status ${application.status}.`
      });
    }

    const fromStatus = application.status;
    const now = new Date();

    const updateFields = {
      status,
      decidedAt: now,
      decidedBy: req.admin._id
    };

    if (adminNotes !== undefined) {
      updateFields.adminNotes = adminNotes.trim();
    }

    if (status === 'REJECTED') {
      updateFields.rejectionReason = rejectionReason.trim();
    } else {
      updateFields.rejectionReason = undefined;
    }

    const historyEntry = {
      fromStatus,
      toStatus: status,
      action: 'STATUS_UPDATE',
      actorId: req.admin._id,
      actorName: req.admin.fullName || req.admin.email,
      reason: status === 'REJECTED' ? rejectionReason.trim() : (adminNotes || ''),
      timestamp: now
    };

    const updatedApp = await Application.findOneAndUpdate(
      {
        _id: application._id,
        status: { $in: ['APPLIED', 'UNDER_REVIEW'] }
      },
      {
        $set: updateFields,
        $push: { history: historyEntry }
      },
      { new: true }
    ).populate('participantId');

    if (!updatedApp) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Application was modified by another action.'
      });
    }

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: status === 'APPROVED' ? 'APPLICATION_APPROVED' : status === 'REJECTED' ? 'APPLICATION_REJECTED' : 'APPLICATION_UNDER_REVIEW',
      targetEntity: 'APPLICATION',
      targetId: updatedApp._id,
      summary: `Application ${updatedApp.applicationId} transitioned from ${fromStatus} to ${status}`
    });

    let offerResult = null;
    if (status === 'APPROVED') {
      try {
        offerResult = await offerService.generateOfferForApplication(updatedApp.applicationId);
        if (offerResult && offerResult.deliveryJob && !offerResult.isSample) {
          // Process delivery job asynchronously or inline
          await offerService.processOfferDeliveryJob(offerResult.deliveryJob._id);
        }
      } catch (genErr) {
        console.error(`[OFFER_GEN_ERROR] For application ${updatedApp.applicationId}:`, genErr);
      }
    }

    res.json({
      success: true,
      message: `Application ${updatedApp.applicationId} updated to ${status}`,
      application: updatedApp,
      offerResult
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Batch approve or reject applications (up to 100 per call).
 */
exports.batchReviewApplications = async (req, res, next) => {
  try {
    const { applicationIds, action, rejectionReason, adminNotes } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'applicationIds must be a non-empty array.'
      });
    }

    if (applicationIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Batch size limit exceeded. Maximum 100 applications allowed per batch call.'
      });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({
        success: false,
        message: "action must be either 'APPROVE' or 'REJECT'."
      });
    }

    if (action === 'REJECT' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({
        success: false,
        message: 'rejectionReason is required when batch rejecting applications.'
      });
    }

    const targetStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const now = new Date();

    const successes = [];
    const failures = [];

    for (const rawId of applicationIds) {
      const cleanId = String(rawId).trim().toUpperCase();

      try {
        const app = await Application.findOne({
          $or: [{ applicationId: cleanId }, { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null }]
        });

        if (!app) {
          failures.push({ id: cleanId, reason: 'Not found' });
          continue;
        }

        if (app.status === 'APPROVED' || app.status === 'REJECTED') {
          failures.push({
            id: cleanId,
            reason: `Already in final status ${app.status}`
          });
          continue;
        }

        const updateSet = {
          status: targetStatus,
          decidedAt: now,
          decidedBy: req.admin._id
        };

        if (adminNotes) {
          updateSet.adminNotes = adminNotes.trim();
        }

        if (targetStatus === 'REJECTED') {
          updateSet.rejectionReason = rejectionReason.trim();
        }

        const historyEntry = {
          fromStatus: app.status,
          toStatus: targetStatus,
          action: 'BATCH_STATUS_UPDATE',
          actorId: req.admin._id,
          actorName: req.admin.fullName || req.admin.email,
          reason: targetStatus === 'REJECTED' ? rejectionReason.trim() : (adminNotes || ''),
          timestamp: now
        };

        const updated = await Application.findOneAndUpdate(
          {
            _id: app._id,
            status: { $in: ['APPLIED', 'UNDER_REVIEW'] }
          },
          {
            $set: updateSet,
            $push: { history: historyEntry }
          },
          { new: true }
        );

        if (!updated) {
          failures.push({ id: cleanId, reason: 'Concurrent status modification' });
          continue;
        }

        // Trigger offer if approved
        if (targetStatus === 'APPROVED') {
          try {
            const offerRes = await offerService.generateOfferForApplication(updated.applicationId);
            if (offerRes && offerRes.deliveryJob && !offerRes.isSample) {
              await offerService.processOfferDeliveryJob(offerRes.deliveryJob._id);
            }
          } catch (offerErr) {
            console.error(`[BATCH_OFFER_ERR] ${cleanId}:`, offerErr.message);
          }
        }

        successes.push({
          id: cleanId,
          applicationId: updated.applicationId,
          status: updated.status
        });
      } catch (err) {
        failures.push({ id: cleanId, reason: err.message });
      }
    }

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: action === 'APPROVE' ? 'BATCH_APPLICATION_APPROVE' : 'BATCH_APPLICATION_REJECT',
      targetEntity: 'APPLICATION',
      summary: `Batch ${action}: ${successes.length} succeeded, ${failures.length} failed`
    });

    res.json({
      success: true,
      summary: {
        total: applicationIds.length,
        succeeded: successes.length,
        failed: failures.length
      },
      successes,
      failures
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renews an expiring offer download bearer token.
 */
exports.renewOfferDownloadLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cleanId = id.trim().toUpperCase();

    const application = await Application.findOne({
      $or: [{ applicationId: cleanId }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!application.offerLetterId) {
      return res.status(400).json({
        success: false,
        message: 'No offer letter exists for this application'
      });
    }

    const result = await offerService.renewOfferDownloadLink(application.offerLetterId, req.admin._id);

    res.json({
      success: true,
      message: 'Offer letter download link renewed successfully.',
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Triggers delivery / backlog processing for blocked applications once a real template is activated.
 */
exports.sendBlockedApplications = async (req, res, next) => {
  try {
    const { programCode, batchId } = req.body || {};

    const activeTemplate = await OfferLetterTemplate.findOne({ isActive: true, isSample: false });
    if (!activeTemplate) {
      return res.status(400).json({
        success: false,
        message: 'No active custom offer template found. Cannot unblock applications with sample template.'
      });
    }

    const query = {
      status: 'APPROVED',
      $or: [
        { offerState: 'BLOCKED_TEMPLATE' },
        { offerDeliveryState: 'BLOCKED_TEMPLATE' }
      ]
    };

    if (programCode) query.programCode = programCode.trim().toUpperCase();
    if (batchId) query.batchId = batchId.trim().toUpperCase();

    const blockedApps = await Application.find(query).limit(100);

    const results = [];
    for (const app of blockedApps) {
      try {
        // Regenerate with the now-active non-sample template
        // Reset state so generateOfferForApplication regenerates with the real template
        app.offerState = 'GENERATING';
        await app.save();

        const offerRes = await offerService.generateOfferForApplication(app.applicationId, { forceRegenerate: true });
        if (offerRes && offerRes.deliveryJob) {
          await offerService.processOfferDeliveryJob(offerRes.deliveryJob._id);
        }
        results.push({ applicationId: app.applicationId, status: 'PROCESSED' });
      } catch (err) {
        results.push({ applicationId: app.applicationId, status: 'FAILED', error: err.message });
      }
    }

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'UNBLOCK_APPLICATIONS_DELIVERY',
      targetEntity: 'OFFER_DELIVERY_JOB',
      summary: `Unblocked and processed ${results.filter(r => r.status === 'PROCESSED').length} applications using template v${activeTemplate.version}`
    });

    res.json({
      success: true,
      processedCount: results.filter((r) => r.status === 'PROCESSED').length,
      failedCount: results.filter((r) => r.status === 'FAILED').length,
      results
    });
  } catch (error) {
    next(error);
  }
};
