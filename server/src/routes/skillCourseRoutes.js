const express = require('express');
const router = express.Router();
const skillCourseController = require('../controllers/skillCourseController');
const { requireStudentAuth } = require('../middleware/studentAuth');
const { quizRateLimiter } = require('../middleware/rateLimiter');

router.get('/', skillCourseController.listCourses);
router.get('/attempts/mine', requireStudentAuth, skillCourseController.getMyAttempts);
router.get('/certificates/mine', requireStudentAuth, skillCourseController.getMyCertificates);
router.get('/certificates/:id/download', requireStudentAuth, skillCourseController.downloadSkillCertificate);
router.get('/attempts/:attemptId/answer-key', requireStudentAuth, skillCourseController.answerKey);
router.get('/certificates/verify/:token', skillCourseController.verifySkillCertificate);
router.get('/:code', skillCourseController.getCourse);
router.post('/:code/start', requireStudentAuth, quizRateLimiter, skillCourseController.startAttempt);
router.patch('/attempts/:attemptId', requireStudentAuth, skillCourseController.saveAnswers);
router.post('/attempts/:attemptId/reveal', requireStudentAuth, quizRateLimiter, skillCourseController.revealAnswer);
router.post('/attempts/:attemptId/submit', requireStudentAuth, quizRateLimiter, skillCourseController.submitAttempt);

module.exports = router;
