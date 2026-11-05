const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminOfferTemplateController = require('../controllers/adminOfferTemplateController');
const { requireAuth } = require('../middleware/auth');

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for offer letter templates.'), false);
    }
  }
});

router.use(requireAuth);

router.get('/', adminOfferTemplateController.getTemplates);
router.get('/:id', adminOfferTemplateController.getTemplateDetail);
router.get('/:id/pdf', adminOfferTemplateController.getTemplatePdf);
router.post('/upload', pdfUpload.single('templatePdf'), adminOfferTemplateController.uploadTemplate);
router.put('/:id', adminOfferTemplateController.updateTemplate);
router.post('/:id/preview', adminOfferTemplateController.previewTemplate);
router.post('/:id/activate', adminOfferTemplateController.activateTemplate);

module.exports = router;
