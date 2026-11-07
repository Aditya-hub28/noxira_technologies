import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, ROLE_KEYWORDS } from '../src/lib/atsAnalyzer.js';

const GOOD = `Priya Sharma
priya.sharma@example.com | +91 98765 43210 | github.com/priyasharma
EDUCATION
B.Tech Computer Science, ABC University
EXPERIENCE
Web Development Intern - XYZ Tech
- Built a responsive React dashboard used by 200+ internal users, reducing report time by 35%
- Developed REST API endpoints in Node.js and improved test coverage to 80%
PROJECTS
- Created a full-stack job tracker and deployed it for 50 classmates
SKILLS
JavaScript, React, Node.js, Python, SQL, Git, HTML, CSS, REST APIs`;

test('detects all five expected sections in a complete resume', () => {
  const r = analyze(GOOD, 'web developer');
  assert.ok(r.sections.every(s => s.ok), 'all sections found');
});

test('flags missing sections in a thin resume', () => {
  const r = analyze('hello world '.repeat(30), 'web developer');
  assert.equal(r.sections.filter(s => s.ok).length, 0);
});

test('keyword matching counts present vs missing for the role', () => {
  const r = analyze(GOOD, 'web developer');
  assert.equal(r.matchedKeys.length + r.missingKeys.length, ROLE_KEYWORDS['web developer'].length);
  assert.ok(r.matchedKeys.includes('react'));
  assert.ok(!r.matchedKeys.includes('cobol'));
});

test('numeric mentions are counted as mentions, not proven outcomes', () => {
  const r = analyze(GOOD, 'web developer');
  assert.ok(r.numbers >= 3, 'numbers detected');
});

test('verb detection is word-bounded (no substring false positives)', () => {
  const r = analyze('I implemented things and led a team '.repeat(8), 'web developer');
  assert.ok(r.foundVerbs.includes('implemented'));
  assert.ok(r.foundVerbs.includes('led'));
  assert.ok(!r.foundVerbs.includes('reduced'));
});
