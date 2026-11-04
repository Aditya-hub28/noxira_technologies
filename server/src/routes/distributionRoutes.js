const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/distributionController');
const { requireAuth } = require('../middleware/auth');

router.get('/jobs', requireAuth, distributionController.listJobs);
router.post('/queue-batch', requireAuth, distributionController.queueBatch);
router.post('/retry/:id', requireAuth, distributionController.retryJob);
router.post('/jobs/:id/reconcile', requireAuth, distributionController.reconcileJob);
router.post('/reconcile/:id', requireAuth, distributionController.reconcileJob);

module.exports = router;
