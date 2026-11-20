/**
 * NOXIRA Launch-Scope Regression Test Suite
 *
 * Verifies that deferred features (student login/signup, student dashboard,
 * courses/quizzes, career/developer tools) are cleanly deactivated from the active site
 * while preserving all internship launch functionality, public routes, and admin systems.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const clientSrcDir = path.join(__dirname, '../src');
const repoRootDir = path.join(__dirname, '../..');
const archiveDir = path.join(repoRootDir, 'hidden-not-in-use');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('🧪 RUNNING LAUNCH-SCOPE CLEANUP REGRESSION SUITE');
console.log('======================================================\n');

// TEST 1: Dedicated student auth files absent from client/src and present in hidden-not-in-use
test('LAUNCH SCOPE: Dedicated student files are absent from active client/src and safely archived', () => {
  const activeStudentFiles = [
    'pages/LoginPage.jsx',
    'pages/SignupPage.jsx',
    'pages/ForgotPasswordPage.jsx',
    'pages/AccountPage.jsx',
    'context/StudentAuthContext.jsx'
  ];

  for (const rel of activeStudentFiles) {
    const activePath = path.join(clientSrcDir, rel);
    assert.strictEqual(fs.existsSync(activePath), false, `Active file must not exist: ${rel}`);

    const archivedPath = path.join(archiveDir, 'client/src', rel);
    assert.strictEqual(fs.existsSync(archivedPath), true, `Archived copy must exist: ${rel}`);
  }
});

// TEST 2: App.jsx does not mount StudentAuthProvider or import student pages; redirects old paths
test('LAUNCH SCOPE: App.jsx unmounts StudentAuthProvider and redirects old student paths to /', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');

  assert.strictEqual(appContent.includes('StudentAuthProvider'), false, 'App.jsx must not reference StudentAuthProvider');
  assert.strictEqual(appContent.includes("from './pages/LoginPage'"), false, 'App.jsx must not import LoginPage');
  assert.strictEqual(appContent.includes("from './pages/SignupPage'"), false, 'App.jsx must not import SignupPage');
  assert.strictEqual(appContent.includes("from './pages/ForgotPasswordPage'"), false, 'App.jsx must not import ForgotPasswordPage');
  assert.strictEqual(appContent.includes("from './pages/AccountPage'"), false, 'App.jsx must not import AccountPage');

  // Verify safe redirects
  assert.ok(appContent.includes('<Route path="/login" element={<Navigate to="/" replace />} />'), '/login must redirect to /');
  assert.ok(appContent.includes('<Route path="/signup" element={<Navigate to="/" replace />} />'), '/signup must redirect to /');
  assert.ok(appContent.includes('<Route path="/forgot-password" element={<Navigate to="/" replace />} />'), '/forgot-password must redirect to /');
  assert.ok(appContent.includes('<Route path="/account" element={<Navigate to="/" replace />} />'), '/account must redirect to /');

  // Verify Admin console and Admin login are protected
  assert.ok(appContent.includes('AdminLoginPage'), 'AdminLoginPage must remain intact');
  assert.ok(appContent.includes('DashboardOverview'), 'DashboardOverview admin dashboard must remain intact');
});

// TEST 3: SiteShell desktop navbar has no student auth controls and no Tools link
test('LAUNCH SCOPE: SiteShell navbar has no student auth or Tools references', () => {
  const shellContent = fs.readFileSync(path.join(clientSrcDir, 'components/SiteShell.jsx'), 'utf8');

  assert.strictEqual(shellContent.includes('useStudentAuth'), false, 'SiteShell must not import useStudentAuth');
  assert.strictEqual(shellContent.includes('nxacct'), false, 'SiteShell must not contain nxacct account button');
  assert.strictEqual(shellContent.includes("onClick={() => navigate('/login')}"), false, 'SiteShell must not have login button');
  assert.strictEqual(shellContent.includes("'Tools'"), false, 'SiteShell fallback links must not include Tools');
});

// TEST 4: MobileMenu has no Skill Course, Career Tools, or student footer
test('LAUNCH SCOPE: MobileMenu drawer excludes Skill Course, Career Tools, and student footer', () => {
  const menuContent = fs.readFileSync(path.join(clientSrcDir, 'components/MobileMenu.jsx'), 'utf8');

  assert.strictEqual(menuContent.includes('useStudentAuth'), false, 'MobileMenu must not import useStudentAuth');
  assert.strictEqual(menuContent.includes('Skill Course'), false, 'MobileMenu must not contain Skill Course');
  assert.strictEqual(menuContent.includes('Career Tools'), false, 'MobileMenu must not contain Career Tools');
  assert.strictEqual(menuContent.includes('mfoot'), false, 'MobileMenu must not render auth mfoot');

  // Preserves Student Reviews under More
  assert.ok(menuContent.includes('Student Reviews'), 'MobileMenu must preserve Student Reviews testimonial link');
});

// TEST 5: HomePage excludes career-tools section and maintains sequential section numbering
test('LAUNCH SCOPE: HomePage excludes career-tools section with clean renumbered headings', () => {
  const homeContent = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');

  assert.strictEqual(homeContent.includes('id="career-tools"'), false, 'HomePage must not contain career-tools section');
  assert.strictEqual(homeContent.includes('Browse Courses'), false, 'HomePage must not contain Browse Courses');
  assert.strictEqual(homeContent.includes('Check ATS Score'), false, 'HomePage must not contain Check ATS Score');

  // Sequential numbering: 01 - INTERNSHIPS, 02 - JOURNEY, 03 - SERVICES, 04 - CONTACT
  assert.ok(homeContent.includes('01 - INTERNSHIPS'), 'Must have 01 - INTERNSHIPS');
  assert.ok(homeContent.includes('02 - JOURNEY'), 'Must renumber journey to 02 - JOURNEY');
  assert.ok(homeContent.includes('03 - SERVICES'), 'Must renumber services to 03 - SERVICES');
  assert.ok(homeContent.includes('04 - CONTACT'), 'Must renumber contact to 04 - CONTACT');
});

// TEST 6: Heroes excludes deferred words from conveyor wordPool and allRows
test('LAUNCH SCOPE: Heroes conveyor contains only active-scope terms', () => {
  const heroesContent = fs.readFileSync(path.join(clientSrcDir, 'components/Heroes.jsx'), 'utf8');

  assert.strictEqual(heroesContent.includes('SKILL COURSE'), false, 'Heroes must not contain SKILL COURSE');
  assert.strictEqual(heroesContent.includes('CAREER TOOLS'), false, 'Heroes must not contain CAREER TOOLS');
  assert.ok(heroesContent.includes('INTERNSHIPS'), 'Heroes must contain INTERNSHIPS');
  assert.ok(heroesContent.includes('PROJECTS'), 'Heroes must contain PROJECTS');
});

// TEST 7: api.js excludes student methods and exports
test('LAUNCH SCOPE: client/src/services/api.js has no active student endpoints', () => {
  const apiContent = fs.readFileSync(path.join(clientSrcDir, 'services/api.js'), 'utf8');

  assert.strictEqual(apiContent.includes('studentSignup'), false, 'api.js must not export studentSignup');
  assert.strictEqual(apiContent.includes('studentLogin'), false, 'api.js must not export studentLogin');
  assert.strictEqual(apiContent.includes('studentLogout'), false, 'api.js must not export studentLogout');
  assert.strictEqual(apiContent.includes('studentMe'), false, 'api.js must not export studentMe');
  assert.strictEqual(apiContent.includes('studentForgotPassword'), false, 'api.js must not export studentForgotPassword');

  // Active public and admin methods remain
  assert.ok(apiContent.includes('getPublicSettings:'), 'api.js must expose getPublicSettings');
  assert.ok(apiContent.includes('getPrograms:'), 'api.js must expose getPrograms');
  assert.ok(apiContent.includes('login:'), 'api.js must expose admin login');
});

// TEST 8: nx.config.js excludes Tools
test('LAUNCH SCOPE: nx.config.js excludes Tools from links', () => {
  const configContent = fs.readFileSync(path.join(clientSrcDir, 'nx.config.js'), 'utf8');
  assert.strictEqual(configContent.includes("'Tools'"), false, 'nx.config.js must not include Tools');
});

// TEST 9: hidden-not-in-use README.md and snippets exist
test('LAUNCH SCOPE: Archive README.md and extracted snippets exist in hidden-not-in-use', () => {
  assert.ok(fs.existsSync(path.join(archiveDir, 'README.md')), 'Archive README.md must exist');
  assert.ok(fs.existsSync(path.join(archiveDir, 'client/src/services/studentApiSnippet.js')), 'studentApiSnippet must exist');
  assert.ok(fs.existsSync(path.join(archiveDir, 'client/src/snippets/CareerToolsSection.jsx')), 'CareerToolsSection snippet must exist');
  assert.ok(fs.existsSync(path.join(archiveDir, 'server/src/middleware/studentRateLimitersSnippet.js')), 'studentRateLimitersSnippet must exist');
  assert.ok(fs.existsSync(path.join(archiveDir, 'server/src/services/studentEmailSnippet.js')), 'studentEmailSnippet must exist');
});

console.log('\n------------------------------------------------------');
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
