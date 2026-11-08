const SkillCourse = require('../models/SkillCourse');
const skillCertificateService = require('../services/skillCertificateService');
const QuizQuestion = require('../models/QuizQuestion');
const QuizAttempt = require('../models/QuizAttempt');

// Public catalogue: metadata only, never question content or answers
exports.listCourses = async (req, res, next) => {
  try {
    const courses = await SkillCourse.find({ isActive: true })
      .sort({ order: 1, title: 1 })
      .select('code title category level description durationMinutes passPercent questionCount')
      .lean();
    res.json({ success: true, courses });
  } catch (error) {
    next(error);
  }
};

exports.getCourse = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    const course = await SkillCourse.findOne({ code, isActive: true })
      .select('code title category level description durationMinutes passPercent questionCount')
      .lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Skill course not found.' });
    }
    res.json({ success: true, course });
  } catch (error) {
    next(error);
  }
};

/**
 * Start (or resume) an attempt. Questions are returned WITHOUT correctIndex.
 * One open attempt per student per course; resuming returns the same
 * questions in the same order with the original deadline.
 */
exports.startAttempt = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    const course = await SkillCourse.findOne({ code, isActive: true });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Skill course not found.' });
    }

    let attempt = await QuizAttempt.findOne({
      studentId: req.student._id,
      courseCode: code,
      submittedAt: null
    });

    if (!attempt) {
      const questions = await QuizQuestion.find({ courseCode: code }).sort({ order: 1 }).select('_id');
      if (questions.length < course.questionCount) {
        return res.status(503).json({ success: false, message: 'This course is being prepared. Please try another one.' });
      }
      // Random sample keeps banks larger than the served paper
      const shuffled = questions.map(q => q._id).sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, course.questionCount);

      attempt = await QuizAttempt.create({
        studentId: req.student._id,
        courseCode: code,
        questionIds: selected,
        startedAt: new Date(),
        deadlineAt: new Date(Date.now() + course.durationMinutes * 60 * 1000),
        totalQuestions: selected.length
      });
    }

    const questions = await QuizQuestion.find({ _id: { $in: attempt.questionIds } })
      .select('question options correctIndex')
      .lean();
    const byId = new Map(questions.map(q => [String(q._id), q]));

    // Outcomes only for questions already revealed in this attempt - the
    // paper stays answer-blind for everything not yet answered.
    const revealed = {};
    for (const qid of (attempt.revealed ? attempt.revealed.keys() : [])) {
      const q = byId.get(String(qid));
      const chosen = attempt.answers.get(String(qid));
      if (q && chosen != null) {
        revealed[String(qid)] = { chosen, correctIndex: q.correctIndex, correct: chosen === q.correctIndex };
      }
    }

    res.json({
      success: true,
      attempt: {
        id: String(attempt._id),
        courseCode: attempt.courseCode,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        durationMinutes: course.durationMinutes,
        passPercent: course.passPercent,
        answers: Object.fromEntries(attempt.answers || []),
        revealed
      },
      questions: attempt.questionIds.map(id => ({
        id: String(id),
        question: byId.get(String(id))?.question,
        options: byId.get(String(id))?.options
      }))
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Reveal one answer: records the student's first choice, locks it, and
 * returns right/wrong for instant feedback. Idempotent - revealing the same
 * question again returns the stored outcome and never changes the answer.
 */
exports.revealAnswer = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      studentId: req.student._id,
      submittedAt: null
    });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found or already submitted.' });
    }
    if (Date.now() > attempt.deadlineAt.getTime()) {
      // Same freeze rule as autosave: nothing changes after the deadline.
      return res.status(409).json({ success: false, message: 'Time is up - answers are frozen.' });
    }
    const qid = String(req.body?.questionId || '');
    const chosenIndex = req.body?.chosenIndex;
    const validIds = new Set(attempt.questionIds.map(id => String(id)));
    if (!validIds.has(qid) || !Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > 3) {
      return res.status(400).json({ success: false, message: 'Invalid question or option.' });
    }
    const question = await QuizQuestion.findById(qid).select('correctIndex').lean();
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    if (attempt.revealed && attempt.revealed.has(qid)) {
      const stored = attempt.answers.get(qid);
      return res.json({ success: true, alreadyRevealed: true, chosenIndex: stored, correctIndex: question.correctIndex, correct: stored === question.correctIndex });
    }

    attempt.answers.set(qid, chosenIndex);
    if (!attempt.revealed) attempt.revealed = new Map();
    attempt.revealed.set(qid, true);
    await attempt.save();

    res.json({ success: true, chosenIndex, correctIndex: question.correctIndex, correct: chosenIndex === question.correctIndex });
  } catch (error) {
    next(error);
  }
};

// Save progress without submitting (autosave)
exports.saveAnswers = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      studentId: req.student._id,
      submittedAt: null
    });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found or already submitted.' });
    }
    if (Date.now() > attempt.deadlineAt.getTime()) {
      // Answers freeze at the deadline; nothing received after it counts.
      return res.json({ success: true, frozen: true, savedAt: new Date() });
    }
    const answers = req.body?.answers;
    if (answers && typeof answers === 'object') {
      const validIds = new Set(attempt.questionIds.map(id => String(id)));
      for (const [qid, idx] of Object.entries(answers)) {
        if (attempt.revealed && attempt.revealed.has(qid)) continue; // locked after feedback
        if (validIds.has(qid) && Number.isInteger(idx) && idx >= 0 && idx <= 3) {
          attempt.answers.set(qid, idx);
        }
      }
      await attempt.save();
    }
    res.json({ success: true, savedAt: new Date() });
  } catch (error) {
    next(error);
  }
};

