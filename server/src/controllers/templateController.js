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
        signatory: {
          name: 'Aditya Jha',
          title: 'Managing Director & Lead Architect',
          organization: 'Noxira Technologies Private Limited'
        },
        layout: {
          signatory: {
            name: 'Aditya Jha',
            title: 'Managing Director & Lead Architect'
          }
        },
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

    // Clean up previous custom background file if exists
    if (template.backgroundAssetPath && fs.existsSync(template.backgroundAssetPath) && template.backgroundAssetPath !== targetPath) {
      try {
        await fs.promises.unlink(template.backgroundAssetPath);
      } catch (err) {
        // Non-blocking cleanup
      }
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

    // Safely extract plain object for existing layout
    const currentLayout = template.layout && typeof template.layout.toObject === 'function'
      ? template.layout.toObject()
      : (template.layout || {});

    if (layout && typeof layout === 'object') {
      const mergedLayout = { ...currentLayout };
      for (const [key, val] of Object.entries(layout)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          mergedLayout[key] = { ...(currentLayout[key] || {}), ...val };
        } else {
          mergedLayout[key] = val;
        }
      }
      template.layout = mergedLayout;
      template.markModified('layout');
    }

    if (signatory && typeof signatory === 'object') {
      const currentSig = template.signatory && typeof template.signatory.toObject === 'function'
        ? template.signatory.toObject()
        : (template.signatory || {});
      template.signatory = { ...currentSig, ...signatory };
      template.markModified('signatory');

      if (!template.layout) template.layout = {};
      const currentLayoutSig = (template.layout.signatory && typeof template.layout.signatory.toObject === 'function')
        ? template.layout.signatory.toObject()
        : (template.layout.signatory || {});
      template.layout.signatory = { ...currentLayoutSig, ...signatory };
      template.markModified('layout');
    }

    if (typeof useCustomBackground !== 'undefined') {
      template.useCustomBackground = Boolean(useCustomBackground);
    }

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
      if (template.backgroundAssetPath && fs.existsSync(template.backgroundAssetPath)) {
        try {
          await fs.promises.unlink(template.backgroundAssetPath);
        } catch (unlinkErr) {
          console.warn('Failed to delete old template background file:', unlinkErr.message);
        }
      }
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
      signatoryName,
      signatoryTitle,
      customLayout = null,
      useCustomBackground = null
    } = req.body;

    const dummyCertNumber = 'NOX-2026-PREVIEW-0000';
    const dummyToken = 'preview_draft_token_00000000000000';

    const activeTemplate = await Template.findOne({ isActive: true });
    const bgPath = (useCustomBackground ?? activeTemplate?.useCustomBackground) ? activeTemplate?.backgroundAssetPath : null;

    const resolvedSignatory = (activeTemplate && (activeTemplate.signatory || activeTemplate.layout?.signatory)) || {
      name: 'Aditya Jha',
      title: 'Managing Director & Lead Architect'
    };

    const pdfBuffer = await generateCertificatePdf({
      recipientName,
      programTitle,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      issueDate: new Date(),
      certificateNumber: dummyCertNumber,
      publicVerificationToken: dummyToken,
      signatoryName: signatoryName || resolvedSignatory.name,
      signatoryTitle: signatoryTitle || resolvedSignatory.title,
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
