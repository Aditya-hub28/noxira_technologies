const SkillCourse = require('../models/SkillCourse');
const QuizQuestion = require('../models/QuizQuestion');
const { COURSES, BANKS } = require('../config/skillCourseCatalogue');

/**
 * Idempotent seed: upserts course metadata and refreshes question banks.
 * Re-running replaces each bank wholesale (pre-launch banks are versioned
 * by content, not by stable IDs).
 */
async function seedSkillCourses() {
  const summary = [];
  for (const course of COURSES) {
    await SkillCourse.updateOne({ code: course.code }, { $set: course }, { upsert: true });

    const bank = BANKS[course.code] || [];
    if (bank.length !== course.questionCount) {
      throw new Error(`Bank for ${course.code} has ${bank.length} questions but course declares ${course.questionCount}`);
    }
    await QuizQuestion.deleteMany({ courseCode: course.code });
    await QuizQuestion.insertMany(
      bank.map((item, idx) => ({
        courseCode: course.code,
        question: item.q,
        options: item.o,
        correctIndex: item.c,
        order: idx
      }))
    );
    summary.push(`${course.code}: ${bank.length} questions`);
  }
  return summary;
}

if (require.main === module) {
  const mongoose = require('mongoose');
  const env = require('../config/env');
  mongoose.connect(env.MONGODB_URI).then(async () => {
    const summary = await seedSkillCourses();
    console.log('Seeded skill courses:', summary.join(' | '));
    await mongoose.disconnect();
  }).catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedSkillCourses };
