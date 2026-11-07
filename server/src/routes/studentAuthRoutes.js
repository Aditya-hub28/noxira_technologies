const express = require('express');
const router = express.Router();
const studentAuthController = require('../controllers/studentAuthController');
const studentDataController = require('../controllers/studentDataController');
const { requireStudentAuth } = require('../middleware/studentAuth');
const { loginRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', loginRateLimiter, studentAuthController.register);
router.post('/login', loginRateLimiter, studentAuthController.login);
router.post('/logout', studentAuthController.logout);
router.get('/me', requireStudentAuth, studentAuthController.getMe);
router.get('/applications', requireStudentAuth, studentDataController.getMyApplications);
router.get('/offers', requireStudentAuth, studentDataController.getMyOfferLetters);

module.exports = router;
