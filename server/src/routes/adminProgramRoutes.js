const express = require('express');
const router = express.Router();
const Program = require('../models/Program');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PROGRAM_CATEGORIES } = require('../config/programsCatalogue');

// All admin program routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/admin/programs
 * Lists all programs, including inactive ones.
 */
async function adminGetPrograms(req, res, next) {
  try {
    const programs = await Program.find()
      .sort({ category: 1, title: 1 })
      .lean();

    const normalizedPrograms = programs.map(p => ({
      ...p,
      needsNormalization: p.durationWeeks !== 4 || p.feeInr !== 99
    }));

    res.json({
      success: true,
      programs: normalizedPrograms
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/programs
 * Creates a new program.
 * Code is required, uppercased, and must be unique.
 */
async function adminCreateProgram(req, res, next) {
  try {
    const {
      code,
      title,
      category,
      description,
      durationWeeks,
      feeInr,
      seats,
      startDate,
      endDate,
      syllabus,
      tasks,
      learningMaterials,
      isActive
    } = req.body;

    // 1. Code Validation
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Program code is required.'
      });
    }
    const cleanCode = code.trim().toUpperCase();

    const existing = await Program.findOne({ code: cleanCode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Program with code "${cleanCode}" already exists.`
      });
    }

    // 2. Title Validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Program title is required.'
      });
    }

    // 3. Category Validation
    if (category && !PROGRAM_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${PROGRAM_CATEGORIES.join(', ')}`
      });
    }

    // 4. Numeric Validations (1-Month / Rs. 99 Model strictly enforced)
    if (durationWeeks !== undefined && durationWeeks !== null && durationWeeks !== '') {
      const num = Number(durationWeeks);
      if (num !== 4) {
        return res.status(400).json({
          success: false,
          message: 'Program duration must be 4 weeks (1 month).'
        });
      }
    }

    if (feeInr !== undefined && feeInr !== null && feeInr !== '') {
      const num = Number(feeInr);
      if (num !== 99) {
        return res.status(400).json({
          success: false,
          message: 'Task Submission & Review Fee must be 99 INR.'
        });
      }
    }

    if (seats !== undefined && seats !== null && seats !== '') {
      const num = Number(seats);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({
          success: false,
          message: 'Seats must be a non-negative number.'
        });
      }
    }

    // 5. Date Validation
    let parsedStartDate = null;
    let parsedEndDate = null;
    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start date format.' });
      }
    }
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid end date format.' });
      }
    }

    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be on or after start date.'
      });
    }

    // 6. Syllabus and Tasks array normalization
    const cleanArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map(item => String(item).trim()).filter(Boolean);
      }
      if (typeof val === 'string') {
        return val.split('\n').map(item => item.trim()).filter(Boolean);
      }
      return [];
    };

    const newProgram = new Program({
      code: cleanCode,
      title: title.trim(),
      category: category ? category.trim() : undefined,
      description: description ? description.trim() : '',
      durationWeeks: 4,
      feeInr: 99,
      seats: seats !== undefined && seats !== null && seats !== '' ? Number(seats) : undefined,
      startDate: parsedStartDate || undefined,
      endDate: parsedEndDate || undefined,
      syllabus: cleanArray(syllabus),
      tasks: cleanArray(tasks),
      learningMaterials: cleanArray(learningMaterials),
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    await newProgram.save();

    res.status(201).json({
      success: true,
      message: 'Program created successfully.',
      program: newProgram
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/programs/:code
 * Updates an existing program.
 * Code itself is immutable.
 */
async function adminUpdateProgram(req, res, next) {
  try {
    const cleanCode = (req.params.code || '').trim().toUpperCase();
    const program = await Program.findOne({ code: cleanCode });

    if (!program) {
      return res.status(404).json({
        success: false,
        message: `Program with code "${cleanCode}" not found.`
      });
    }

    const {
      title,
      category,
      description,
      durationWeeks,
      feeInr,
      seats,
      startDate,
      endDate,
      syllabus,
      tasks,
      learningMaterials,
      isActive
    } = req.body;

    // 1. Title Validation
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Program title cannot be empty.'
        });
      }
      program.title = title.trim();
    }

    // 2. Category Validation
    if (category !== undefined) {
      if (category && !PROGRAM_CATEGORIES.includes(category.trim())) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${PROGRAM_CATEGORIES.join(', ')}`
        });
      }
      program.category = category ? category.trim() : undefined;
    }

    // 3. Description
    if (description !== undefined) {
      program.description = typeof description === 'string' ? description.trim() : '';
    }

    // 4. Numeric Validations (1-Month / Rs. 99 Model strictly enforced)
    if (durationWeeks !== undefined) {
      if (durationWeeks === null || durationWeeks === '') {
        return res.status(400).json({
          success: false,
          message: 'Program duration must be 4 weeks (1 month).'
        });
      }
      const num = Number(durationWeeks);
      if (num !== 4) {
        return res.status(400).json({
          success: false,
          message: 'Program duration must be 4 weeks (1 month).'
        });
      }
      program.durationWeeks = 4;
    }

    if (feeInr !== undefined) {
      if (feeInr === null || feeInr === '') {
        return res.status(400).json({
          success: false,
          message: 'Task Submission & Review Fee must be 99 INR.'
        });
      }
      const num = Number(feeInr);
      if (num !== 99) {
        return res.status(400).json({
          success: false,
          message: 'Task Submission & Review Fee must be 99 INR.'
        });
      }
      program.feeInr = 99;
    }

    if (seats !== undefined) {
      if (seats === null || seats === '') {
        program.seats = undefined;
      } else {
        const num = Number(seats);
        if (isNaN(num) || num < 0) {
          return res.status(400).json({
            success: false,
            message: 'Seats must be a non-negative number.'
          });
        }
        program.seats = num;
      }
    }

    // 5. Date Validation
    let targetStartDate = program.startDate;
    let targetEndDate = program.endDate;

    if (startDate !== undefined) {
      if (startDate === null || startDate === '') {
        targetStartDate = null;
        program.startDate = undefined;
      } else {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid start date format.' });
        }
        targetStartDate = d;
        program.startDate = d;
      }
    }

    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        targetEndDate = null;
        program.endDate = undefined;
      } else {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid end date format.' });
        }
        targetEndDate = d;
        program.endDate = d;
      }
    }

    if (targetStartDate && targetEndDate && new Date(targetEndDate) < new Date(targetStartDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be on or after start date.'
      });
    }

    // 6. Syllabus & Tasks
    const cleanArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map(item => String(item).trim()).filter(Boolean);
      }
      if (typeof val === 'string') {
        return val.split('\n').map(item => item.trim()).filter(Boolean);
      }
      return [];
    };

    if (syllabus !== undefined) {
      program.syllabus = cleanArray(syllabus);
    }
    if (tasks !== undefined) {
      program.tasks = cleanArray(tasks);
    }
    if (learningMaterials !== undefined) {
      program.learningMaterials = cleanArray(learningMaterials);
    }

    // 7. Active State Toggle
    if (isActive !== undefined) {
      program.isActive = Boolean(isActive);
    }

    await program.save();

    const returnedProgram = program.toObject();
    returnedProgram.needsNormalization = returnedProgram.durationWeeks !== 4 || returnedProgram.feeInr !== 99;

    res.json({
      success: true,
      message: 'Program updated successfully.',
      program: returnedProgram
    });
  } catch (error) {
    next(error);
  }
}

router.get('/', adminGetPrograms);
router.post('/', requireRole(['SUPER_ADMIN', 'ISSUER']), adminCreateProgram);
router.patch('/:code', requireRole(['SUPER_ADMIN', 'ISSUER']), adminUpdateProgram);

module.exports = router;
module.exports.adminGetPrograms = adminGetPrograms;
module.exports.adminCreateProgram = adminCreateProgram;
module.exports.adminUpdateProgram = adminUpdateProgram;
