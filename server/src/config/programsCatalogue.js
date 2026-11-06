/**
 * NOXIRA 31-Program Catalogue Definition & Additive Idempotent Seeder
 *
 * Rules:
 * - Content fields (syllabus, tasks, duration, fee, seats, dates) are NOT invented.
 * - Upsert by code with $setOnInsert ensures re-running never overwrites existing records or owner edits.
 * - Existing records (e.g. FS-DEV, AI-ENG) only have their category updated if missing; other fields are never touched.
 */

const CATALOGUE_PROGRAMS = [
  // Development (5)
  { code: 'FE-DEV', title: 'Frontend Development', category: 'Development' },
  { code: 'BE-DEV', title: 'Backend Development', category: 'Development' },
  { code: 'FS-DEV', title: 'Full Stack Development', category: 'Development' },
  { code: 'APP-DEV', title: 'App Development', category: 'Development' },
  { code: 'DEVOPS', title: 'DevOps', category: 'Development' },

  // Programming (4)
  { code: 'PY-PROG', title: 'Python Programming', category: 'Programming' },
  { code: 'JAVA-PROG', title: 'Java Programming', category: 'Programming' },
  { code: 'CPP-PROG', title: 'C++ Programming', category: 'Programming' },
  { code: 'C-PROG', title: 'C Programming', category: 'Programming' },

  // AI & Data Science (6)
  { code: 'AI-ENG', title: 'AI Engineering', category: 'AI & Data Science' },
  { code: 'ML', title: 'Machine Learning', category: 'AI & Data Science' },
  { code: 'DS-AI', title: 'Data Science & AI', category: 'AI & Data Science' },
  { code: 'BIZ-AN', title: 'Business Analytics', category: 'AI & Data Science' },
  { code: 'POWER-BI', title: 'Power BI', category: 'AI & Data Science' },
  { code: 'BIOINFO', title: 'Bioinformatics', category: 'AI & Data Science' },

  // Design (3)
  { code: 'GRAPHIC', title: 'Graphic Design', category: 'Design' },
  { code: 'UIUX', title: 'UI/UX Design', category: 'Design' },
  { code: 'WP-CMS', title: 'WordPress/CMS', category: 'Design' },

  // Business (5)
  { code: 'DIGI-MKT', title: 'Digital Marketing', category: 'Business' },
  { code: 'CONTENT', title: 'Content Writing', category: 'Business' },
  { code: 'HR', title: 'Human Resources', category: 'Business' },
  { code: 'STOCK', title: 'Stock Market & Trading', category: 'Business' },
  { code: 'FIN-INV', title: 'Finance & Investment', category: 'Business' },

  // Engineering (8)
  { code: 'CYBER', title: 'Cybersecurity', category: 'Engineering' },
  { code: 'CLOUD', title: 'Cloud Computing', category: 'Engineering' },
  { code: 'IOT-ROBO', title: 'IoT & Robotics', category: 'Engineering' },
  { code: 'CAD-MECH', title: 'CAD/Mechanical', category: 'Engineering' },
  { code: 'MECH-SIM', title: 'Mechanical Design & Simulation', category: 'Engineering' },
  { code: 'CIVIL', title: 'Civil Engineering', category: 'Engineering' },
  { code: 'PHARMA', title: 'Pharmaceutical Research', category: 'Engineering' },
  { code: 'BIOTECH', title: 'Biotechnology', category: 'Engineering' }
];

const PROGRAM_CATEGORIES = [
  'Development',
  'Programming',
  'AI & Data Science',
  'Design',
  'Business',
  'Engineering'
];

/**
 * Idempotently seeds or updates the full 31-program catalogue.
 * - Uses $setOnInsert for new records so existing descriptions, titles, dates, or owner edits are never overwritten.
 * - Sets category for existing records ONLY if the category is currently missing/blank.
 */
async function seedProgramCatalogue(ProgramModel = require('../models/Program')) {
  for (const prog of CATALOGUE_PROGRAMS) {
    // 1. Insert if code does not exist (default 1-month / Rs.99 model, isActive: true)
    await ProgramModel.updateOne(
      { code: prog.code },
      {
        $setOnInsert: {
          code: prog.code,
          title: prog.title,
          category: prog.category,
          durationWeeks: 4,
          feeInr: 99,
          isActive: true
        }
      },
      { upsert: true }
    );

    // 2. For existing records: update category ONLY if missing or empty
    await ProgramModel.updateOne(
      {
        code: prog.code,
        $or: [
          { category: { $exists: false } },
          { category: null },
          { category: '' }
        ]
      },
      {
        $set: { category: prog.category }
      }
    );
  }

  // 3. Additive backfill for unset durationWeeks (4) and feeInr (99)
  await ProgramModel.updateMany(
    {
      $or: [
        { durationWeeks: { $exists: false } },
        { durationWeeks: null }
      ]
    },
    { $set: { durationWeeks: 4 } }
  );

  await ProgramModel.updateMany(
    {
      $or: [
        { feeInr: { $exists: false } },
        { feeInr: null }
      ]
    },
    { $set: { feeInr: 99 } }
  );

  // 4. Scan and log any conflicting legacy programmes without overwriting them
  try {
    const conflicting = await ProgramModel.find({
      $or: [
        { durationWeeks: { $ne: 4 } },
        { feeInr: { $ne: 99 } }
      ]
    }).select('code title durationWeeks feeInr').lean();

    if (conflicting && conflicting.length > 0) {
      console.log(`⚠️ Legacy Programme Normalization: ${conflicting.length} programme(s) have conflicting values and require admin normalization:`);
      conflicting.forEach(p => console.log(`   - ${p.code}: durationWeeks=${p.durationWeeks}, feeInr=${p.feeInr}`));
    }
  } catch (err) {
    // Non-fatal logging
  }
}

module.exports = {
  CATALOGUE_PROGRAMS,
  PROGRAM_CATEGORIES,
  seedProgramCatalogue
};
