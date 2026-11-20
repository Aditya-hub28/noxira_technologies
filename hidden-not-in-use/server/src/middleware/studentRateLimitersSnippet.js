// Extracted from server/src/middleware/rateLimiter.js
// Student auth rate limiters (deferred for current internship launch)
const rateLimit = require('express-rate-limit');

// Student auth (signup / login) rate limiter: max 15 requests per 15 minutes per IP
const studentAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// Student forgot-password rate limiter: max 5 requests per 15 minutes per IP
const studentForgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again after 15 minutes.'
  }
});

// Student verify-otp / reset-password rate limiter: max 10 requests per 15 minutes per IP
const studentOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP attempts. Please try again after 15 minutes.'
  }
});

module.exports = {
  studentAuthLimiter,
  studentForgotLimiter,
  studentOtpLimiter
};
