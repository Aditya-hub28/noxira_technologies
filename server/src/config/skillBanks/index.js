/**
 * Per-track skill course modules. Each module exports
 * { course: {...}, questions: [{ q, o[4], c }] } with exactly 50 original MCQs.
 * Missing modules are skipped so banks can land incrementally.
 */
const MODULES = [
  './javaProg',
  './cppProg',
  './appDev',
  './fullStack',
  './machineLearning',
  './dataScience',
  './aiEngineering',
  './cyberSecurity',
  './cloudComputing',
  './uiUx'
];

const COURSES = [];
const BANKS = {};
for (const m of MODULES) {
  let t;
  try {
    t = require(m);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') continue;
    throw err;
  }
  if (!t || !t.course || !Array.isArray(t.questions)) continue;
  COURSES.push(t.course);
  BANKS[t.course.code] = t.questions;
}

module.exports = { COURSES, BANKS };
