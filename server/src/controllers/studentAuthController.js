const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Student = require('../models/Student');

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
