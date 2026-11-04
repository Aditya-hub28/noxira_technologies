const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/distributionController');
const { requireAuth } = require('../middleware/auth');

router.get('/jobs', requireAuth, distributionController.listJobs);
router.post('/queue-batch', requireAuth, distributionController.queueBatch);
router.post('/retry/:id', requireAuth, distributionController.retryJob);

module.exports = router;
