const SkillCourse = require('../models/SkillCourse');
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
      .select('question options')
      .lean();
    const byId = new Map(questions.map(q => [String(q._id), q]));

    res.json({
      success: true,
      attempt: {
        id: String(attempt._id),
        courseCode: attempt.courseCode,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        durationMinutes: course.durationMinutes,
        passPercent: course.passPercent,
        answers: Object.fromEntries(attempt.answers || [])
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
    const answers = req.body?.answers;
    if (answers && typeof answers === 'object') {
      const validIds = new Set(attempt.questionIds.map(id => String(id)));
      for (const [qid, idx] of Object.entries(answers)) {
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

const LATE_GRACE_MS = 30 * 1000; // network/submit grace only

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
    const late = now > attempt.deadlineAt.getTime() + LATE_GRACE_MS;

    // Accept any final answers sent with the submit
    const answers = req.body?.answers;
    if (answers && typeof answers === 'object') {
      const validIds = new Set(attempt.questionIds.map(id => String(id)));
      for (const [qid, idx] of Object.entries(answers)) {
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
    if (late) {
      // Late submissions are recorded but cannot pass, whatever the score
      attempt.passed = false;
    }
    await attempt.save();

    res.json({ success: true, result: resultPayload(attempt, passPercent) });
  } catch (error) {
    next(error);
  }
};

function resultPayload(attempt, passPercent) {
  return {
    attemptId: String(attempt._id),
    courseCode: attempt.courseCode,
    score: attempt.score,
    totalQuestions: attempt.questionIds.length,
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    lateSubmit: attempt.lateSubmit,
    passPercent: passPercent ?? undefined,
    submittedAt: attempt.submittedAt
  };
}

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
