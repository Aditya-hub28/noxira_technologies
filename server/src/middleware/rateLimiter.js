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

// Skill-quiz rate limiter: max 120 requests per 15 minutes per STUDENT.
// A legitimate 50-question attempt needs ~52 calls (start/resume + 50 reveals
// + submit), so 120 leaves room for a second course, page reloads and retries
// while still capping scripted abuse. Keyed by the authenticated student id
// (this limiter runs after requireStudentAuth), so one heavy user cannot
// lock out classmates sharing the same IP (school labs, NAT).
const quizRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.student && req.student._id ? String(req.student._id) : req.ip),
  message: {
    success: false,
    message: 'Too many test requests in a short time. Your progress is saved - please wait a few minutes and continue.'
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

module.exports = {
  intakeRateLimiter,
  verifyRateLimiter,
  loginRateLimiter,
  statusRateLimiter,
  quizRateLimiter,
  offerDownloadRateLimiter
};
