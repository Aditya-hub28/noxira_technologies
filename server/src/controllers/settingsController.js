const Setting = require('../models/Setting');

/**
 * Validates a Google Form URL strictly according to requirements:
 * - Must be valid URL parseable by `new URL()`
 * - Protocol must be https:
 * - No userinfo (@)
 * - Hostname must be exactly 'docs.google.com' (path starts with /forms/) or 'forms.gle'
 * - Rejects http, userinfo, evil-prefix/suffix hostnames, etc.
 */
function validateGoogleFormUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return { valid: false, message: 'URL must be a string.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed === '') {
    return { valid: true, url: '' };
  }

  if (trimmed.includes('@')) {
    return { valid: false, message: "Invalid Google Form URL: Userinfo ('@') is not allowed." };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return { valid: false, message: 'Invalid Google Form URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, message: 'Invalid Google Form URL: Must use secure HTTPS protocol.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, message: 'Invalid Google Form URL: Userinfo is not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'docs.google.com' && hostname !== 'forms.gle') {
    return { valid: false, message: 'Invalid Google Form URL: Hostname must be docs.google.com or forms.gle.' };
  }

  if (hostname === 'docs.google.com') {
    if (!parsed.pathname.startsWith('/forms/')) {
      return { valid: false, message: 'Invalid Google Form URL: docs.google.com path must start with /forms/.' };
    }
  }

  return { valid: true, url: trimmed };
}

/**
 * Normalizes a WhatsApp number to digits only, with country code (e.g. 919876543210).
 * Accepts input like "+91 98765 43210". Empty input clears the number.
 * Valid length is 8 to 15 digits (E.164 maximum).
 */
function normalizeWhatsappNumber(raw) {
  if (raw === undefined || raw === null) return { valid: true, number: '' };
  if (typeof raw !== 'string') {
    return { valid: false, message: 'WhatsApp number must be text.' };
  }
  const trimmed = raw.trim();
  if (trimmed === '') return { valid: true, number: '' };
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return { valid: false, message: 'WhatsApp number can only contain digits, spaces, dashes, brackets and a leading +.' };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return { valid: false, message: 'Enter the full number with country code, for example +91 98765 43210.' };
  }
  return { valid: true, number: digits };
}

/**
 * Public route: GET /api/v1/settings/public
 * Returns only { success, googleForm1Url, whatsappNumber } - no other settings exposed.
 */
async function getPublicSettings(req, res, next) {
  try {
    const setting = await Setting.findOne({ key: 'site' }).lean();
    res.json({
      success: true,
      googleForm1Url: setting?.googleForm1Url || '',
      whatsappNumber: setting?.whatsappNumber || ''
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin route: GET /api/v1/admin/settings/google-form-1
 */
async function getAdminGoogleForm1(req, res, next) {
  try {
    const setting = await Setting.findOne({ key: 'site' }).lean();
    res.json({
      success: true,
      googleForm1Url: setting?.googleForm1Url || ''
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin route: PUT /api/v1/admin/settings/google-form-1
 * Protected by requireAuth + requireRole(['SUPER_ADMIN'])
 * Accepts { url }
 */
async function updateGoogleForm1(req, res, next) {
  try {
    const { url } = req.body || {};

    if (url === undefined || url === null || (typeof url === 'string' && url.trim() === '')) {
      const setting = await Setting.findOneAndUpdate(
        { key: 'site' },
        { $set: { googleForm1Url: '' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.json({
        success: true,
        message: 'Google Form 1 link cleared successfully.',
        googleForm1Url: setting.googleForm1Url
      });
    }

    const validation = validateGoogleFormUrl(url);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: 'site' },
      { $set: { googleForm1Url: validation.url } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: 'Google Form 1 link updated successfully.',
      googleForm1Url: setting.googleForm1Url
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin route: GET /api/v1/admin/settings/whatsapp
 */
async function getAdminWhatsapp(req, res, next) {
  try {
    const setting = await Setting.findOne({ key: 'site' }).lean();
    res.json({ success: true, whatsappNumber: setting?.whatsappNumber || '' });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin route: PUT /api/v1/admin/settings/whatsapp
 * Protected by requireAuth + requireRole(['SUPER_ADMIN'])
 * Accepts { number }. Empty clears it.
 */
async function updateWhatsapp(req, res, next) {
  try {
    const { number } = req.body || {};
    const result = normalizeWhatsappNumber(number);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }
    const setting = await Setting.findOneAndUpdate(
      { key: 'site' },
      { $set: { whatsappNumber: result.number } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({
      success: true,
      message: result.number ? 'WhatsApp number updated successfully.' : 'WhatsApp number cleared successfully.',
      whatsappNumber: setting.whatsappNumber
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  normalizeWhatsappNumber,
  getAdminWhatsapp,
  updateWhatsapp,
  validateGoogleFormUrl,
  getPublicSettings,
  getAdminGoogleForm1,
  updateGoogleForm1
};
