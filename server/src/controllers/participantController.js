const Participant = require('../models/Participant');
const AuditLog = require('../models/AuditLog');

exports.getParticipants = async (req, res, next) => {
  try {
    const { programCode, batchId, completionStatus, isIssued, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (programCode) query.programCode = programCode.toUpperCase();
    if (batchId) query.batchId = batchId.toUpperCase();
    if (completionStatus) query.completionStatus = completionStatus;
    if (typeof isIssued !== 'undefined' && isIssued !== '') query.isIssued = isIssued === 'true';

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Participant.countDocuments(query);
    const participants = await Participant.find(query)
      .populate('activeCertificateId', 'certificateNumber status publicVerificationToken')
      .populate('completionReviewerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      participants
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCompletionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, evidence } = req.body;

    if (!['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'REWORK'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid completion status' });
    }

    const participant = await Participant.findById(id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    // Safety: If certificate is already issued and admin tries to revoke eligibility
    if (participant.isIssued && status !== 'ELIGIBLE') {
      return res.status(400).json({
        success: false,
        message: 'This participant has already been issued a valid certificate. You must revoke or review the certificate directly in the Certificates section rather than silently changing their completion status.'
      });
    }

    const oldStatus = participant.completionStatus;
    participant.completionStatus = status;
    participant.completionEvidence = evidence || participant.completionEvidence;
    participant.completionReviewerId = req.admin._id;
    participant.completionReviewedAt = new Date();

    await participant.save();

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'COMPLETION_REVIEW',
      targetEntity: 'PARTICIPANT',
      targetId: participant._id,
      summary: `Admin ${req.admin.email} changed completion status for ${participant.fullName} from ${oldStatus} to ${status}`
    });

    res.json({
      success: true,
      message: `Participant completion status updated to ${status}`,
      participant
    });
  } catch (error) {
    next(error);
  }
};
