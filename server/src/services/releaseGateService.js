/**
 * Module 9: certificate release gate.
 *
 * Plan policy (approved): a certificate is released ONLY when payment is
 * verified AND review has passed, and the admin explicitly releases it.
 * The existing certificate system (PDF, QR, email, verify page) is reused
 * as-is - this service only decides eligibility.
 *
 * Binding rule (audit requirement): the SAME actual submission must satisfy
 * both conditions - a payment VERIFIED on one submission can never be combined
 * with a review PASSED on another. The submission must be identity-MATCHED
 * and bound to this participant by email + programme.
 */
const Submission = require('../models/Submission');

async function checkReleaseEligibility(participant) {
  const email = (participant.normalizedEmail || participant.email || '').toLowerCase().trim();
  const programCode = participant.programCode;
  if (!email || !programCode) {
    return { eligible: false, reasons: ['Participant is missing email or programme binding'] };
  }

  const bound = await Submission.find({ email, programCode })
    .select('submissionId matchState paymentState reviewStatus')
    .lean();

  const passing = bound.find((s) => s.matchState === 'MATCHED' && s.paymentState === 'VERIFIED' && s.reviewStatus === 'PASSED');
  if (passing) {
    return { eligible: true, submissionId: passing.submissionId, reasons: [] };
  }

  const reasons = [];
  if (bound.length === 0) {
    reasons.push('No final submission (Form 2) found for this email + programme');
  } else {
    if (!bound.some((s) => s.matchState === 'MATCHED')) reasons.push('Submission identity crosscheck is not MATCHED');
    if (!bound.some((s) => s.paymentState === 'VERIFIED')) reasons.push('Payment is not verified (manual bank/UPI check pending)');
    if (!bound.some((s) => s.reviewStatus === 'PASSED')) reasons.push('Project review has not PASSED');
    if (bound.some((s) => s.paymentState === 'VERIFIED') && bound.some((s) => s.reviewStatus === 'PASSED')) {
      reasons.push('No SINGLE submission has both payment VERIFIED and review PASSED - verified payment and passed review are on different submissions');
    }
    if (bound.some((s) => s.reviewStatus === 'FAILED_EXHAUSTED')) reasons.push('Review attempts exhausted on a submission - no certificate eligibility for it');
  }
  return { eligible: false, reasons };
}

module.exports = { checkReleaseEligibility };
