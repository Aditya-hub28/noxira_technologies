const express = require('express');
const router = express.Router();
const offerDownloadController = require('../controllers/offerDownloadController');

router.get('/download/:token', offerDownloadController.downloadOfferLetter);

module.exports = router;
