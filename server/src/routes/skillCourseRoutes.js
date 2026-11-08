const express = require('express');
const router = express.Router();
const skillCourseController = require('../controllers/skillCourseController');
const { requireStudentAuth } = require('../middleware/studentAuth');
const { statusRateLimiter, loginRateLimiter } = require('../middleware/rateLimiter');

router.get('/', skillCourseController.listCourses);
router.get('/attempts/mine', requireStudentAuth, skillCourseController.getMyAttempts);
router.get('/certificates/mine', requireStudentAuth, skillCourseController.getMyCertificates);
router.get('/certificates/:id/download', requireStudentAuth, skillCourseController.downloadSkillCertificate);
router.get('/attempts/:attemptId/answer-key', requireStudentAuth, skillCourseController.answerKey);
router.get('/certificates/verify/:token', skillCourseController.verifySkillCertificate);
router.get('/:code', skillCourseController.getCourse);
router.post('/:code/start', loginRateLimiter, requireStudentAuth, skillCourseController.startAttempt);
router.patch('/attempts/:attemptId', requireStudentAuth, skillCourseController.saveAnswers);
router.post('/attempts/:attemptId/reveal', statusRateLimiter, requireStudentAuth, skillCourseController.revealAnswer);
router.post('/attempts/:attemptId/submit', statusRateLimiter, requireStudentAuth, skillCourseController.submitAttempt);

module.exports = router;