exports.submitAttempt = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      studentId: req.student._id
    });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found.' });
    }
    if (attempt.submittedAt) {
      return res.json({ success: true, alreadySubmitted: true, result: resultPayload(attempt) });
    }

    const now = Date.now();
    const late = now > attempt.deadlineAt.getTime();

    // Final answers sent with the submit only count when they arrive before
    // the deadline. After it, only answers autosaved in time are scored.
    const answers = req.body?.answers;
    if (!late && answers && typeof answers === 'object') {
      const validIds = new Set(attempt.questionIds.map(id => String(id)));
      for (const [qid, idx] of Object.entries(answers)) {
        if (attempt.revealed && attempt.revealed.has(qid)) continue; // locked after feedback
        if (validIds.has(qid) && Number.isInteger(idx) && idx >= 0 && idx <= 3) {
          attempt.answers.set(qid, idx);
        }
      }
    }

    const questions = await QuizQuestion.find({ _id: { $in: attempt.questionIds } })
      .select('correctIndex')
      .lean();

    let score = 0;
    for (const q of questions) {
      const given = attempt.answers.get(String(q._id));
      if (given !== undefined && given === q.correctIndex) score += 1;
    }

    const course = await SkillCourse.findOne({ code: attempt.courseCode });
    const passPercent = course?.passPercent ?? 60;
    const scorePercent = Math.round((score / attempt.questionIds.length) * 100);

    attempt.score = score;
    attempt.scorePercent = scorePercent;
    attempt.passed = scorePercent >= passPercent;
    attempt.submittedAt = new Date(now);
    attempt.lateSubmit = late;
    await attempt.save();

    // Launch gate: automatic certificate issuance on a pass is TEST BEHAVIOUR.
    // In production it stays off until the owner sets SKILL_CERT_AUTO_ISSUE=true
    // (pricing/release policy is an undecided owner item).
    const autoIssue = process.env.NODE_ENV !== 'production' || process.env.SKILL_CERT_AUTO_ISSUE === 'true';
    let certificate = null;
    if (attempt.passed && autoIssue) {
      certificate = await skillCertificateService.issueForAttempt(attempt, req.student, course);
    }

    res.json({ success: true, result: resultPayload(attempt, passPercent, certificate, attempt.passed && !autoIssue) });
  } catch (error) {
    next(error);
  }
};

function resultPayload(attempt, passPercent, certificate, certificatePending) {
  return {
    attemptId: String(attempt._id),
    courseCode: attempt.courseCode,
    score: attempt.score,
    totalQuestions: attempt.questionIds.length,
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    lateSubmit: attempt.lateSubmit,
    passPercent: passPercent ?? undefined,
    submittedAt: attempt.submittedAt,
    certificatePending: certificatePending || undefined,
    certificate: certificate ? {
      certificateNumber: certificate.certificateNumber,
      verificationToken: certificate.verificationToken,
      issuedAt: certificate.issuedAt
    } : undefined
  };
}

// TEST HOOK: answer key for end-to-end tests. Hard-disabled in production and
// unless ALLOW_TEST_HOOKS=true is set explicitly; never committed enabled.
exports.answerKey = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_TEST_HOOKS !== 'true') {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }
    const QuizQuestion = require('../models/QuizQuestion');
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      studentId: req.student._id,
      submittedAt: null
    });
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found.' });
    }
    const questions = await QuizQuestion.find({ _id: { $in: attempt.questionIds } }).select('correctIndex').lean();
    const key = {};
    for (const q of questions) key[String(q._id)] = q.correctIndex;
    res.json({ success: true, key });
  } catch (error) {
    next(error);
  }
};

// Skill certificates earned by the signed-in student
exports.getMyCertificates = async (req, res, next) => {
  try {
    const SkillCertificate = require('../models/SkillCertificate');
    const certs = await SkillCertificate.find({ studentId: req.student._id })
      .sort({ issuedAt: -1 })
      .select('certificateNumber verificationToken courseCode courseTitle score totalQuestions scorePercent issuedAt')
      .lean();
    res.json({ success: true, certificates: certs.map(c => ({ ...c, id: String(c._id) })) });
  } catch (error) {
    next(error);
  }
};

// Download the certificate PDF (owner only)
exports.downloadSkillCertificate = async (req, res, next) => {
  try {
    const SkillCertificate = require('../models/SkillCertificate');
    const { renderSkillCertificatePdf } = require('../services/skillCertificatePdfService');
    const cert = await SkillCertificate.findOne({ _id: req.params.id, studentId: req.student._id });
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }
    const pdf = await renderSkillCertificatePdf(cert);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.certificateNumber}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};

// Public verification of a skill certificate by token (no private data beyond the certificate itself)
exports.verifySkillCertificate = async (req, res, next) => {
  try {
    const SkillCertificate = require('../models/SkillCertificate');
    const cert = await SkillCertificate.findOne({ verificationToken: req.params.token })
      .select('certificateNumber studentName courseTitle scorePercent issuedAt')
      .lean();
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }
    res.json({ success: true, certificate: { ...cert, kind: 'SKILL_TEST' } });
  } catch (error) {
    next(error);
  }
};

// Attempt history for the dashboard
exports.getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ studentId: req.student._id, submittedAt: { $ne: null } })
      .sort({ submittedAt: -1 })
      .select('courseCode score totalQuestions scorePercent passed lateSubmit submittedAt')
      .lean();
    const courses = await SkillCourse.find({ code: { $in: attempts.map(a => a.courseCode) } })
      .select('code title')
      .lean();
    const titleByCode = new Map(courses.map(c => [c.code, c.title]));

    res.json({
      success: true,
      attempts: attempts.map(a => ({
        ...a,
        id: String(a._id),
        courseTitle: titleByCode.get(a.courseCode) || a.courseCode
      }))
    });
  } catch (error) {
    next(error);
  }
};
