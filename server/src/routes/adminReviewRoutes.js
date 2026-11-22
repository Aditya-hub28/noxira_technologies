const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  adminListReviews,
  adminApproveReview,
  adminRejectReview,
  adminDeleteReview
} = require('../controllers/reviewController');

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

router.get('/', adminListReviews);
router.patch('/:id/approve', adminApproveReview);
router.patch('/:id/reject', adminRejectReview);
router.delete('/:id', adminDeleteReview);

module.exports = router;
