const AuditLog = require('../models/AuditLog');

exports.listLogs = async (req, res, next) => {
  try {
    const { action, targetEntity, page = 1, limit = 50 } = req.query;

    const query = {};
    if (action) query.action = action;
    if (targetEntity) query.targetEntity = targetEntity;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actorId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      logs
    });
  } catch (error) {
    next(error);
  }
};
