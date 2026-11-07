const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Student = require('../models/Student');

async function requireStudentAuth(req, res, next) {
  try {
    let token = req.cookies?.student_token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (decoded.kind !== 'student') {
      return res.status(401).json({ success: false, message: 'Invalid session type.' });
    }

    const student = await Student.findById(decoded.id).select('-passwordHash');
    if (!student || !student.isActive) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });
    }

    req.student = student;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
}

module.exports = { requireStudentAuth };
