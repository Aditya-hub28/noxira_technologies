const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const emailService = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 72) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasLetter && hasDigit;
}

function computeOtpHash(studentId, otp) {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${studentId}:${String(otp).trim()}`)
    .digest('hex');
}

/**
 * POST /signup
 */
async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 80 characters.'
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one letter and one number.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingStudent = await Student.findOne({ email: normalizedEmail });
    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await Student.hashPassword(password);
    const student = await Student.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      isActive: true
    });

    const token = jwt.sign(
      { id: student._id, typ: 'student' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('student_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    try {
      await AuditLog.create({
        actorId: student._id,
        actorType: 'STUDENT',
        action: 'STUDENT_SIGNUP',
        targetEntity: 'PARTICIPANT',
        targetId: student._id,
        summary: 'Student registered account',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (auditErr) {
      console.warn('Failed to record student signup audit log:', auditErr.message);
    }

    return res.status(201).json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        email: student.email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during signup.'
    });
  }
}

/**
 * POST /login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student || !student.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    student.lastLoginAt = new Date();
    await student.save();

    const token = jwt.sign(
      { id: student._id, typ: 'student' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('student_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    try {
      await AuditLog.create({
        actorId: student._id,
        actorType: 'STUDENT',
        action: 'STUDENT_LOGIN',
        targetEntity: 'PARTICIPANT',
        targetId: student._id,
        summary: 'Student logged in',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (auditErr) {
      console.warn('Failed to record student login audit log:', auditErr.message);
    }

    return res.json({
      success: true,
      student: {
        id: student._id,
        name: student.name,
        email: student.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login.'
    });
  }
}

/**
 * POST /logout
 */
async function logout(req, res) {
  res.clearCookie('student_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}

/**
 * GET /me
 */
async function me(req, res) {
  return res.json({
    success: true,
    student: {
      id: req.student._id,
      name: req.student.name,
      email: req.student.email
    }
  });
}

/**
 * POST /forgot-password
 */
async function forgotPassword(req, res) {
  const neutralMessage = 'If an account exists for this email, an OTP has been sent.';
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.json({
        success: true,
        message: neutralMessage
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student || !student.isActive) {
      return res.json({
        success: true,
        message: neutralMessage
      });
    }

    // Resend cooldown: 60 seconds
    if (student.resetOtpSentAt && (Date.now() - student.resetOtpSentAt.getTime() < 60000)) {
      return res.json({
        success: true,
        message: neutralMessage
      });
    }

    // Generate 6-digit OTP using crypto.randomInt
    const otpNum = crypto.randomInt(100000, 1000000);
    const otpStr = String(otpNum);

    const otpHash = computeOtpHash(student._id, otpStr);

    student.resetOtpHash = otpHash;
    student.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    student.resetOtpAttempts = 0;
    student.resetOtpSentAt = new Date();
    await student.save();

    try {
      await AuditLog.create({
        actorId: student._id,
        actorType: 'STUDENT',
        action: 'STUDENT_OTP_REQUESTED',
        targetEntity: 'PARTICIPANT',
        targetId: student._id,
        summary: 'Student requested password reset OTP',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (auditErr) {
      console.warn('Failed to record student OTP request audit log:', auditErr.message);
    }

    await emailService.sendPasswordResetOtpEmail(student.email, otpStr);

    return res.json({
      success: true,
      message: neutralMessage
    });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    return res.json({
      success: true,
      message: neutralMessage
    });
  }
}

/**
 * POST /verify-otp
 */
async function verifyOtp(req, res) {
  const genericError = 'Invalid or expired OTP.';
  const attemptsError = 'Too many wrong attempts. Please request a new OTP.';

  try {
    const { email, otp } = req.body;

    if (!email || !otp || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: genericError
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student || !student.resetOtpHash) {
      return res.status(400).json({
        success: false,
        message: genericError
      });
    }

    if (student.resetOtpAttempts >= 5) {
      student.resetOtpHash = undefined;
      student.resetOtpExpiresAt = undefined;
      await student.save();
      return res.status(400).json({
        success: false,
        message: attemptsError
      });
    }

    if (!student.resetOtpExpiresAt || student.resetOtpExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: genericError
      });
    }

    const candidateHash = computeOtpHash(student._id, otp);
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(student.resetOtpHash, 'hex');

    const isMatch = candidateBuf.length === storedBuf.length && crypto.timingSafeEqual(candidateBuf, storedBuf);

    if (!isMatch) {
      student.resetOtpAttempts += 1;
      const exceeded = student.resetOtpAttempts >= 5;
      if (exceeded) {
        student.resetOtpHash = undefined;
        student.resetOtpExpiresAt = undefined;
      }
      await student.save();
      return res.status(400).json({
        success: false,
        message: exceeded ? attemptsError : genericError
      });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully.'
    });
  } catch (error) {
    console.error('VerifyOtp error:', error);
    return res.status(400).json({
      success: false,
      message: genericError
    });
  }
}

/**
 * POST /reset-password
 */
async function resetPassword(req, res) {
  const genericError = 'Invalid or expired OTP.';
  const attemptsError = 'Too many wrong attempts. Please request a new OTP.';

  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: genericError
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student || !student.resetOtpHash) {
      return res.status(400).json({
        success: false,
        message: genericError
      });
    }

    if (student.resetOtpAttempts >= 5) {
      student.resetOtpHash = undefined;
      student.resetOtpExpiresAt = undefined;
      await student.save();
      return res.status(400).json({
        success: false,
        message: attemptsError
      });
    }

    if (!student.resetOtpExpiresAt || student.resetOtpExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: genericError
      });
    }

    const candidateHash = computeOtpHash(student._id, otp);
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(student.resetOtpHash, 'hex');

    const isMatch = candidateBuf.length === storedBuf.length && crypto.timingSafeEqual(candidateBuf, storedBuf);

    if (!isMatch) {
      student.resetOtpAttempts += 1;
      const exceeded = student.resetOtpAttempts >= 5;
      if (exceeded) {
        student.resetOtpHash = undefined;
        student.resetOtpExpiresAt = undefined;
      }
      await student.save();
      return res.status(400).json({
        success: false,
        message: exceeded ? attemptsError : genericError
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one letter and one number.'
      });
    }

    const passwordHash = await Student.hashPassword(password);
    student.passwordHash = passwordHash;
    student.resetOtpHash = undefined;
    student.resetOtpExpiresAt = undefined;
    student.resetOtpAttempts = 0;
    student.resetOtpSentAt = undefined;
    await student.save();

    res.clearCookie('student_token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    try {
      await AuditLog.create({
        actorId: student._id,
        actorType: 'STUDENT',
        action: 'STUDENT_PASSWORD_RESET',
        targetEntity: 'PARTICIPANT',
        targetId: student._id,
        summary: 'Student password reset successfully',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (auditErr) {
      console.warn('Failed to record student password reset audit log:', auditErr.message);
    }

    return res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('ResetPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during password reset.'
    });
  }
}

module.exports = {
  signup,
  login,
  logout,
  me,
  forgotPassword,
  verifyOtp,
  resetPassword
};
