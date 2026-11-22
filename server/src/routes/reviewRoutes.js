const express = require('express');
const router = express.Router();
const { submitReview, listApprovedReviews } = require('../controllers/reviewController');
const { reviewSubmitRateLimiter, reviewListRateLimiter } = require('../middleware/rateLimiter');

router.get('/', reviewListRateLimiter, listApprovedReviews);
router.post('/', reviewSubmitRateLimiter, submitReview);

module.exports = router;
