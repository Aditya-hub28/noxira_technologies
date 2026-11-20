const crypto = require('crypto');
const fields = require('./approvedOfferFields.json');

// The signed PDF is intentionally NOT stored in public source. The owner uploads
// the exact privately delivered asset through the authenticated template studio.
const APPROVED_OFFER_SHA256 = '461dacc94ceb2c1ab47b2adf6366aebbc844e41258894dff85c61d3af57ebaee';
const APPROVED_OFFER_NAME = 'NOXIRA approved signed offer (4 weeks)';

function isApprovedOfferTemplate(template) {
  return template?.pdfSha256 === APPROVED_OFFER_SHA256;
}

function identifyApprovedOffer(buffer) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    sha256,
    approved: sha256 === APPROVED_OFFER_SHA256,
    fields: sha256 === APPROVED_OFFER_SHA256 ? fields.map((f) => ({ ...f })) : null
  };
}

function validateApprovedOfferProgram(template, program) {
  if (!isApprovedOfferTemplate(template)) return;
  if (!program || program.durationWeeks !== 4) {
    throw new Error('This signed offer template states 4 Weeks. Set the programme duration to 4 weeks before generating an offer.');
  }
  // Do not silently use the schema's development default date for this letter.
  if (!program.startDate || !Number.isFinite(new Date(program.startDate).getTime())) {
    throw new Error('Set the programme Start Date in Admin > Programmes before generating this offer.');
  }
}

module.exports = { APPROVED_OFFER_SHA256, APPROVED_OFFER_NAME, identifyApprovedOffer, isApprovedOfferTemplate, validateApprovedOfferProgram };
