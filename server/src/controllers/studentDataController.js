const crypto = require('crypto');
const Participant = require('../models/Participant');
const Application = require('../models/Application');
const OfferLetter = require('../models/OfferLetter');
const AuditLog = require('../models/AuditLog');
const { createOfferDownloadToken } = require('../services/offerService');

/**
 * Account-scoped data for the logged-in student's dashboard.
 * A record is visible only when the student has PROVEN ownership of the
 * email it belongs to - either by verifying the account email (OTP) or by
 * claiming the application with its secret application ID. Registering an
 * account with someone else's address alone reveals nothing.
 */
async function visibleApplicationFilter(student, filter = {}) {
  const or = [{ claimedByStudentId: student._id }];
  if (student.emailVerifiedAt) {
    const email = student.email.toLowerCase().trim();
    const participants = await Participant.find({
      $or: [{ normalizedEmail: email }, { email }]
    }).select('_id');
    const participantIds = participants.map(p => p._id);
    if (participantIds.length > 0) {
      or.push({ participantId: { $in: participantIds } });
    }
  }
  return { ...filter, $or: or };
}

exports.getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find(await visibleApplicationFilter(req.student))
      .sort({ appliedAt: -1 })
      .select('applicationId programCode programTitle status appliedAt decidedAt offerState offerLetterId')
      .lean();

    res.json({
      success: true,
      applications: applications.map(a => ({
        applicationId: a.applicationId,
        programCode: a.programCode,
        programTitle: a.programTitle,
        status: a.status,
        appliedAt: a.appliedAt,
        decidedAt: a.decidedAt || null,
        offerAvailable: Boolean(a.offerLetterId)
      }))
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyOfferLetters = async (req, res, next) => {
  try {
    const applications = await Application.find(await visibleApplicationFilter(req.student, {
      status: 'APPROVED',
      offerLetterId: { $ne: null }
    })).select('applicationId programCode programTitle offerLetterId decidedAt').lean();

    const offers = [];
    for (const app of applications) {
      const offer = await OfferLetter.findById(app.offerLetterId);
      if (!offer) continue;

      // Reuse the live token JTI while valid; rotate when expired/revoked so the
      // student always gets a working link without invalidating a fresh email link.
      const now = Date.now();
      let jti = offer.downloadToken;
      if (!jti || offer.downloadTokenRevokedAt || !offer.downloadTokenExpiresAt || offer.downloadTokenExpiresAt.getTime() < now + 60 * 60 * 1000) {
        jti = crypto.randomUUID();
        offer.downloadToken = jti;
        offer.downloadTokenExpiresAt = new Date(now + 72 * 60 * 60 * 1000);
        offer.downloadTokenRevokedAt = null;
        await offer.save();
      }
      const { token } = createOfferDownloadToken(offer._id, offer.applicationId, jti);

      offers.push({
        offerLetterId: offer.offerLetterId,
        applicationId: app.applicationId,
        programCode: app.programCode,
        programTitle: app.programTitle,
        issuedAt: offer.issuedAt,
        downloadUrl: `/api/v1/offers/download/${token}`,
        downloadExpiresAt: offer.downloadTokenExpiresAt
      });
    }

    res.json({ success: true, offers });
  } catch (error) {
    next(error);
  }
};

/**
 * Public protected lookup: an applicant proves POSSESSION with three
 * factors - their registered email, the programme, and the application ID
 * that was issued only to them at apply time. Knowing someone's email and
 * programme alone (both easy to guess) returns nothing. Every failure mode
 * returns the identical generic 404.
 */
exports.lookupOfferLetter = async (req, res, next) => {
  try {
    const { email, programme, applicationId } = req.query;

    if (
      typeof email !== 'string' ||
      typeof programme !== 'string' ||
      typeof applicationId !== 'string' ||
      !email.trim() ||
      !programme.trim() ||
      !applicationId.trim() ||
      email.trim().length > 254 ||
      programme.trim().length > 32 ||
      applicationId.trim().length > 32
    ) {
      return res.status(400).json({ success: false, message: 'Email, programme and application ID are all required.' });
    }

    const generic404 = () => res.status(404).json({
      success: false,
      message: 'No offer letter found for the details provided.'
    });

    const normEmail = email.trim().toLowerCase();
    const cleanProgramme = programme.trim().toUpperCase();
    const cleanAppId = applicationId.trim().toUpperCase();

    const application = await Application.findOne({
      applicationId: cleanAppId,
      programCode: cleanProgramme,
      status: 'APPROVED',
      offerLetterId: { $ne: null }
    }).populate('participantId');
    if (!application || !application.participantId) return generic404();

    const participantEmail = (application.participantId.normalizedEmail || application.participantId.email || '').toLowerCase().trim();
    if (participantEmail !== normEmail) return generic404();

    const offer = await OfferLetter.findById(application.offerLetterId);
    if (!offer) return generic404();

    const now = Date.now();
    let jti = offer.downloadToken;
    if (!jti || offer.downloadTokenRevokedAt || !offer.downloadTokenExpiresAt || offer.downloadTokenExpiresAt.getTime() < now + 60 * 60 * 1000) {
      jti = crypto.randomUUID();
      offer.downloadToken = jti;
      offer.downloadTokenExpiresAt = new Date(now + 72 * 60 * 60 * 1000);
      offer.downloadTokenRevokedAt = null;
      await offer.save();
    }
    const { token } = createOfferDownloadToken(offer._id, offer.applicationId, jti);

    await AuditLog.create({
      actorType: 'PUBLIC_USER',
      action: 'OFFER_LOOKUP_LINK_ISSUED',
      targetEntity: 'OFFER_LETTER',
      targetId: offer._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      summary: `Offer download link issued via email+programme lookup for application ${application.applicationId}`
    });

    res.json({
      success: true,
      offer: {
        offerLetterId: offer.offerLetterId,
        applicationId: application.applicationId,
        programTitle: application.programTitle,
        downloadUrl: `/api/v1/offers/download/${token}`,
        downloadExpiresAt: offer.downloadTokenExpiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};
