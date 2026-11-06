const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { getAdminGoogleForm1, updateGoogleForm1 } = require('../controllers/settingsController');

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

router.get('/google-form-1', getAdminGoogleForm1);
router.put('/google-form-1', updateGoogleForm1);

module.exports = router;
