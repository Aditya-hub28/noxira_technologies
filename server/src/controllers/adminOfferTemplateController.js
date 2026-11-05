const fs = require('fs');
const OfferLetterTemplate = require('../models/OfferLetterTemplate');
const AuditLog = require('../models/AuditLog');
const storageService = require('../services/storageService');
const offerPdfService = require('../services/offerPdfService');

/**
 * List all offer letter templates.
 */
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await OfferLetterTemplate.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'fullName email')
      .populate('activatedBy', 'fullName email')
      .lean();

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single offer letter template with full field definitions.
 */
exports.getTemplateDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await OfferLetterTemplate.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('activatedBy', 'fullName email')
      .lean();

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a custom PDF offer letter template.
 */
exports.uploadTemplate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded. Please upload a template PDF.'
      });
    }

    const { name } = req.body;
    const cleanName = (name || req.file.originalname || 'Custom Offer Template').trim();

    // Byte & structure validation: magic header, unencrypted, 1-5 pages
    const validation = await offerPdfService.validateUploadedOfferPdf(req.file.buffer);

    // Save to storage
    const filename = `template_v${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const savedStorage = await storageService.saveOfferTemplateFile(req.file.buffer, filename);
    const savedPath = savedStorage.diskPath || String(savedStorage);

    // Determine version number
    const highestVer = await OfferLetterTemplate.findOne().sort({ version: -1 }).select('version').lean();
    const nextVersion = highestVer ? highestVer.version + 1 : 1;

    // Use default sample fields as starter layout
    const initialFields = offerPdfService.DEFAULT_SAMPLE_FIELDS.map((f) => ({ ...f }));

    const template = new OfferLetterTemplate({
      name: cleanName,
      version: nextVersion,
      isSample: false,
      isActive: false, // Uploaded as inactive draft
      pdfStoragePath: savedPath,
      pdfSizeBytes: req.file.buffer.length,
      pageCount: validation.pageCount,
      pageDimensions: validation.pageDimensions,
      fields: initialFields,
      createdBy: req.admin._id
    });

    await template.save();

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'TEMPLATE_UPLOADED',
      targetEntity: 'OFFER_TEMPLATE',
      targetId: template._id,
      summary: `Uploaded custom template "${cleanName}" v${nextVersion} (${validation.pageCount} pages)`
    });

    res.status(201).json({
      success: true,
      message: `Template v${nextVersion} uploaded successfully as draft.`,
      template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update field coordinate mappings on a template draft.
 */
exports.updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, fields } = req.body;

    const template = await OfferLetterTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    if (template.isSample) {
      return res.status(400).json({
        success: false,
        message: 'The built-in sample template is read-only and cannot be modified.'
      });
    }

    if (name) {
      template.name = name.trim();
    }

    if (Array.isArray(fields)) {
      template.fields = fields;
    }

    await template.save();

    res.json({
      success: true,
      message: 'Template updated successfully.',
      template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview render the template using synthetic test data.
 */
exports.previewTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await OfferLetterTemplate.findById(id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Allow overriding fields temporarily for preview
    const customFields = req.body && Array.isArray(req.body.fields) ? req.body.fields : template.fields;
    const effectiveTemplate = {
      ...template.toObject(),
      fields: customFields
    };

    const previewData = {
      studentName: 'Alex Doe (Sample Candidate)',
      email: 'alex.doe@example.com',
      phone: '+91 98765 43210',
      programTitle: 'Full-Stack Web Development',
      code: 'FS-DEV',
      batchId: 'BATCH-2026-Q1',
      durationWeeks: 12,
      feeLocked: 499,
      applicationId: 'NOX-SAMPLE',
      issueDate: new Date()
    };

    const renderedPdf = await offerPdfService.renderOfferPdf(effectiveTemplate, previewData, {
      isSample: true, // Always apply watermark for preview
      isWatermarked: true
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview_${template.version}.pdf"`,
      'Content-Length': renderedPdf.length
    });

    res.send(renderedPdf);
  } catch (error) {
    next(error);
  }
};

/**
 * Explicitly activate a template for live issuance.
 * Sample template CANNOT be activated for live issuance.
 */
exports.activateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirmation } = req.body;

    if (!confirmation) {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation is required to activate a template.'
      });
    }

    const template = await OfferLetterTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    if (template.isSample) {
      return res.status(400).json({
        success: false,
        message: 'The built-in sample template cannot be activated for live candidate issuance.'
      });
    }

    // Validate that required fields exist in field mappings
    const requiredFieldIds = ['studentName', 'programTitle', 'applicationId', 'issueDate'];
    const configuredFieldIds = (template.fields || []).map((f) => f.id);

    for (const reqId of requiredFieldIds) {
      if (!configuredFieldIds.includes(reqId)) {
        return res.status(400).json({
          success: false,
          message: `Cannot activate template: missing required dynamic field mapping "${reqId}".`
        });
      }
    }

    // Atomically deactivate any other active template
    await OfferLetterTemplate.updateMany({ isActive: true }, { $set: { isActive: false } });

    template.isActive = true;
    template.activatedAt = new Date();
    template.activatedBy = req.admin._id;
    await template.save();

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'TEMPLATE_ACTIVATED',
      targetEntity: 'OFFER_TEMPLATE',
      targetId: template._id,
      summary: `Activated offer letter template "${template.name}" v${template.version}`
    });

    res.json({
      success: true,
      message: `Template "${template.name}" v${template.version} is now active for all new offer letters.`,
      template
    });
  } catch (error) {
    next(error);
  }
};
