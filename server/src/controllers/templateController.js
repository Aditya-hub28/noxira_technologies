const path = require('path');
const fs = require('fs');
const Template = require('../models/Template');
const { generateCertificatePdf } = require('../services/pdfService');

exports.getTemplates = async (req, res, next) => {
  try {
    let template = await Template.findOne({ isActive: true });
    if (!template) {
      template = await Template.create({
        title: 'Official NOXIRA Certificate Template',
        version: '1.0.0',
        isActive: true
      });
    }
    res.json({ success: true, template });
  } catch (error) {
    next(error);
  }
};

exports.uploadBackground = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file (PNG/JPG)' });
    }

    const storageDir = path.resolve(__dirname, '../../storage/templates');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `template_bg_${Date.now()}${ext}`;
    const targetPath = path.join(storageDir, filename);

    await fs.promises.writeFile(targetPath, req.file.buffer);

    let template = await Template.findOne({ isActive: true });
    if (!template) {
      template = new Template({ title: 'NOXIRA Custom Template', version: '1.1.0' });
    }

    template.backgroundAssetPath = targetPath;
    template.useCustomBackground = true;
    await template.save();

    res.json({
      success: true,
      message: 'Background template uploaded successfully!',
      template
    });
  } catch (error) {
    next(error);
  }
};

exports.saveLayout = async (req, res, next) => {
  try {
    const { layout, signatory, useCustomBackground } = req.body;

    let template = await Template.findOne({ isActive: true });
    if (!template) {
      template = new Template({ title: 'NOXIRA Custom Template' });
    }

    if (layout) template.layout = { ...template.layout, ...layout };
    if (signatory) template.signatory = { ...template.signatory, ...signatory };
    if (typeof useCustomBackground !== 'undefined') template.useCustomBackground = useCustomBackground;

    await template.save();

    res.json({
      success: true,
      message: 'Template layout saved successfully!',
      template
    });
  } catch (error) {
    next(error);
  }
};

exports.resetToDefaultBorder = async (req, res, next) => {
  try {
    let template = await Template.findOne({ isActive: true });
    if (template) {
      template.useCustomBackground = false;
      template.backgroundAssetPath = null;
      await template.save();
    }
    res.json({ success: true, message: 'Reset to official NOXIRA vector border template' });
  } catch (error) {
    next(error);
  }
};

exports.previewRender = async (req, res, next) => {
  try {
    const {
      recipientName = 'Aditya Narayan Jha',
      programTitle = 'Full Stack Digital Engineering & Cloud Architecture',
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      signatoryName = 'Aditya Jha',
      signatoryTitle = 'Managing Director & Lead Architect',
      customLayout = null,
      useCustomBackground = null
    } = req.body;

    const dummyCertNumber = 'NOX-2026-PREVIEW-0000';
    const dummyToken = 'preview_draft_token_00000000000000';

    const activeTemplate = await Template.findOne({ isActive: true });
    const bgPath = (useCustomBackground ?? activeTemplate?.useCustomBackground) ? activeTemplate?.backgroundAssetPath : null;

    const pdfBuffer = await generateCertificatePdf({
      recipientName,
      programTitle,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      issueDate: new Date(),
      certificateNumber: dummyCertNumber,
      publicVerificationToken: dummyToken,
      signatoryName: signatoryName || activeTemplate?.signatory?.name,
      signatoryTitle: signatoryTitle || activeTemplate?.signatory?.title,
      isDraft: true,
      backgroundImagePath: bgPath,
      customLayout: customLayout || activeTemplate?.layout
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview-certificate.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
