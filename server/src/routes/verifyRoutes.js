const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verifyController');
const { verifyRateLimiter } = require('../middleware/rateLimiter');

// Public verification: ZERO PII returned
router.get('/verify/:token', verifyRateLimiter, verifyController.verifyByToken);

// Private download: protected by 72-hour 128-bit scoped token
router.get('/download/:downloadToken', verifyController.downloadCertificate);

module.exports = router;
