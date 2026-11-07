const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Student = require('../models/Student');
const Application = require('../models/Application');
const Participant = require('../models/Participant');
const { requestEmailVerification, confirmEmailVerification } = require('../services/studentVerificationService');

function generateStudentToken(student) {
  return jwt.sign(
    { id: student._id, email: student.email, kind: 'student' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function setStudentCookie(res, token) {
  res.cookie('student_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function publicStudent(student) {
  return {
    id: String(student._id),
    name: student.name,
    email: student.email,
    emailVerified: Boolean(student.emailVerifiedAt),
    createdAt: student.createdAt
  };
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are all required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await Student.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account already exists with this email. Try logging in instead.' });
    }

    const passwordHash = await Student.hashPassword(password);
    const student = await Student.create({ name: name.trim(), email: normalizedEmail, passwordHash });

    const token = generateStudentToken(student);
    setStudentCookie(res, token);

    res.status(201).json({ success: true, token, student: publicStudent(student) });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student || !student.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    student.lastLoginAt = new Date();
    await student.save();

    const token = generateStudentToken(student);
    setStudentCookie(res, token);

    res.json({ success: true, token, student: publicStudent(student) });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res) => {
  res.clearCookie('student_token');
  res.json({ success: true, message: 'Logged out successfully.' });
};

exports.getMe = async (req, res) => {
  res.json({ success: true, student: publicStudent(req.student) });
};

exports.requestVerification = async (req, res, next) => {
  try {
    if (req.student.emailVerifiedAt) {
      return res.json({ success: true, alreadyVerified: true, message: 'This email is already verified.' });
    }
    const { expiresAt } = await requestEmailVerification(req.student);
    res.json({ success: true, message: 'Verification code sent to your email.', expiresAt });
  } catch (error) {
    next(error);
  }
};

exports.confirmVerification = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit code from the email.' });
    }
    const result = await confirmEmailVerification(req.student, code.trim());
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.json({ success: true, student: publicStudent(req.student) });
  } catch (error) {
    next(error);
  }
};

/**
 * Claim an existing application into this account using its application ID.
 * The application ID acts as the proof-of-possession factor: it is only
 * shared with the applicant at apply time. Email must also match.
 * Every failure returns the same generic 404 (no enumeration).
 */
exports.claimApplication = async (req, res, next) => {
  try {
    const { applicationId } = req.body;
    if (typeof applicationId !== 'string' || !applicationId.trim() || applicationId.trim().length > 32) {
      return res.status(400).json({ success: false, message: 'A valid application ID is required.' });
    }

    const generic404 = () => res.status(404).json({
      success: false,
      message: 'No application found for the details provided.'
    });

    const application = await Application.findOne({ applicationId: applicationId.trim().toUpperCase() }).populate('participantId');
    if (!application || !application.participantId) return generic404();

    const participantEmail = (application.participantId.normalizedEmail || application.participantId.email || '').toLowerCase().trim();
    if (participantEmail !== req.student.email.toLowerCase().trim()) return generic404();

    if (application.claimedByStudentId && String(application.claimedByStudentId) !== String(req.student._id)) {
      return generic404();
    }

    if (!application.claimedByStudentId) {
      application.claimedByStudentId = req.student._id;
      await application.save();
    }

    res.json({
      success: true,
      application: {
        applicationId: application.applicationId,
        programTitle: application.programTitle,
        status: application.status
      }
    });
  } catch (error) {
    next(error);
  }
};
