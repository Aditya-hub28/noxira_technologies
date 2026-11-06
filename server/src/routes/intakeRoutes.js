const express = require('express');
const router = express.Router();
const intakeController = require('../controllers/intakeController');
const form1ImportController = require('../controllers/form1ImportController');
const form2ImportController = require('../controllers/form2ImportController');
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

// Protected Admin Form 1 Import Wizard
router.post('/form1-preview', requireAuth, uploadCsv.single('csvFile'), form1ImportController.previewForm1);
router.post('/form1-commit', requireAuth, form1ImportController.commitForm1);

// Protected Admin Form 2 (final submission) Import Wizard
router.post('/form2-preview', requireAuth, uploadCsv.single('csvFile'), form2ImportController.previewForm2);
router.post('/form2-commit', requireAuth, form2ImportController.commitForm2);
router.get('/submissions', requireAuth, form2ImportController.getSubmissions);
router.patch('/submissions/:submissionId/payment', requireAuth, form2ImportController.markPayment);

module.exports = router;
