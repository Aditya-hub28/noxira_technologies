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
 * Validates the fields array for offer template layout updates.
 */
function validateTemplateFields(fields, pageCount, pageDimensions = []) {
  if (!Array.isArray(fields)) {
    return 'fields must be an array of field mappings.';
  }
  const allowedAlignments = ['left', 'center', 'right'];

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f || typeof f !== 'object') {
      return `Field at index ${i} is invalid.`;
    }
    const fieldId = f.id ? String(f.id).trim() : '';
    if (!fieldId) {
      return `Field at index ${i} is missing required property "id".`;
    }
    const label = f.label ? String(f.label).trim() : '';
    if (!label) {
      return `Field "${fieldId}" is missing required property "label".`;
    }
    const page = Number(f.page);
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      return `Field "${label}" (${fieldId}) has invalid page ${f.page}. Must be an integer between 1 and ${pageCount}.`;
    }

    // Page dimensions for this page
    const pDim = (pageDimensions && pageDimensions[page - 1]) || { width: 595.28, height: 841.89 };
    const maxWidthLimit = pDim.width || 595.28;
    const maxHeightLimit = pDim.height || 841.89;

    if (typeof f.x !== 'number' || !Number.isFinite(f.x) || f.x < 0 || f.x > maxWidthLimit) {
      return `Field "${label}" (${fieldId}) has invalid X coordinate ${f.x}. Must be a finite number between 0 and ${maxWidthLimit} pt.`;
    }
    if (typeof f.y !== 'number' || !Number.isFinite(f.y) || f.y < 0 || f.y > maxHeightLimit) {
      return `Field "${label}" (${fieldId}) has invalid Y coordinate ${f.y}. Must be a finite number between 0 and ${maxHeightLimit} pt.`;
    }
    if (f.fontSize !== undefined && f.fontSize !== null) {
      if (typeof f.fontSize !== 'number' || !Number.isFinite(f.fontSize) || f.fontSize < 4 || f.fontSize > 72) {
        return `Field "${label}" (${fieldId}) has invalid fontSize ${f.fontSize}. Must be between 4 and 72 pt.`;
      }
    }
    if (f.maxWidth !== undefined && f.maxWidth !== null) {
      if (typeof f.maxWidth !== 'number' || !Number.isFinite(f.maxWidth) || f.maxWidth < 10 || f.maxWidth > maxWidthLimit) {
        return `Field "${label}" (${fieldId}) has invalid maxWidth ${f.maxWidth}. Must be between 10 and ${maxWidthLimit} pt.`;
      }
    }
    if (f.alignment && !allowedAlignments.includes(f.alignment)) {
      return `Field "${label}" (${fieldId}) has invalid alignment "${f.alignment}". Must be one of: ${allowedAlignments.join(', ')}.`;
    }
  }
  return null;
}

/**
 * Update field coordinate mappings on a template.
 * Enforces immutable versions: active templates cannot be modified in place;
 * editing an active template automatically branches a new draft version.
 */
exports.updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, fields, saveAsNewVersion } = req.body;

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

    if (fields !== undefined) {
      const fieldValidationError = validateTemplateFields(fields, template.pageCount || 1, template.pageDimensions || []);
      if (fieldValidationError) {
        return res.status(400).json({
          success: false,
          message: fieldValidationError
        });
      }
    }

    // Immutable versions: If active or explicitly requested, create new draft version
    if (template.isActive || saveAsNewVersion) {
      const highestVer = await OfferLetterTemplate.findOne().sort({ version: -1 }).select('version').lean();
      const nextVersion = highestVer ? highestVer.version + 1 : template.version + 1;

      const newDraft = new OfferLetterTemplate({
        name: (name || template.name).trim(),
        version: nextVersion,
        isSample: false,
        isActive: false, // New version starts as draft
        pdfStoragePath: template.pdfStoragePath,
        pdfSizeBytes: template.pdfSizeBytes,
        pageCount: template.pageCount,
        pageDimensions: template.pageDimensions,
        fields: Array.isArray(fields) ? fields : template.fields,
        createdBy: req.admin._id
      });

      await newDraft.save();

      await AuditLog.create({
        actorId: req.admin._id,
        actorType: 'ADMIN',
        action: 'TEMPLATE_VERSION_CREATED',
        targetEntity: 'OFFER_TEMPLATE',
        targetId: newDraft._id,
        summary: `Created new draft template v${nextVersion} branched from v${template.version}`
      });

      return res.status(201).json({
        success: true,
        message: `Active template v${template.version} is immutable. Created new draft version v${nextVersion}.`,
        template: newDraft,
        isNewVersion: true
      });
    }

    // Non-active draft template can be updated in place
    if (name) {
      template.name = name.trim();
    }

    if (Array.isArray(fields)) {
      template.fields = fields;
    }

    await template.save();

    res.json({
      success: true,
      message: 'Template draft updated successfully.',
      template,
      isNewVersion: false
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

/**
 * Stream/send stored template PDF bytes inline.
 * Requires admin authentication (handled by router middleware).
 */
exports.getTemplatePdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await OfferLetterTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    let pdfBuffer = null;
    if (template.pdfStoragePath && fs.existsSync(template.pdfStoragePath)) {
      pdfBuffer = fs.readFileSync(template.pdfStoragePath);
    } else if (template.isSample) {
      pdfBuffer = await offerPdfService.generateSampleOfferTemplatePdf();
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(404).json({ success: false, message: 'Template PDF file not found on disk.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="template.pdf"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
