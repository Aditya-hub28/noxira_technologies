const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, certificateController.getCertificates);
router.post('/issue-batch', requireAuth, certificateController.issueBatch);
router.post('/:id/revoke', requireAuth, certificateController.revokeCertificate);
router.post('/:id/replace', requireAuth, certificateController.replaceCertificate);

module.exports = router;
