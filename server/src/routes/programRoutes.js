const express = require('express');
const router = express.Router();
const Program = require('../models/Program');

/**
 * Public Programs Listing
 * Returns only active programs with public-safe attributes.
 * Excludes internal batch and placeholder date fields.
 * Sorted by category, then title.
 */
async function getPublicPrograms(req, res, next) {
  try {
    const programs = await Program.find({ isActive: true })
      .select('code title description category durationWeeks feeInr seats startDate endDate syllabus tasks -_id')
      .sort({ category: 1, title: 1 })
      .lean();

    res.json({
      success: true,
      programs
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public Program Detail
 * Returns a single active program by its code with public-safe attributes.
 * Returns 404 if code is unknown or inactive.
 */
async function getPublicProgramByCode(req, res, next) {
  try {
    const cleanCode = (req.params.code || '').trim().toUpperCase();
    const program = await Program.findOne({ code: cleanCode, isActive: true })
      .select('code title description category durationWeeks feeInr seats startDate endDate syllabus tasks -_id')
      .lean();

    if (!program) {
      return res.status(404).json({
        success: false,
        message: `Program with code "${cleanCode}" not found or is currently inactive.`
      });
    }

    res.json({
      success: true,
      program
    });
  } catch (error) {
    next(error);
  }
}

router.get('/', getPublicPrograms);
router.get('/:code', getPublicProgramByCode);

module.exports = router;
module.exports.getPublicPrograms = getPublicPrograms;
module.exports.getPublicProgramByCode = getPublicProgramByCode;
