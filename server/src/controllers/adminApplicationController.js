const Application = require('../models/Application');
const Participant = require('../models/Participant');
const OfferLetter = require('../models/OfferLetter');
const OfferDeliveryJob = require('../models/OfferDeliveryJob');
const OfferLetterTemplate = require('../models/OfferLetterTemplate');
const AuditLog = require('../models/AuditLog');
const offerService = require('../services/offerService');
const offerPdfService = require('../services/offerPdfService');

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

    const recipientEmail = application.participantId?.email || '';
    const dispatchMode = await offerService.getOfferDispatchMode(recipientEmail);

    res.json({
      success: true,
      application,
      dispatchMode
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
 * Previews applications currently blocked in BLOCKED_TEMPLATE state.
 * Returns exact recipient list (email, fullName, program, batch, applicationId) and count.
 */
exports.getBlockedPreview = async (req, res, next) => {
  try {
    const { programCode, batchId } = req.query || {};

    const activeTemplate = await OfferLetterTemplate.findOne({ isActive: true, isSample: false });

    const query = {
      status: 'APPROVED',
      $or: [
        { offerState: 'BLOCKED_TEMPLATE' },
        { offerDeliveryState: 'BLOCKED_TEMPLATE' }
      ]
    };

    if (programCode) query.programCode = programCode.trim().toUpperCase();
    if (batchId) query.batchId = batchId.trim().toUpperCase();

    const blockedApps = await Application.find(query)
      .limit(100)
      .populate('participantId', 'fullName email')
      .lean();

    const recipients = blockedApps.map((app) => ({
      applicationId: app.applicationId,
      fullName: app.participantId ? app.participantId.fullName : 'Applicant',
      email: app.participantId ? app.participantId.email : '',
      programCode: app.programCode,
      programTitle: app.programTitle,
      batchId: app.batchId
    }));

    res.json({
      success: true,
      count: recipients.length,
      recipients,
      canProcess: Boolean(activeTemplate),
      activeTemplate: activeTemplate ? {
        name: activeTemplate.name,
        version: activeTemplate.version
      } : null
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
    const { applicationIds } = req.body || {};

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'applicationIds must be a non-empty array of confirmed candidate IDs.'
      });
    }

    if (applicationIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 application IDs allowed per batch unblock request.'
      });
    }

    const activeTemplate = await OfferLetterTemplate.findOne({ isActive: true, isSample: false });
    if (!activeTemplate) {
      return res.status(400).json({
        success: false,
        message: 'No active custom offer template found. Cannot unblock applications with sample template.'
      });
    }

    const requestedIds = applicationIds.map((id) => String(id).trim().toUpperCase());
    const results = [];

    for (const appId of requestedIds) {
      const app = await Application.findOne({ applicationId: appId });
      if (!app) {
        results.push({ applicationId: appId, status: 'SKIPPED', reason: 'Application not found' });
        continue;
      }
      if (app.status !== 'APPROVED') {
        results.push({ applicationId: appId, status: 'SKIPPED', reason: `Status is ${app.status}, must be APPROVED` });
        continue;
      }
      const isBlocked = app.offerState === 'BLOCKED_TEMPLATE' || app.offerDeliveryState === 'BLOCKED_TEMPLATE';
      if (!isBlocked) {
        results.push({ applicationId: appId, status: 'SKIPPED', reason: `Offer state is ${app.offerState || 'NONE'}, not BLOCKED_TEMPLATE` });
        continue;
      }

      try {
        app.offerState = 'GENERATING';
        await app.save();

        const offerRes = await offerService.generateOfferForApplication(app.applicationId, { forceRegenerate: true });
        if (offerRes && offerRes.deliveryJob) {
          await offerService.processOfferDeliveryJob(offerRes.deliveryJob._id);
        }
        results.push({ applicationId: app.applicationId, status: 'PROCESSED' });
      } catch (err) {
        console.error('[SEND_BLOCKED_ERROR]', err);
        results.push({ applicationId: app.applicationId, status: 'FAILED', error: err.message });
      }
    }

    const processedCount = results.filter((r) => r.status === 'PROCESSED').length;
    const skippedCount = results.filter((r) => r.status === 'SKIPPED').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'UNBLOCK_APPLICATIONS_DELIVERY',
      targetEntity: 'OFFER_DELIVERY_JOB',
      summary: `Unblocked and processed ${processedCount} applications using template v${activeTemplate.version}`
    });

    res.json({
      success: true,
      processedCount,
      skippedCount,
      failedCount,
      results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retries offer generation and delivery for an APPROVED application with a FAILED offer state.
 */
exports.retryOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cleanId = id.trim().toUpperCase();

    const application = await Application.findOne({
      $or: [{ applicationId: cleanId }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    }).populate('participantId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'APPROVED') {
      return res.status(409).json({
        success: false,
        message: `Only APPROVED applications can have offer generation retried (current status: ${application.status}).`
      });
    }

    const isFailed = application.offerState === 'FAILED' || application.offerDeliveryState === 'FAILED';
    if (!isFailed) {
      return res.status(409).json({
        success: false,
        message: `Cannot retry offer: Application offer state is not FAILED (current state: ${application.offerState || application.offerDeliveryState}).`
      });
    }

    // Reset failure state and re-attempt generation
    application.offerState = 'GENERATING';
    application.offerError = undefined;
    await application.save();

    const offerResult = await offerService.generateOfferForApplication(application.applicationId, { forceRegenerate: true });
    if (offerResult && offerResult.deliveryJob && !offerResult.isSample) {
      await offerService.processOfferDeliveryJob(offerResult.deliveryJob._id);
    }

    const updatedApp = await Application.findById(application._id).populate('participantId');
    const recipientEmail = updatedApp.participantId?.email || '';
    const dispatchMode = await offerService.getOfferDispatchMode(recipientEmail);
    const deliveryOutcome = updatedApp.offerDeliveryState;

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'OFFER_RETRY',
      targetEntity: 'APPLICATION',
      targetId: application._id,
      summary: `Admin retried offer generation for application ${application.applicationId}`
    });

    res.json({
      success: true,
      message: `Offer generation retried successfully for ${application.applicationId}.`,
      application: updatedApp,
      deliveryOutcome,
      dispatchMode,
      offerResult
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Corrects candidate legal name on an APPROVED application whose offer generation FAILED.
 * Validates non-empty, trimmed, length capped, and glyph check before saving.
 */
exports.correctCandidateName = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName } = req.body;
    const cleanId = id.trim().toUpperCase();

    const application = await Application.findOne({
      $or: [{ applicationId: cleanId }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    }).populate('participantId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'APPROVED') {
      return res.status(409).json({
        success: false,
        message: 'Candidate name can only be corrected for APPROVED applications with a FAILED offer.'
      });
    }

    const isFailed = application.offerState === 'FAILED' || application.offerDeliveryState === 'FAILED';
    if (!isFailed) {
      return res.status(409).json({
        success: false,
        message: 'Candidate name can only be corrected for applications with a FAILED offer.'
      });
    }

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'fullName is required and cannot be empty.'
      });
    }

    const cleanName = fullName.trim();
    if (cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'fullName cannot exceed 100 characters.'
      });
    }

    // Run glyph check to ensure the new name can be rendered
    try {
      offerPdfService.validateCandidateNameGlyphs(cleanName);
    } catch (glyphErr) {
      return res.status(400).json({
        success: false,
        message: glyphErr.message
      });
    }

    const participant = await Participant.findById(application.participantId._id || application.participantId);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant record not found' });
    }

    const oldName = participant.fullName;
    participant.fullName = cleanName;
    participant.normalizedName = cleanName.toLowerCase().trim();
    await participant.save();

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'CANDIDATE_NAME_CORRECTED',
      targetEntity: 'PARTICIPANT',
      targetId: participant._id,
      summary: `Corrected candidate name for application ${application.applicationId} from "${oldName}" to "${cleanName}"`
    });

    res.json({
      success: true,
      message: `Candidate name corrected from "${oldName}" to "${cleanName}".`,
      fullName: cleanName
    });
  } catch (error) {
    next(error);
  }
};
