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

// TEST 2: ApplyPage exists and exports default ApplyPage
test('APPLY PAGE: ApplyPage.jsx exists in client/src/pages', () => {
  const applyPagePath = path.join(clientSrcDir, 'pages/ApplyPage.jsx');
  assert.strictEqual(fs.existsSync(applyPagePath), true, 'ApplyPage.jsx must exist');
  const content = fs.readFileSync(applyPagePath, 'utf8');
  assert.ok(content.includes('export default function ApplyPage'), 'ApplyPage must export component');
});

// TEST 3: App.jsx mounts ApplyPage on /apply, mounts Settings tab and SiteSettingsProvider
test('APPLY PAGE: App.jsx mounts SiteSettingsProvider, Settings admin tab, and routes /apply to ApplyPage', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');
  assert.ok(appContent.includes("from './pages/ApplyPage'"), 'Must import ApplyPage');
  assert.ok(
    appContent.includes('<Route path="/apply" element={<ApplyPage />} />'),
    'App.jsx must route /apply to ApplyPage'
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

// TEST 5: Internal to="/apply" routes configured across components and pages
test('APPLY PAGE: Internal to="/apply" routes configured across site components', () => {
  const publicLayout = fs.readFileSync(path.join(clientSrcDir, 'components/PublicLayout.jsx'), 'utf8');
  assert.ok(publicLayout.includes('to="/apply"'), 'PublicLayout footer must link to="/apply"');
  const heroes = fs.readFileSync(path.join(clientSrcDir, 'components/Heroes.jsx'), 'utf8');
  assert.ok(heroes.includes('to="/apply"'), 'Heroes CTA must link to="/apply"');
  const home = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');
  assert.ok(home.includes('to="/apply"'), 'HomePage must link to="/apply"');
});

// TEST 6: PublicLayout routes footer and navigation to dynamic pages
test('MODULE 2: PublicLayout.jsx mounts navigation and footer properly', () => {
  const layoutContent = fs.readFileSync(path.join(clientSrcDir, 'components/PublicLayout.jsx'), 'utf8');
  assert.ok(layoutContent.includes('to="/apply"'), 'Must link to /apply');
});

// TEST 7: HomePage has Services section, dynamic Form 1 CTAs, and 8-Step Journey
test('MODULE 2: HomePage.jsx contains Services section, dynamic Form 1 CTAs, and agreed 8-step lifecycle', () => {
  const homeContent = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');
  assert.ok(homeContent.includes('id="services"'), 'Must have services section with id="services"');
  assert.ok(homeContent.includes('Web Application Development'), 'Must include Web Application Development');
  assert.ok(homeContent.includes('Mobile Application Development'), 'Must include Mobile Application Development');
  assert.ok(homeContent.includes('useSiteSettings'), 'Must use useSiteSettings hook');
  assert.ok(homeContent.includes('The 8-Step Internship Journey'), 'Must have 8-Step Internship Journey heading');
  assert.ok(homeContent.includes('Apply via Google Form 1'), 'Step 1 must be Apply via Google Form 1');
  assert.ok(homeContent.includes('Official Offer Letter'), 'Step 3 must mention Official Offer Letter');
  assert.ok(homeContent.includes('Final Project Submission (Form 2)'), 'Step 5 must mention Form 2 project submission');
  assert.ok(homeContent.includes('Verified Certificate Issuance'), 'Step 6 must mention Verified Certificate Issuance');
});

// TEST 8: ProgramsPage routes cards to dynamic Form 1 and enforces 1-month duration guard
test('MODULE 2: catalogue uses source-backed feed with live precedence and status-first application route', () => {
  const programsContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ApplyPage.jsx'), 'utf8');
  const feedContent = fs.readFileSync(path.join(clientSrcDir, 'utils/useProgrammeCatalogue.js'), 'utf8');
  const applyContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ApplyPage.jsx'), 'utf8');
  assert.ok(programsContent.includes('useProgrammeCatalogue'), 'Must use source-backed catalogue feed');
  assert.ok(feedContent.includes('CONFIGURED_PROGRAMMES') && feedContent.includes('Array.isArray(data?.programs)'), 'Must distinguish valid live feed from unavailable feed');
  assert.ok(programsContent.includes("get('program')") && programsContent.includes('selectedCategory'), 'Single application catalogue must preserve selected programme search and categories');
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');
  assert.ok(!appContent.includes('import ProgramsPage'), 'Must not introduce a second catalogue page');
  assert.ok(appContent.includes('ProgrammeListingRedirect') && appContent.includes("pathname: '/apply'"), 'Old catalogue URL must redirect to existing application catalogue');
  assert.ok(applyContent.includes('useSiteSettings') && applyContent.includes('!configured && isFormConfigured'), 'Must gate actual form on live programme/status availability');
  assert.ok(!programsContent.includes('1 Month (4 Weeks)'), 'Must not invent duration on identity-only catalogue entries');
  assert.strictEqual(programsContent.includes('3-month'), false, 'Must not mention 3-month');
  assert.strictEqual(programsContent.includes('prg.startDate'), false, 'Must not render raw batch start dates');
});

// TEST 9: ProgramDetailPage copy rules, fee info, and dynamic form integration
test('MODULE 2: programme details preserve fee-policy, live duration and three-state application copy', () => {
  const detailContent = fs.readFileSync(path.join(clientSrcDir, 'pages/ProgramDetailPage.jsx'), 'utf8');
  assert.ok(detailContent.includes('useSiteSettings'), 'Must consume useSiteSettings');
  assert.ok(detailContent.includes('Task Submission &amp; Review Fee is payable only at final submission. Applying is free.'), 'Must state fee is payable only at final submission and applying is free');
  assert.strictEqual(detailContent.includes('Applications open once NOXIRA publishes the fee'), false, 'Must NOT contain fee-gate blocking statement');
  assert.ok(detailContent.includes('program.durationWeeks') && detailContent.includes('Not published'), 'Must display live duration only when supplied, not invent fallback duration');
  assert.strictEqual(detailContent.includes('program.startDate'), false, 'Must not render raw cohort dates');
  assert.ok(detailContent.includes('Applications are open for candidate intake via Google Form.'), 'Must include open copy');
  assert.ok(detailContent.includes('Applications are not open yet. The application link is not available yet.'), 'Must include closed copy');
  assert.ok(detailContent.includes('Application status is currently unavailable.'), 'Must include neutral error/loading copy');
});

// TEST 10: StatusPage.jsx is deleted and DownloadOfferLetterPage.jsx exists
test('OFFER LETTER: StatusPage.jsx is removed and DownloadOfferLetterPage.jsx is configured', () => {
  assert.strictEqual(fs.existsSync(path.join(clientSrcDir, 'pages/StatusPage.jsx')), false, 'StatusPage.jsx must be deleted');
  assert.strictEqual(fs.existsSync(path.join(clientSrcDir, 'pages/DownloadOfferLetterPage.jsx')), true, 'DownloadOfferLetterPage.jsx must exist');
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
    'pages/ApplyPage.jsx',
    'pages/ProgramDetailPage.jsx',
    'pages/DownloadOfferLetterPage.jsx'
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
  assert.ok(pageContent.includes('one-time ₹149'), 'Fee is Rs 149 one-time (owner confirmed 22 Nov)');
  assert.ok(pageContent.includes('non-refundable'), 'Refund rule: non-refundable');
  assert.ok(pageContent.includes('Our services are intended for users above 15 years of age'), 'Privacy: owner-supplied 15+ children wording (22 Nov content PDF)');
      assert.ok(pageContent.includes('duplicate/accidental double payment'), 'Refund exception: duplicate payment');
  assert.ok(pageContent.includes('up to 3 free re-reviews'), '3 free re-reviews');
  assert.ok(pageContent.includes('3 calendar days'), '3 calendar days per correction');
  assert.ok(pageContent.includes('2-3 working days'), 'Review turnaround 2-3 working days');
    
  // Owner confirmed the policy pages on 22 Nov 2026: no draft/pending banners remain
  assert.ok(!pageContent.includes('Being finalized before launch'), 'Pending callout removed after owner confirmation');
  assert.ok(!/@[a-z]+\.(com|in|org)/i.test(pageContent.replace(/@[a-z]+\(\$/g, '')), 'No invented support email address may appear');
});

console.log('\n------------------------------------------------------');
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
