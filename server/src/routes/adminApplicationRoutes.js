const express = require('express');
const router = express.Router();
const adminApplicationController = require('../controllers/adminApplicationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', adminApplicationController.getApplications);
router.get('/blocked-preview', adminApplicationController.getBlockedPreview);
router.get('/:id', adminApplicationController.getApplicationDetail);
router.patch('/:id/status', adminApplicationController.updateApplicationStatus);
router.post('/batch-review', adminApplicationController.batchReviewApplications);
router.post('/:id/renew-offer-link', adminApplicationController.renewOfferDownloadLink);
router.post('/send-blocked', adminApplicationController.sendBlockedApplications);

module.exports = router;
