const express = require('express');
const router = express.Router();
const participantController = require('../controllers/participantController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, participantController.getParticipants);
router.patch('/:id/completion', requireAuth, participantController.updateCompletionStatus);

module.exports = router;
