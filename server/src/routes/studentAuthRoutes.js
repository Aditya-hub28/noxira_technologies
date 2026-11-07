const express = require('express');
const router = express.Router();
const studentAuthController = require('../controllers/studentAuthController');
const studentDataController = require('../controllers/studentDataController');
const { requireStudentAuth } = require('../middleware/studentAuth');
const { loginRateLimiter, statusRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', loginRateLimiter, studentAuthController.register);
router.post('/login', loginRateLimiter, studentAuthController.login);
router.post('/logout', studentAuthController.logout);
router.get('/me', requireStudentAuth, studentAuthController.getMe);
router.get('/applications', requireStudentAuth, studentDataController.getMyApplications);
router.get('/offers', requireStudentAuth, studentDataController.getMyOfferLetters);
router.post('/verify/request', loginRateLimiter, requireStudentAuth, studentAuthController.requestVerification);
router.post('/verify/confirm', loginRateLimiter, requireStudentAuth, studentAuthController.confirmVerification);
router.post('/claim', statusRateLimiter, requireStudentAuth, studentAuthController.claimApplication);

module.exports = router;
