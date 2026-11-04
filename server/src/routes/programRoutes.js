const express = require('express');
const router = express.Router();
const Program = require('../models/Program');

/**
 * Public Programs Listing
 * Returns only active programs with public-safe attributes.
 * Excludes internal batch and placeholder date fields.
 */
async function getPublicPrograms(req, res, next) {
  try {
    const programs = await Program.find({ isActive: true })
      .select('code title description -_id')
      .sort({ code: 1 })
      .lean();

    res.json({
      success: true,
      programs
    });
  } catch (error) {
    next(error);
  }
}

router.get('/', getPublicPrograms);

module.exports = router;
module.exports.getPublicPrograms = getPublicPrograms;
