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

module.exports = {
  intakeRateLimiter,
  verifyRateLimiter,
  loginRateLimiter
};
