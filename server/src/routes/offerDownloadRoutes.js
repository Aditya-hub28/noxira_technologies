const express = require('express');
const router = express.Router();
const offerDownloadController = require('../controllers/offerDownloadController');
const { offerDownloadRateLimiter } = require('../middleware/rateLimiter');

router.get('/download/:token', offerDownloadRateLimiter, offerDownloadController.downloadOfferLetter);

module.exports = router;
