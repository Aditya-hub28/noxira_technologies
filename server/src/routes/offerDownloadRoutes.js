const express = require('express');
const router = express.Router();
const offerDownloadController = require('../controllers/offerDownloadController');
const studentDataController = require('../controllers/studentDataController');
const { offerDownloadRateLimiter, statusRateLimiter } = require('../middleware/rateLimiter');

router.get('/lookup', statusRateLimiter, studentDataController.lookupOfferLetter);
router.get('/download/:token', offerDownloadRateLimiter, offerDownloadController.downloadOfferLetter);

module.exports = router;
