const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Admin = require('../models/Admin');

async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No session or token found.'
      });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select('-passwordHash');

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or deactivated administrator account.'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid token.'
    });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (roles.length && !roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of roles [${roles.join(', ')}]`
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
