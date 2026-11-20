const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Student = require('../models/Student');

async function requireStudent(req, res, next) {
  try {
    const token = req.cookies?.student_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Student authentication required. Please log in.'
      });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (decoded.typ !== 'student') {
      return res.status(401).json({
        success: false,
        message: 'Invalid student session.'
      });
    }

    const student = await Student.findById(decoded.id).select('-passwordHash -resetOtpHash');

    if (!student || !student.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Student account is inactive or not found.'
      });
    }

    req.student = student;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid token.'
    });
  }
}

module.exports = { requireStudent };
