const express = require('express');
const router = express.Router();
const studentAuthController = require('../controllers/studentAuthController');
const { requireStudentAuth } = require('../middleware/studentAuth');
const { loginRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', loginRateLimiter, studentAuthController.register);
router.post('/login', loginRateLimiter, studentAuthController.login);
router.post('/logout', studentAuthController.logout);
router.get('/me', requireStudentAuth, studentAuthController.getMe);

module.exports = router;
