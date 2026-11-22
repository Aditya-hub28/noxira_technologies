const rateLimit = require('express-rate-limit');

// Public registration rate limiter: max 10 requests per 15 minutes per IP
const intakeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration requests from this IP. Please try again after 15 minutes.'
  }
});

// Public verification rate limiter: max 60 requests per minute per IP
const verifyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification requests. Please slow down.'
  }
});

// Admin login rate limiter: max 10 attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
  }
});

// Public status check rate limiter: max 10 requests per 15 minutes per IP
const statusRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many status check requests from this IP. Please try again after 15 minutes.'
  }
});

// Offer download rate limiter: max 60 requests per 15 minutes per IP
const offerDownloadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many offer download requests from this IP. Please try again after 15 minutes.'
  }
});

// Public offer-letter lookup rate limiter: max 60 requests per 15 minutes per IP.
// Separate from the status limiter so checking an application status cannot
// exhaust a candidate's offer-letter budget (and vice versa).
const offerLetterLookupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many offer letter requests from this IP. Please try again after 15 minutes.'
  }
});

// Public offer-letter PDF rate limiter: max 60 requests per 15 minutes per IP.
// The PDF endpoint disables range support, so every fetch - with or without a
// Range header - is one full, counted request. There is no header-based bypass,
// and no range-request exhaustion either: one preview costs exactly one request.
const offerLetterPdfRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many offer letter requests from this IP. Please try again after 15 minutes.'
  }
});

module.exports = {
  intakeRateLimiter,
  verifyRateLimiter,
  loginRateLimiter,
  statusRateLimiter,
  offerDownloadRateLimiter,
  offerLetterLookupRateLimiter,
  offerLetterPdfRateLimiter
};
