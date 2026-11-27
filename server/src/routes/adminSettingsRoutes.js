const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { getAdminGoogleForm1, updateGoogleForm1, getAdminWhatsapp, updateWhatsapp } = require('../controllers/settingsController');

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

router.get('/google-form-1', getAdminGoogleForm1);
router.put('/google-form-1', updateGoogleForm1);
router.get('/whatsapp', getAdminWhatsapp);
router.put('/whatsapp', updateWhatsapp);

module.exports = router;
