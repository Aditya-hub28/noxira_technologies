const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 RUNNING STUDENT AUTH VERIFICATION SUITE');
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

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.html') || file.endsWith('.css')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// TEST 1: Demo strings no longer exist in client/src
test('STUDENT AUTH: Demo strings ("Demo login", "demoAuth", "__nxAuth", "backend not connected") no longer exist in client/src', () => {
  const allFiles = getAllFiles(clientSrcDir);
  const forbiddenPatterns = [
    /demo login/i,
    /demoauth/i,
    /__nxauth/i,
    /backend not connected/i
  ];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.strictEqual(
        pattern.test(content),
        false,
        `Forbidden pattern ${pattern} found in ${path.relative(clientSrcDir, file)}`
      );
    }
  }
});

// TEST 2: Routes in App.jsx
test('STUDENT AUTH: Routes /login, /signup, /forgot-password, /account exist, /reset-password does NOT exist, /admin/login still exists', () => {
  const appContent = fs.readFileSync(path.join(clientSrcDir, 'App.jsx'), 'utf8');

  assert.ok(appContent.includes('path="/login"'), 'Route /login must exist in App.jsx');
  assert.ok(appContent.includes('path="/signup"'), 'Route /signup must exist in App.jsx');
  assert.ok(appContent.includes('path="/forgot-password"'), 'Route /forgot-password must exist in App.jsx');
  assert.ok(appContent.includes('path="/account"'), 'Route /account must exist in App.jsx');

  assert.strictEqual(appContent.includes('path="/reset-password'), false, 'Route /reset-password must NOT exist');
  assert.ok(appContent.includes('path="/admin/login"'), 'Route /admin/login must still exist in App.jsx');
});

// TEST 3: No Admin link in SiteShell, MobileMenu, or PublicLayout footer
test('STUDENT AUTH: Zero "Admin" links or buttons in SiteShell, MobileMenu, or PublicLayout footer', () => {
  const siteShell = fs.readFileSync(path.join(clientSrcDir, 'components/SiteShell.jsx'), 'utf8');
  const mobileMenu = fs.readFileSync(path.join(clientSrcDir, 'components/MobileMenu.jsx'), 'utf8');
  const publicLayout = fs.readFileSync(path.join(clientSrcDir, 'components/PublicLayout.jsx'), 'utf8');

  // Check for any link or button containing Admin
  const adminLinkRegex = /<(?:Link|a|button)[^>]*>[\s\S]*?Admin[\s\S]*?<\/(?:Link|a|button)>/i;

  assert.strictEqual(adminLinkRegex.test(siteShell), false, 'SiteShell must not contain Admin link or button');
  assert.strictEqual(adminLinkRegex.test(mobileMenu), false, 'MobileMenu must not contain Admin link or button');
  assert.strictEqual(adminLinkRegex.test(publicLayout), false, 'PublicLayout footer must not contain Admin link or button');
});

// TEST 4: StudentAuthContext and api service endpoints exist
test('STUDENT AUTH: api.js exposes all required student auth methods & StudentAuthContext exists', () => {
  const apiContent = fs.readFileSync(path.join(clientSrcDir, 'services/api.js'), 'utf8');
  assert.ok(apiContent.includes('studentSignup'), 'api.js must export studentSignup');
  assert.ok(apiContent.includes('studentLogin'), 'api.js must export studentLogin');
  assert.ok(apiContent.includes('studentLogout'), 'api.js must export studentLogout');
  assert.ok(apiContent.includes('studentMe'), 'api.js must export studentMe');
  assert.ok(apiContent.includes('studentForgotPassword'), 'api.js must export studentForgotPassword');
  assert.ok(apiContent.includes('studentVerifyOtp'), 'api.js must export studentVerifyOtp');
  assert.ok(apiContent.includes('studentResetPassword'), 'api.js must export studentResetPassword');

  const contextPath = path.join(clientSrcDir, 'context/StudentAuthContext.jsx');
  assert.ok(fs.existsSync(contextPath), 'StudentAuthContext.jsx must exist');
});

console.log('\n------------------------------------------------------');
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
}
