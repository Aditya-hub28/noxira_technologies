const express = require('express');
const router = express.Router();
const intakeController = require('../controllers/intakeController');
const { requireAuth } = require('../middleware/auth');
const { intakeRateLimiter, statusRateLimiter } = require('../middleware/rateLimiter');
const { uploadCsv } = require('../middleware/upload');

// Public Website Intake Form (Rate limited)
router.post('/website-apply', intakeRateLimiter, intakeController.websiteApply);

// Public Application Status Check (Rate limited)
router.get('/status', statusRateLimiter, intakeController.getApplicationStatus);

// Protected Admin CSV Import Wizard
router.post('/csv-preview', requireAuth, uploadCsv.single('csvFile'), intakeController.previewCsv);
router.post('/csv-commit', requireAuth, intakeController.commitCsv);

module.exports = router;
