const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 RUNNING MODULE 1 & 2 VERIFICATION SUITE');
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

// TEST 1: Config exports & predicates (hardcoded URL removed, messages exported)
test('MODULE 2: siteConfig.js exports APPLICATION_UNAVAILABLE_MESSAGE and neutral message, no hardcoded URL', () => {
  const configContent = fs.readFileSync(path.join(clientSrcDir, 'config/siteConfig.js'), 'utf8');
  assert.strictEqual(configContent.includes('export const GOOGLE_FORM_1_URL ='), false, 'Hardcoded GOOGLE_FORM_1_URL must be removed');
  assert.ok(configContent.includes('export const APPLICATION_UNAVAILABLE_MESSAGE'), 'Must export APPLICATION_UNAVAILABLE_MESSAGE');
  assert.ok(configContent.includes('Application link is not available yet.'), 'Unavailable message must match required copy exactly');
  assert.ok(configContent.includes('APPLICATION_NEUTRAL_MESSAGE'), 'Must export APPLICATION_NEUTRAL_MESSAGE');
});

// TEST 2: ApplyPage deleted and no imports remain
test('STEP 3: ApplyPage.jsx is completely deleted from client/src/pages', () => {
  const applyPagePath = path.join(clientSrcDir, 'pages/ApplyPage.jsx');
  assert.strictEqual(fs.existsSync(applyPagePath), false, 'ApplyPage.jsx must not exist');
});

// TEST 3: App.jsx redirects /apply to /, mounts Settings tab and SiteSettingsProvider
test('MODULE 2: App.jsx mounts SiteSettingsProvider, Settings admin tab, and redirects /apply to /', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');
  assert.strictEqual(appContent.includes("from './pages/ApplyPage'"), false, 'Must not import ApplyPage');
  assert.ok(
    appContent.includes('<Route path="/apply" element={<Navigate to="/" replace />} />'),
    'App.jsx must redirect /apply route to /'
  );
  assert.ok(appContent.includes('SiteSettingsProvider'), 'App.jsx must mount SiteSettingsProvider');
  assert.ok(appContent.includes("id: 'settings'"), 'AdminConsole must include settings tab');
  assert.ok(appContent.includes('<AdminSettingsPage />'), 'AdminConsole must render AdminSettingsPage');
});

// TEST 4: api.js exposes settings endpoints
test('MODULE 2: api.js exposes public & admin settings endpoints', () => {
  const apiContent = fs.readFileSync(path.join(clientSrcDir, 'services/api.js'), 'utf8');
  assert.strictEqual(apiContent.includes('submitApplication:'), false, 'Must remove submitApplication from client api.js');
  assert.ok(apiContent.includes('getPublicSettings:'), 'api.js must expose getPublicSettings');
  assert.ok(apiContent.includes('adminGetGoogleForm1:'), 'api.js must expose adminGetGoogleForm1');
  assert.ok(apiContent.includes('adminUpdateGoogleForm1:'), 'api.js must expose adminUpdateGoogleForm1');
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
        if (full.endsWith('App.jsx')) continue;
        assert.strictEqual(content.includes('to="/apply"'), false, `Found to="/apply" in ${full}`);
        assert.strictEqual(content.includes('href="/apply"'), false, `Found href="/apply" in ${full}`);
        assert.strictEqual(content.includes('/apply?program='), false, `Found /apply?program= in ${full}`);
      }
    }
  }
  checkDir(clientSrcDir);
});

// TEST 6: PublicLayout routes header, mobile drawer, and footer to dynamic Form 1 hook
test('MODULE 2: PublicLayout.jsx consumes useSiteSettings with safe neutral/unavailable fallbacks', () => {
  const layoutContent = fs.readFileSync(path.join(clientSrcDir, 'components/PublicLayout.jsx'), 'utf8');
  assert.ok(layoutContent.includes('useSiteSettings'), 'Must consume useSiteSettings hook');
  assert.ok(layoutContent.includes('googleForm1Url'), 'Must use googleForm1Url');
  assert.ok(layoutContent.includes('target="_blank"'), 'Must open in new tab');
  assert.ok(layoutContent.includes('rel="noopener noreferrer"'), 'Must have secure rel attributes');
});

// TEST 7: HomePage has Services section, dynamic Form 1 CTAs, and 6-Step Journey
test('MODULE 2: HomePage.jsx contains Services section, dynamic Form 1 CTAs, and agreed 6-step lifecycle', () => {
  const homeContent = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');
  assert.ok(homeContent.includes('id="services"'), 'Must have services section with id="services"');
  assert.ok(homeContent.includes('Web Application Development'), 'Must include Web Application Development');
  assert.ok(homeContent.includes('Mobile Application Development'), 'Must include Mobile Application Development');
  assert.ok(homeContent.includes('useSiteSettings'), 'Must use useSiteSettings hook');
  assert.ok(homeContent.includes('The 6-Step Internship Journey'), 'Must have 6-Step Internship Journey heading');
  assert.ok(homeContent.includes('Apply via Google Form 1'), 'Step 1 must be Apply via Google Form 1');
  assert.ok(homeContent.includes('Official Offer Letter'), 'Step 3 must mention Official Offer Letter');
  assert.ok(homeContent.includes('Final Project Submission (Form 2)'), 'Step 5 must mention Form 2 project submission');
  assert.ok(homeContent.includes('Verified Certificate Issuance'), 'Step 6 must mention Verified Certificate Issuance');
});

