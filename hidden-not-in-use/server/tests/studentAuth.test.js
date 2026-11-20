const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const Student = require('../src/models/Student');
const Admin = require('../src/models/Admin');
const studentAuthController = require('../src/controllers/studentAuthController');
const { requireStudent } = require('../src/middleware/studentAuth');
const { requireAuth } = require('../src/middleware/auth');
const { studentAuthLimiter, studentForgotLimiter, studentOtpLimiter } = require('../src/middleware/rateLimiter');

function mockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
    ip: options.ip || '127.0.0.1',
    app: {
      get: () => false
    },
    get(headerName) {
      return this.headers[headerName.toLowerCase()] || this.headers[headerName] || '';
    }
  };

  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};
  const resCookies = {};
  const clearedCookies = [];

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    setHeader(k, v) {
      resHeaders[k.toLowerCase()] = v;
      return this;
    },
    cookie(name, val, opts) {
      resCookies[name] = { val, opts };
      return this;
    },
    clearCookie(name, opts) {
      delete resCookies[name];
      clearedCookies.push(name);
      return this;
    }
  };

  let nextCalled = false;
  let nextError = null;
  const next = (err) => {
    nextCalled = true;
    if (err) nextError = err;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
    getCookies: () => resCookies,
    getClearedCookies: () => clearedCookies,
    wasNextCalled: () => nextCalled,
    getNextError: () => nextError
  };
}

