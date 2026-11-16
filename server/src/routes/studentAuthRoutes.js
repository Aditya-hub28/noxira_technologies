const express = require('express');
const router = express.Router();
const studentAuthController = require('../controllers/studentAuthController');
const { requireStudent } = require('../middleware/studentAuth');
const {
  studentAuthLimiter,
  studentForgotLimiter,
  studentOtpLimiter
} = require('../middleware/rateLimiter');

router.post('/signup', studentAuthLimiter, studentAuthController.signup);
router.post('/login', studentAuthLimiter, studentAuthController.login);
router.post('/logout', studentAuthController.logout);
router.get('/me', requireStudent, studentAuthController.me);
router.post('/forgot-password', studentForgotLimiter, studentAuthController.forgotPassword);
router.post('/verify-otp', studentOtpLimiter, studentAuthController.verifyOtp);
router.post('/reset-password', studentOtpLimiter, studentAuthController.resetPassword);

module.exports = router;
