const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 RUNNING MODULE 1 RESTRUCTURE VERIFICATION SUITE');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

const clientSrcDir = path.resolve(__dirname, '../src');

// TEST 1: Config exports & predicates
test('STEP 1: siteConfig.js exports GOOGLE_FORM_1_URL, isGoogleFormConfigured, and message', () => {
  const configContent = fs.readFileSync(path.join(clientSrcDir, 'config/siteConfig.js'), 'utf8');
  assert.ok(configContent.includes('export const GOOGLE_FORM_1_URL'), 'Must export GOOGLE_FORM_1_URL');
  assert.ok(configContent.includes('export function isGoogleFormConfigured'), 'Must export isGoogleFormConfigured');
  assert.ok(configContent.includes('export const APPLICATION_UNAVAILABLE_MESSAGE'), 'Must export APPLICATION_UNAVAILABLE_MESSAGE');
  assert.ok(configContent.includes('Application link is not available yet.'), 'Unavailable message must match required copy exactly');
});

// TEST 2: ApplyPage deleted and no imports remain
test('STEP 3: ApplyPage.jsx is completely deleted from client/src/pages', () => {
  const applyPagePath = path.join(clientSrcDir, 'pages/ApplyPage.jsx');
  assert.strictEqual(fs.existsSync(applyPagePath), false, 'ApplyPage.jsx must not exist');
});

// TEST 3: App.jsx redirects /apply to /
test('STEP 3: App.jsx redirects /apply to / and has no ApplyPage import', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');
  assert.strictEqual(appContent.includes("from './pages/ApplyPage'"), false, 'Must not import ApplyPage');
  assert.ok(
    appContent.includes('<Route path="/apply" element={<Navigate to="/" replace />} />'),
    'App.jsx must redirect /apply route to /'
  );
});

// TEST 4: api.js does not expose submitApplication
test('STEP 3: api.js has removed submitApplication', () => {
  const apiContent = fs.readFileSync(path.join(clientSrcDir, 'services/api.js'), 'utf8');
  assert.strictEqual(apiContent.includes('submitApplication:'), false, 'Must remove submitApplication from client api.js');
});

// TEST 5: No link to="/apply" or href="/apply" anywhere in client/src
test('STEP 2: Zero internal to="/apply" or href="/apply" links remain in components or pages', () => {
  function checkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        checkDir(full);
      } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8');
        // Ignore the route definition in App.jsx
        if (full.endsWith('App.jsx')) continue;
        assert.strictEqual(content.includes('to="/apply"'), false, `Found to="/apply" in ${full}`);
        assert.strictEqual(content.includes('href="/apply"'), false, `Found href="/apply" in ${full}`);
        assert.strictEqual(content.includes('/apply?program='), false, `Found /apply?program= in ${full}`);
      }
    }
  }
  checkDir(clientSrcDir);
});

// TEST 6: PublicLayout Apply links point to Google Form 1
test('STEP 2: PublicLayout.jsx routes header, mobile drawer, and footer to Form 1 with unavailable guards', () => {
  const layoutContent = fs.readFileSync(path.join(clientSrcDir, 'components/PublicLayout.jsx'), 'utf8');
  assert.ok(layoutContent.includes('GOOGLE_FORM_1_URL'), 'Must import GOOGLE_FORM_1_URL');
  assert.ok(layoutContent.includes('isGoogleFormConfigured'), 'Must import isGoogleFormConfigured');
  assert.ok(layoutContent.includes('APPLICATION_UNAVAILABLE_MESSAGE'), 'Must import APPLICATION_UNAVAILABLE_MESSAGE');
  assert.ok(layoutContent.includes('target="_blank"'), 'Must open in new tab');
  assert.ok(layoutContent.includes('rel="noopener noreferrer"'), 'Must have secure rel attributes');
});

