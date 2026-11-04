const express = require('express');
const router = express.Router();
const intakeController = require('../controllers/intakeController');
const { requireAuth } = require('../middleware/auth');
const { intakeRateLimiter } = require('../middleware/rateLimiter');
const { uploadCsv } = require('../middleware/upload');

// Public Website Intake Form (Rate limited)
router.post('/website-apply', intakeRateLimiter, intakeController.websiteApply);

// Protected Admin CSV Import Wizard
router.post('/csv-preview', requireAuth, uploadCsv.single('csvFile'), intakeController.previewCsv);
router.post('/csv-commit', requireAuth, intakeController.commitCsv);

module.exports = router;
