const Review = require('../models/Review');
const AuditLog = require('../models/AuditLog');

const NAME_MIN = 2;
const NAME_MAX = 60;
const ROLE_MIN = 2;
const ROLE_MAX = 80;
const TEXT_MIN = 10;
const TEXT_MAX = 600;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * POST /api/v1/reviews
 * Public submission. Always stored as PENDING; nothing becomes public
 * until an admin approves it in the console.
 */
async function submitReview(req, res, next) {
  try {
    const name = cleanString(req.body?.name);
    const role = cleanString(req.body?.role);
    const text = cleanString(req.body?.text ?? req.body?.feedback);
    const rating = Number(req.body?.rating);
    // Honeypot: real users never see or fill this field. Bots that do are
    // told "success" but nothing is stored.
    const honeypot = cleanString(req.body?.website);
    if (honeypot) {
      return res.status(201).json({ success: true, message: 'Thank you! Your feedback was submitted.' });
    }

    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      return res.status(400).json({ success: false, message: `Name must be ${NAME_MIN}-${NAME_MAX} characters.` });
    }
    if (role.length < ROLE_MIN || role.length > ROLE_MAX) {
      return res.status(400).json({ success: false, message: `Role must be ${ROLE_MIN}-${ROLE_MAX} characters.` });
    }
    if (text.length < TEXT_MIN || text.length > TEXT_MAX) {
      return res.status(400).json({ success: false, message: `Feedback must be ${TEXT_MIN}-${TEXT_MAX} characters.` });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a whole number between 1 and 5.' });
    }

    const review = await Review.create({ name, role, text, rating });
    return res.status(201).json({
      success: true,
      message: 'Thank you! Your feedback was submitted and will appear after review.',
      reviewId: review._id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reviews
 * Public list. Approved reviews only, public fields only, newest first.
 */
async function listApprovedReviews(req, res, next) {
  try {
    const reviews = await Review.find({ status: 'APPROVED' })
      .select('name role text rating createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reviews?status=PENDING|APPROVED|REJECTED|ALL
 */
async function adminListReviews(req, res, next) {
  try {
    const status = cleanString(req.query.status || 'PENDING').toUpperCase();
    const filter = ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? { status } : {};
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    const counts = await Review.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } }
    ]);
    const byStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.n }), {});
    return res.json({ success: true, count: reviews.length, counts: byStatus, reviews });
  } catch (err) {
    next(err);
  }
}

async function moderateReview(req, res, next, action) {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }
    review.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    review.moderatedBy = req.admin._id;
    review.moderatedAt = new Date();
    await review.save();

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: action === 'APPROVE' ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
      targetEntity: 'REVIEW',
      targetId: review._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      summary: `${action === 'APPROVE' ? 'Approved' : 'Rejected'} student review by ${review.name} (${review.role})`
    });

    return res.json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/admin/reviews/:id/approve */
async function adminApproveReview(req, res, next) {
  return moderateReview(req, res, next, 'APPROVE');
}

/** PATCH /api/v1/admin/reviews/:id/reject */
async function adminRejectReview(req, res, next) {
  return moderateReview(req, res, next, 'REJECT');
}

/** DELETE /api/v1/admin/reviews/:id - permanent removal */
async function adminDeleteReview(req, res, next) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }
    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'REVIEW_DELETED',
      targetEntity: 'REVIEW',
      targetId: review._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      summary: `Deleted student review by ${review.name} (${review.role})`
    });
    return res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitReview,
  listApprovedReviews,
  adminListReviews,
  adminApproveReview,
  adminRejectReview,
  adminDeleteReview
};