// TEST 7: HomePage has Services section, Google Form 1 links, and 6-Step Journey
test('STEP 4: HomePage.jsx contains Services section, Google Form 1 CTAs, and agreed 6-step lifecycle', () => {
  const homeContent = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');
  assert.ok(homeContent.includes('id="services"'), 'Must have services section with id="services"');
  assert.ok(homeContent.includes('Web Application Development'), 'Must include Web Application Development');
  assert.ok(homeContent.includes('Mobile Application Development'), 'Must include Mobile Application Development');
  assert.ok(homeContent.includes('GOOGLE_FORM_1_URL'), 'Must reference GOOGLE_FORM_1_URL');
  assert.ok(homeContent.includes('The 6-Step Internship Journey'), 'Must have 6-Step Internship Journey heading');
  assert.ok(homeContent.includes('Apply via Google Form 1'), 'Step 1 must be Apply via Google Form 1');
  assert.ok(homeContent.includes('Official Offer Letter'), 'Step 3 must mention Official Offer Letter');
  assert.ok(homeContent.includes('Final Project Submission (Form 2)'), 'Step 5 must mention Form 2 project submission');
  assert.ok(homeContent.includes('Verified Certificate Issuance'), 'Step 6 must mention Verified Certificate Issuance');
});

// TEST 8: ProgramsPage routes cards to Google Form 1 and enforces 1-month duration guard
test('STEP 5 & 2: ProgramsPage.jsx guards duration to 1-month model and routes Apply to Form 1', () => {
  const programsContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ProgramsPage.jsx'), 'utf8');
  assert.ok(programsContent.includes('GOOGLE_FORM_1_URL'), 'Must reference GOOGLE_FORM_1_URL');
  assert.ok(programsContent.includes('Duration: 1 Month (4 Weeks)'), 'Must enforce 1 Month (4 Weeks) duration guard');
  assert.strictEqual(programsContent.includes('3-month'), false, 'Must not mention 3-month');
  assert.strictEqual(programsContent.includes('prg.startDate'), false, 'Must not render raw batch start dates');
});

// TEST 9: ProgramDetailPage removes fee gate, fee is info-only, duration guarded to 1-month
test('STEP 2 & 5: ProgramDetailPage.jsx removes fee gate, fee is informational, duration guarded to 1-month', () => {
  const detailContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ProgramDetailPage.jsx'), 'utf8');
  assert.ok(detailContent.includes('GOOGLE_FORM_1_URL'), 'Must reference GOOGLE_FORM_1_URL');
  assert.ok(detailContent.includes('Task Submission &amp; Review Fee is payable only at final submission. Applying is free.'), 'Must state fee is payable only at final submission and applying is free');
  assert.strictEqual(detailContent.includes('Applications open once NOXIRA publishes the fee'), false, 'Must NOT contain fee-gate blocking statement');
  assert.ok(detailContent.includes('1 Month (4 Weeks)'), 'Must enforce 1 Month (4 Weeks) duration guard');
  assert.strictEqual(detailContent.includes('program.startDate'), false, 'Must not render raw cohort dates');
  assert.ok(
    detailContent.includes("isFormConfigured\n              ? 'Applications are open for candidate intake via Google Form.'\n              : 'Applications are not open yet. The application link is not available yet.'"),
    'Empty-curriculum notice must conditionally match Form 1 configured state'
  );
});

// TEST 10: StatusPage link points to Google Form 1
test('STEP 2: StatusPage.jsx bottom intake link points to Google Form 1', () => {
  const statusContent = fs.readFileSync(path.join(clientSrcDir, 'pages/StatusPage.jsx'), 'utf8');
  assert.ok(statusContent.includes('GOOGLE_FORM_1_URL'), 'Must reference GOOGLE_FORM_1_URL');
  assert.ok(statusContent.includes('target="_blank"'), 'Must open in new tab');
  assert.ok(statusContent.includes('rel="noopener noreferrer"'), 'Must have secure rel attributes');
});

// TEST 11: Content rules check (strict clean English, no fake claims, no forbidden terms)
test('CONTENT RULES: Zero forbidden keywords in public client files', () => {
  const filesToCheck = [
    'components/PublicLayout.jsx',
    'pages/HomePage.jsx',
    'pages/ProgramsPage.jsx',
    'pages/ProgramDetailPage.jsx',
    'pages/StatusPage.jsx'
  ];

  const forbidden = [
    'Private Limited',
    'Pvt Ltd',
    'Razorpay',
    '3-month',
    'har mahine',
    'karein',
    'nahi',
    'hata'
  ];

  for (const f of filesToCheck) {
    const content = fs.readFileSync(path.join(clientSrcDir, f), 'utf8');
    for (const term of forbidden) {
      assert.strictEqual(
        content.toLowerCase().includes(term.toLowerCase()),
        false,
        `Found forbidden term "${term}" in ${f}`
      );
    }
  }
});

console.log('\n------------------------------------------------------');
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
