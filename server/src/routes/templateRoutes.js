const express = require('express');
const router = express.Router();
const multer = require('multer');
const templateController = require('../controllers/templateController');
const { requireAuth } = require('../middleware/auth');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed for certificate backgrounds'), false);
    }
  }
});

router.get('/', requireAuth, templateController.getTemplates);
router.post('/upload-background', requireAuth, imageUpload.single('bgImage'), templateController.uploadBackground);
router.post('/save-layout', requireAuth, templateController.saveLayout);
router.post('/reset-border', requireAuth, templateController.resetToDefaultBorder);
router.post('/preview-render', requireAuth, templateController.previewRender);

module.exports = router;