async function runStudentAuthTests(test) {
  console.log('\n--- Running Student Auth Test Suite ---');

  await test('Student Auth: Signup success, sets student_token cookie, returns safe student payload', async () => {
    const mock = mockReqRes({
      body: {
        name: 'Aditya Test',
        email: 'student.test1@example.com',
        password: 'Password123'
      }
    });

    await studentAuthController.signup(mock.req, mock.res);

    assert.strictEqual(mock.getStatus(), 201, 'Signup returns 201');
    const data = mock.getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.student.name, 'Aditya Test');
    assert.strictEqual(data.student.email, 'student.test1@example.com');
    assert.strictEqual(data.student.passwordHash, undefined, 'passwordHash must never be returned');
    assert.strictEqual(data.student.resetOtpHash, undefined, 'resetOtpHash must never be returned');

    const cookies = mock.getCookies();
    assert.ok(cookies.student_token, 'student_token cookie must be set');
    assert.strictEqual(cookies.student_token.opts.httpOnly, true);
    assert.strictEqual(cookies.student_token.opts.sameSite, 'lax');

    // Verify token payload
    const decoded = jwt.verify(cookies.student_token.val, env.JWT_SECRET);
    assert.strictEqual(decoded.typ, 'student');
    assert.strictEqual(String(decoded.id), String(data.student.id));

    // Verify DB record
    const inDb = await Student.findById(data.student.id);
    assert.ok(inDb);
    assert.strictEqual(inDb.isActive, true);
    assert.strictEqual(inDb.email, 'student.test1@example.com');
  });

  await test('Student Auth: Duplicate email returns 409', async () => {
    const mock = mockReqRes({
      body: {
        name: 'Aditya Duplicate',
        email: 'student.test1@example.com',
        password: 'Password123'
      }
    });

    await studentAuthController.signup(mock.req, mock.res);
    assert.strictEqual(mock.getStatus(), 409);
    assert.strictEqual(mock.getData().message, 'An account with this email already exists.');
  });

  await test('Student Auth: Weak password and bad email are rejected with 400', async () => {
    // Bad email
    const mockEmail = mockReqRes({
      body: { name: 'Valid Name', email: 'not-an-email', password: 'Password123' }
    });
    await studentAuthController.signup(mockEmail.req, mockEmail.res);
    assert.strictEqual(mockEmail.getStatus(), 400);

    // Short password (<8)
    const mockShort = mockReqRes({
      body: { name: 'Valid Name', email: 'test.short@example.com', password: 'Pass1' }
    });
    await studentAuthController.signup(mockShort.req, mockShort.res);
    assert.strictEqual(mockShort.getStatus(), 400);

    // No number in password
    const mockNoNum = mockReqRes({
      body: { name: 'Valid Name', email: 'test.nonum@example.com', password: 'PasswordOnly' }
    });
    await studentAuthController.signup(mockNoNum.req, mockNoNum.res);
    assert.strictEqual(mockNoNum.getStatus(), 400);

    // No letter in password
    const mockNoLetter = mockReqRes({
      body: { name: 'Valid Name', email: 'test.noletter@example.com', password: '123456789' }
    });
    await studentAuthController.signup(mockNoLetter.req, mockNoLetter.res);
    assert.strictEqual(mockNoLetter.getStatus(), 400);
  });

  await test('Student Auth: Login success updates lastLoginAt and sets student_token cookie', async () => {
    const mock = mockReqRes({
      body: {
        email: 'student.test1@example.com',
        password: 'Password123'
      }
    });

    await studentAuthController.login(mock.req, mock.res);
    assert.strictEqual(mock.getStatus(), 200);
    const data = mock.getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.student.email, 'student.test1@example.com');
    assert.strictEqual(data.student.passwordHash, undefined);

    const cookies = mock.getCookies();
    assert.ok(cookies.student_token, 'Cookie set on login');

    const inDb = await Student.findOne({ email: 'student.test1@example.com' });
    assert.ok(inDb.lastLoginAt, 'lastLoginAt was updated');
  });

  await test('Student Auth: Wrong password and unknown email return identical generic failure message', async () => {
    // Wrong password
    const mockWrongPass = mockReqRes({
      body: { email: 'student.test1@example.com', password: 'WrongPassword99' }
    });
    await studentAuthController.login(mockWrongPass.req, mockWrongPass.res);
    assert.strictEqual(mockWrongPass.getStatus(), 401);
    assert.strictEqual(mockWrongPass.getData().message, 'Invalid email or password');

    // Unknown email
    const mockUnknownEmail = mockReqRes({
      body: { email: 'unknown.ghost@example.com', password: 'Password123' }
    });
    await studentAuthController.login(mockUnknownEmail.req, mockUnknownEmail.res);
    assert.strictEqual(mockUnknownEmail.getStatus(), 401);
    assert.strictEqual(mockUnknownEmail.getData().message, 'Invalid email or password');
  });

  await test('Student Auth: Inactive account is blocked with identical generic failure message', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    student.isActive = false;
    await student.save();

    const mock = mockReqRes({
      body: { email: 'student.test1@example.com', password: 'Password123' }
    });
    await studentAuthController.login(mock.req, mock.res);
    assert.strictEqual(mock.getStatus(), 401);
    assert.strictEqual(mock.getData().message, 'Invalid email or password');

    // Restore active
    student.isActive = true;
    await student.save();
  });

  await test('Student Auth: /me requires student auth, returns profile with cookie, 401 without cookie', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    const token = jwt.sign({ id: student._id, typ: 'student' }, env.JWT_SECRET, { expiresIn: '1d' });

    // With valid cookie
    const mockWithCookie = mockReqRes({
      cookies: { student_token: token }
    });
    await requireStudent(mockWithCookie.req, mockWithCookie.res, mockWithCookie.next);
    assert.strictEqual(mockWithCookie.wasNextCalled(), true, 'requireStudent calls next on valid session');
    assert.ok(mockWithCookie.req.student, 'req.student is populated');

    await studentAuthController.me(mockWithCookie.req, mockWithCookie.res);
    assert.strictEqual(mockWithCookie.getStatus(), 200);
    assert.strictEqual(mockWithCookie.getData().student.email, 'student.test1@example.com');
    assert.strictEqual(mockWithCookie.getData().student.passwordHash, undefined);

    // Without cookie
    const mockNoCookie = mockReqRes({});
    await requireStudent(mockNoCookie.req, mockNoCookie.res, mockNoCookie.next);
    assert.strictEqual(mockNoCookie.wasNextCalled(), false);
    assert.strictEqual(mockNoCookie.getStatus(), 401);
  });

  await test('Student Auth: Logout clears student_token cookie', async () => {
    const mock = mockReqRes({
      cookies: { student_token: 'some-token' }
    });
    await studentAuthController.logout(mock.req, mock.res);
    assert.strictEqual(mock.getStatus(), 200);
    assert.ok(mock.getClearedCookies().includes('student_token'));
  });

  await test('Student Auth: forgot-password returns identical neutral response for known and unknown email with no OTP leaked', async () => {
    const neutral = 'If an account exists for this email, an OTP has been sent.';

    // Known email
    const mockKnown = mockReqRes({
      body: { email: 'student.test1@example.com' }
    });
    await studentAuthController.forgotPassword(mockKnown.req, mockKnown.res);
    assert.strictEqual(mockKnown.getStatus(), 200);
    assert.strictEqual(mockKnown.getData().message, neutral);
    assert.strictEqual(mockKnown.getData().otp, undefined, 'OTP must NEVER be in response');

    // Verify DB state for known email
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    assert.ok(student.resetOtpHash, 'resetOtpHash must be stored');
    assert.strictEqual(student.resetOtpHash.length, 64, 'HMAC-SHA256 is 64 hex characters');
    assert.ok(student.resetOtpExpiresAt > new Date());
    assert.strictEqual(student.resetOtpAttempts, 0);

    // Unknown email
    const mockUnknown = mockReqRes({
      body: { email: 'nonexistent.student@example.com' }
    });
    await studentAuthController.forgotPassword(mockUnknown.req, mockUnknown.res);
    assert.strictEqual(mockUnknown.getStatus(), 200);
    assert.strictEqual(mockUnknown.getData().message, neutral);
    assert.strictEqual(mockUnknown.getData().otp, undefined);
  });

  await test('Student Auth: 60-second cooldown suppresses regenerating/resending OTP', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    const initialHash = student.resetOtpHash;
    const initialSentAt = student.resetOtpSentAt;

    // Send again immediately (< 60s)
    const mockCooldown = mockReqRes({
      body: { email: 'student.test1@example.com' }
    });
    await studentAuthController.forgotPassword(mockCooldown.req, mockCooldown.res);
    assert.strictEqual(mockCooldown.getStatus(), 200);

    const afterStudent = await Student.findOne({ email: 'student.test1@example.com' });
    assert.strictEqual(afterStudent.resetOtpHash, initialHash, 'Hash must not change during cooldown');
    assert.strictEqual(afterStudent.resetOtpSentAt.getTime(), initialSentAt.getTime(), 'SentAt must not change during cooldown');
  });

  await test('Student Auth: A new OTP invalidates the old one after cooldown passes', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    // Simulate cooldown expired
    student.resetOtpSentAt = new Date(Date.now() - 65000);
    await student.save();

    const oldHash = student.resetOtpHash;

    const mock = mockReqRes({
      body: { email: 'student.test1@example.com' }
    });
    await studentAuthController.forgotPassword(mock.req, mock.res);

    const refreshedStudent = await Student.findOne({ email: 'student.test1@example.com' });
    assert.notStrictEqual(refreshedStudent.resetOtpHash, oldHash, 'New OTP generates new hash');
  });

  await test('Student Auth: verify-otp validates without consuming, rejects wrong/expired', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    // Manually set a known OTP hash for testing
    const testOtp = '123456';
    const hash = crypto.createHmac('sha256', env.JWT_SECRET).update(`${student._id}:${testOtp}`).digest('hex');
    student.resetOtpHash = hash;
    student.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    student.resetOtpAttempts = 0;
    await student.save();

    // Wrong OTP
    const mockWrong = mockReqRes({
      body: { email: 'student.test1@example.com', otp: '999999' }
    });
    await studentAuthController.verifyOtp(mockWrong.req, mockWrong.res);
    assert.strictEqual(mockWrong.getStatus(), 400);
    assert.strictEqual(mockWrong.getData().message, 'Invalid or expired OTP.');

    const afterWrong = await Student.findById(student._id);
    assert.strictEqual(afterWrong.resetOtpAttempts, 1, 'Attempt incremented on wrong OTP');

    // Right OTP
    const mockRight = mockReqRes({
      body: { email: 'student.test1@example.com', otp: '123456' }
    });
    await studentAuthController.verifyOtp(mockRight.req, mockRight.res);
    assert.strictEqual(mockRight.getStatus(), 200);
    assert.strictEqual(mockRight.getData().success, true);

    // Verify OTP was NOT consumed
    const afterRight = await Student.findById(student._id);
    assert.ok(afterRight.resetOtpHash, 'Hash still present (not consumed)');

    // Expired OTP
    afterRight.resetOtpExpiresAt = new Date(Date.now() - 1000);
    await afterRight.save();

    const mockExpired = mockReqRes({
      body: { email: 'student.test1@example.com', otp: '123456' }
    });
    await studentAuthController.verifyOtp(mockExpired.req, mockExpired.res);
    assert.strictEqual(mockExpired.getStatus(), 400);
    assert.strictEqual(mockExpired.getData().message, 'Invalid or expired OTP.');
  });

  await test('Student Auth: 5 wrong OTP attempts invalidates the OTP completely', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    const testOtp = '654321';
    const hash = crypto.createHmac('sha256', env.JWT_SECRET).update(`${student._id}:${testOtp}`).digest('hex');
    student.resetOtpHash = hash;
    student.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    student.resetOtpAttempts = 4; // 1 attempt away from limit
    await student.save();

    // 5th wrong attempt
    const mock5th = mockReqRes({
      body: { email: 'student.test1@example.com', otp: '000000' }
    });
    await studentAuthController.verifyOtp(mock5th.req, mock5th.res);
    assert.strictEqual(mock5th.getStatus(), 400);
    assert.strictEqual(mock5th.getData().message, 'Too many wrong attempts. Please request a new OTP.');

    // DB record invalidated
    const lockedStudent = await Student.findById(student._id);
    assert.strictEqual(lockedStudent.resetOtpHash, undefined, 'resetOtpHash invalidated after 5 attempts');

    // Even right OTP now fails
    const mockTryRight = mockReqRes({
      body: { email: 'student.test1@example.com', otp: testOtp }
    });
    await studentAuthController.verifyOtp(mockTryRight.req, mockTryRight.res);
    assert.strictEqual(mockTryRight.getStatus(), 400);
  });

  await test('Student Auth: reset-password succeeds, old password stops working, new password works, OTP is single-use, clears cookie', async () => {
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    const testOtp = '888888';
    const hash = crypto.createHmac('sha256', env.JWT_SECRET).update(`${student._id}:${testOtp}`).digest('hex');
    student.resetOtpHash = hash;
    student.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    student.resetOtpAttempts = 0;
    await student.save();

    const mockReset = mockReqRes({
      body: {
        email: 'student.test1@example.com',
        otp: '888888',
        password: 'NewBrandPassword2026'
      }
    });

    await studentAuthController.resetPassword(mockReset.req, mockReset.res);
    assert.strictEqual(mockReset.getStatus(), 200);
    assert.strictEqual(mockReset.getData().success, true);
    assert.ok(mockReset.getClearedCookies().includes('student_token'), 'Cookie cleared on reset');

    // Old password fails
    const mockOldLogin = mockReqRes({
      body: { email: 'student.test1@example.com', password: 'Password123' }
    });
    await studentAuthController.login(mockOldLogin.req, mockOldLogin.res);
    assert.strictEqual(mockOldLogin.getStatus(), 401);

    // New password succeeds
    const mockNewLogin = mockReqRes({
      body: { email: 'student.test1@example.com', password: 'NewBrandPassword2026' }
    });
    await studentAuthController.login(mockNewLogin.req, mockNewLogin.res);
    assert.strictEqual(mockNewLogin.getStatus(), 200);

    // Single-use: OTP cannot be reused
    const mockReuse = mockReqRes({
      body: {
        email: 'student.test1@example.com',
        otp: '888888',
        password: 'AnotherPassword999'
      }
    });
    await studentAuthController.resetPassword(mockReuse.req, mockReuse.res);
    assert.strictEqual(mockReuse.getStatus(), 400);
  });

  await test('Student Auth Session Separation: student token rejected by admin auth, admin token rejected by student auth', async () => {
    // 1. Create a student token
    const student = await Student.findOne({ email: 'student.test1@example.com' });
    const studentToken = jwt.sign({ id: student._id, typ: 'student' }, env.JWT_SECRET, { expiresIn: '1d' });

    // Try opening admin requireAuth with student token
    const mockAdminAuth = mockReqRes({
      cookies: { token: studentToken }
    });
    await requireAuth(mockAdminAuth.req, mockAdminAuth.res, mockAdminAuth.next);
    assert.strictEqual(mockAdminAuth.wasNextCalled(), false, 'Student token must NOT pass admin requireAuth');
    assert.strictEqual(mockAdminAuth.getStatus(), 401);

    // 2. Create an admin token
    const admin = await Admin.findOne();
    const adminToken = jwt.sign({ id: admin._id, email: admin.email, role: admin.role }, env.JWT_SECRET, { expiresIn: '1d' });

    // Try opening requireStudent with admin token (even if put into student_token cookie)
    const mockStudentAuth = mockReqRes({
      cookies: { student_token: adminToken }
    });
    await requireStudent(mockStudentAuth.req, mockStudentAuth.res, mockStudentAuth.next);
    assert.strictEqual(mockStudentAuth.wasNextCalled(), false, 'Admin token must NOT pass requireStudent');
    assert.strictEqual(mockStudentAuth.getStatus(), 401);
  });

  await test('Student Auth Rate Limiters: Limiters exist and trigger 429 when max threshold reached', async () => {
    assert.ok(studentAuthLimiter, 'studentAuthLimiter is exported');
    assert.ok(studentForgotLimiter, 'studentForgotLimiter is exported');
    assert.ok(studentOtpLimiter, 'studentOtpLimiter is exported');

    let hit429 = false;
    for (let i = 0; i < 7; i++) {
      let code = 200;
      const req = { ip: '198.51.100.42', headers: {}, app: { get: () => false } };
      await new Promise((resolve) => {
        const res = {
          status: (c) => { code = c; return res; },
          send: () => resolve(),
          json: () => resolve(),
          setHeader: () => {}
        };
        studentForgotLimiter(req, res, () => resolve());
      });
      if (code === 429) {
        hit429 = true;
        break;
      }
    }
    assert.strictEqual(hit429, true, 'studentForgotLimiter must return 429 after 5 requests');
  });

  console.log('--- Student Auth Test Suite Complete ---\n');
}

module.exports = runStudentAuthTests;