// TEST 8: ProgramsPage routes cards to dynamic Form 1 and enforces 1-month duration guard
test('MODULE 2: ProgramsPage.jsx guards duration to 1-month model and routes Apply via useSiteSettings', () => {
  const programsContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ProgramsPage.jsx'), 'utf8');
  assert.ok(programsContent.includes('useSiteSettings'), 'Must reference useSiteSettings');
  assert.ok(programsContent.includes('Duration: 1 Month (4 Weeks)'), 'Must enforce 1 Month (4 Weeks) duration guard');
  assert.strictEqual(programsContent.includes('3-month'), false, 'Must not mention 3-month');
  assert.strictEqual(programsContent.includes('prg.startDate'), false, 'Must not render raw batch start dates');
});

// TEST 9: ProgramDetailPage copy rules, fee info, and dynamic form integration
test('MODULE 2: ProgramDetailPage.jsx conforms to 3-state empty curriculum copy rules & 1-month / Rs.99 model', () => {
  const detailContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ProgramDetailPage.jsx'), 'utf8');
  assert.ok(detailContent.includes('useSiteSettings'), 'Must consume useSiteSettings');
  assert.ok(detailContent.includes('Task Submission &amp; Review Fee is payable only at final submission. Applying is free.'), 'Must state fee is payable only at final submission and applying is free');
  assert.strictEqual(detailContent.includes('Applications open once NOXIRA publishes the fee'), false, 'Must NOT contain fee-gate blocking statement');
  assert.ok(detailContent.includes('1 Month (4 Weeks)'), 'Must enforce 1 Month (4 Weeks) duration guard');
  assert.strictEqual(detailContent.includes('program.startDate'), false, 'Must not render raw cohort dates');
  assert.ok(detailContent.includes('Applications are open for candidate intake via Google Form.'), 'Must include open copy');
  assert.ok(detailContent.includes('Applications are not open yet. The application link is not available yet.'), 'Must include closed copy');
  assert.ok(detailContent.includes('Application status is currently unavailable.'), 'Must include neutral error/loading copy');
});

// TEST 10: StatusPage link points to dynamic Form 1
test('MODULE 2: StatusPage.jsx bottom intake link consumes useSiteSettings', () => {
  const statusContent = fs.readFileSync(path.join(clientSrcDir, 'pages/StatusPage.jsx'), 'utf8');
  assert.ok(statusContent.includes('useSiteSettings'), 'Must reference useSiteSettings');
  assert.ok(statusContent.includes('target="_blank"'), 'Must open in new tab');
  assert.ok(statusContent.includes('rel="noopener noreferrer"'), 'Must have secure rel attributes');
});

// TEST 11: AdminProgramsPage locks duration/fee and handles normalization
test('MODULE 2: AdminProgramsPage locks duration to 1 Month and fee to Rs.99, supports normalization flag', () => {
  const adminProgContent = fs.readFileSync(path.join(clientSrcDir, 'pages/AdminProgramsPage.jsx'), 'utf8');
  assert.ok(adminProgContent.includes('1 Month (4 weeks)'), 'Duration field must be locked to 1 Month (4 weeks)');
  assert.ok(adminProgContent.includes('₹99'), 'Fee field must be locked to ₹99');
  assert.ok(adminProgContent.includes('Needs normalization'), 'Must show Needs normalization badge');
  assert.ok(adminProgContent.includes('handleNormalizeProgram'), 'Must provide normalization handler');
});

// TEST 12: Content rules check (strict clean English, no fake claims, no forbidden terms)
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

// TEST 13: MODULE 3 - Form 1 Import tab in App.jsx and api.js methods
test('MODULE 3: App.jsx mounts Form 1 Import tab and api.js exposes previewForm1 and commitForm1', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');
  assert.ok(appContent.includes("id: 'form1-import'"), 'App.jsx must declare form1-import tab');
  assert.ok(appContent.includes('<Form1ImportPage'), 'App.jsx must render Form1ImportPage');

  const apiContent = fs.readFileSync(path.join(clientSrcDir, 'services/api.js'), 'utf8');
  assert.ok(apiContent.includes('previewForm1:'), 'api.js must export previewForm1');
  assert.ok(apiContent.includes('commitForm1:'), 'api.js must export commitForm1');
});

