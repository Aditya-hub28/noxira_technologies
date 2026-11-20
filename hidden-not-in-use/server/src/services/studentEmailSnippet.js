// Extracted from server/src/services/emailService.js
// Student OTP password reset mailer (deferred for current internship launch)

/**
 * Send password reset OTP email
 */
async function sendPasswordResetOtpEmail(email, otp) {
  const text = `Your NOXIRA password reset OTP is ${otp}. It is valid for 10 minutes. If you did not ask for this, ignore this email.`;

  // In dev/mock email mode, print the OTP to the server console only
  if (isDevEmailMode()) {
    console.log(`[DEV/MOCK OTP] Password reset OTP for ${email}: ${otp}`);
    return { success: true, messageId: 'mock-otp-id' };
  }

  return sendEmail({
    to: email,
    subject: 'NOXIRA Password Reset OTP',
    text
  });
}

module.exports = {
  sendPasswordResetOtpEmail
};
