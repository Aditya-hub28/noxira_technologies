const crypto = require('crypto');
const Student = require('../models/Student');
const { getTransporter } = require('./emailService');
const env = require('../config/env');

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/**
 * Issues a 6-digit verification code for the student's account email.
 * Delivery goes through the shared email service: in non-production it is
 * SIMULATED (nothing leaves the machine); in production it requires a real
 * SMTP config, which the owner has not approved/enabled yet.
 */
async function requestEmailVerification(student) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  student.emailVerifyCodeHash = hashCode(code);
  student.emailVerifyExpiresAt = new Date(Date.now() + CODE_TTL_MS);
  student.emailVerifyAttempts = 0;
  await student.save();

  const transporter = getTransporter();
  await transporter.sendMail({
    from: env.SMTP.FROM || 'no-reply@noxira.local',
    to: student.email,
    subject: 'Your NOXIRA verification code',
    text: `Your NOXIRA account verification code is ${code}. It expires in 10 minutes. If you did not create this account, ignore this email.`
  });

  return { expiresAt: student.emailVerifyExpiresAt };
}

/**
 * Confirms a code. Constant-shape failures: no hint whether the code was
 * wrong, expired, or exhausted beyond the generic message.
 */
async function confirmEmailVerification(student, code) {
  if (!student.emailVerifyCodeHash || !student.emailVerifyExpiresAt) {
    return { ok: false, status: 400, message: 'No verification code is pending. Request a new one.' };
  }
  if (student.emailVerifyAttempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: 'Too many incorrect attempts. Request a new code.' };
  }
  if (student.emailVerifyExpiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, message: 'This code has expired. Request a new one.' };
  }

  student.emailVerifyAttempts += 1;
  if (hashCode(code) !== student.emailVerifyCodeHash) {
    await student.save();
    return { ok: false, status: 400, message: 'Incorrect code. Check the email and try again.' };
  }

  student.emailVerifiedAt = new Date();
  student.emailVerifyCodeHash = null;
  student.emailVerifyExpiresAt = null;
  student.emailVerifyAttempts = 0;
  await student.save();
  return { ok: true };
}

module.exports = { requestEmailVerification, confirmEmailVerification };