// TEST 14: MODULE 3 - AdminApplicationsPage displays source badge and Form 1 responses
test('MODULE 3: AdminApplicationsPage displays source badge and Form 1 responses', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'pages/AdminApplicationsPage.jsx'), 'utf8');
  assert.ok(appContent.includes("app.intakeSource === 'FORM1_IMPORT'"), 'Must check app.intakeSource for source badge');
  assert.ok(appContent.includes('Google Form 1 Responses'), 'Must render Form 1 responses in candidate detail drawer');
});

// TEST 15: MODULE 3 - generateApplicationsCsv escapes commas, quotes, line breaks, and formula injection
test('MODULE 3: generateApplicationsCsv generator produces RFC 4180-compliant and formula-safe CSV', () => {
  const form1PageContent = fs.readFileSync(path.join(clientSrcDir, 'pages/Form1ImportPage.jsx'), 'utf8');
  assert.ok(form1PageContent.includes('export function generateApplicationsCsv'), 'Must export generateApplicationsCsv');
  
  // Test formula escaping pattern
  assert.ok(form1PageContent.includes('/^[=+\\-@\\t\\r]/'), 'Must check for formula leading characters');
  assert.ok(form1PageContent.includes('.replace(/"/g, \'""\')'), 'Must double internal quotes for RFC 4180');
});

// TEST 16: MODULE 3 FIX PASS - detail drawer fetches full record with stale-response guard
test('MODULE 3 FIX: detail drawer fetches adminGetApplicationDetail on open with stale guard and error notice', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'pages/AdminApplicationsPage.jsx'), 'utf8');
  assert.ok(appContent.includes('openApplicationDetail'), 'Must open the drawer through openApplicationDetail');
  assert.ok(appContent.includes('api.adminGetApplicationDetail(app.applicationId || app._id)'), 'Drawer must fetch the full detail record on open');
  assert.ok(appContent.includes('detailRequestRef.current !== requestId'), 'Stale fetch responses must be discarded');
  assert.ok(appContent.includes('Could not load full details.'), 'Drawer must show a neutral error notice on fetch failure');
  assert.ok(appContent.includes('closeApplicationDetail'), 'Closing the drawer must invalidate in-flight fetches');
});

// TEST 17: MODULE 3 FIX PASS - SKIPPED preview note + NEEDS_NORMALIZATION result classification
test('MODULE 3 FIX: preview SKIPPED note and result NEEDS_NORMALIZATION card/list', () => {
  const form1Content = fs.readFileSync(path.join(clientSrcDir, 'pages/Form1ImportPage.jsx'), 'utf8');
  assert.ok(form1Content.includes('Skipped by admin domain mapping'), 'SKIPPED rows must show an honest skipped note');
  assert.ok(form1Content.includes('needsNormalizationSkipped'), 'Result screen must show the NEEDS_NORMALIZATION count');
  assert.ok(form1Content.includes('details.needsNormalization'), 'Result screen must list NEEDS_NORMALIZATION rows');
});

// TEST 18: MODULE 10 - public policy pages with owner-decided rules only, pending items visibly flagged
test('MODULE 10: policy pages (Terms/Privacy/Refund/Review) wired with grounded content and honest pending flags', () => {
  const pageContent = fs.readFileSync(path.join(clientSrcDir, 'pages/PolicyPage.jsx'), 'utf8');
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');
  const layoutContent = fs.readFileSync(path.join(clientSrcDir, 'components/PublicLayout.jsx'), 'utf8');

  // Four routes wired
  for (const route of ['/terms', '/privacy', '/payment-refund', '/review-rules']) {
    assert.ok(appContent.includes(`path="${route}"`), `Route ${route} must be wired in App.jsx`);
    assert.ok(layoutContent.includes(`to="${route}"`), `Footer must link ${route}`);
  }

  // Owner-decided rules present (6 Nov 2026 decisions)
  assert.ok(pageContent.includes('one-time Rs. 99'), 'Fee is Rs. 99 one-time at final submission');
  assert.ok(pageContent.includes('non-refundable'), 'Refund rule: non-refundable');
  assert.ok(pageContent.includes('duplicate/accidental double payment'), 'Refund exception: duplicate payment');
  assert.ok(pageContent.includes('up to 3 free re-reviews'), '3 free re-reviews');
  assert.ok(pageContent.includes('3 calendar days'), '3 calendar days per correction');
  assert.ok(pageContent.includes('2-3 working days'), 'Review turnaround 2-3 working days');
  assert.ok(pageContent.includes('never shown publicly'), 'Email/phone never public');
  assert.ok(pageContent.includes('no self-service deletion option'), 'No self-service deletion');

  // Pending items are flagged, not invented
  assert.ok(pageContent.includes('Being finalized before launch'), 'Pending callout must render');
  assert.ok(pageContent.includes('PENDING_LAUNCH_ITEMS'), 'Pending items list must exist');
  assert.ok(!/@[a-z]+\.(com|in|org)/i.test(pageContent.replace(/@[a-z]+\(\$/g, '')), 'No invented support email address may appear');
});

console.log('\n------------------------------------------------------');
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
