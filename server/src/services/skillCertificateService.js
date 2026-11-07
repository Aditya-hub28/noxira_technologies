const crypto = require('crypto');
const SkillCertificate = require('../models/SkillCertificate');

const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CHARSET[bytes[i] % CHARSET.length];
  return out;
}

/**
 * Issue a skill certificate for a passing quiz attempt. Idempotent:
 * keyed on attemptId (one cert per attempt) and studentId+courseCode
 * (first pass wins; a later higher score does not reissue).
 * Returns the certificate, or null when the attempt did not pass.
 */
async function issueForAttempt(attempt, student, course) {
  if (!attempt.passed) return null;

  const existing = await SkillCertificate.findOne({ attemptId: attempt._id });
  if (existing) return existing;

  const prior = await SkillCertificate.findOne({ studentId: student._id, courseCode: attempt.courseCode });
  if (prior) return prior;

  for (let tries = 0; tries < 5; tries++) {
    try {
      return await SkillCertificate.create({
        certificateNumber: `NOX-SK-${randomCode(8)}`,
        verificationToken: crypto.randomBytes(24).toString('hex'),
        studentId: student._id,
        attemptId: attempt._id,
        courseCode: attempt.courseCode,
        studentName: student.name,
        courseTitle: course?.title || attempt.courseCode,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        scorePercent: attempt.scorePercent,
        issuedAt: new Date()
      });
    } catch (err) {
      if (err && err.code === 11000 && tries < 4) continue; // rare number/token collision
      if (err && err.code === 11000) {
        return await SkillCertificate.findOne({ attemptId: attempt._id });
      }
      throw err;
    }
  }
  return null;
}

module.exports = { issueForAttempt };
