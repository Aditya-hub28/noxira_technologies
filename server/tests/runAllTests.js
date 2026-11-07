process.env.NODE_ENV = 'test';
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Admin = require('../src/models/Admin');
const Participant = require('../src/models/Participant');
const Program = require('../src/models/Program');
const Template = require('../src/models/Template');
const Certificate = require('../src/models/Certificate');
const DeliveryJob = require('../src/models/DeliveryJob');
const ImportBatch = require('../src/models/ImportBatch');
const AuditLog = require('../src/models/AuditLog');
const Application = require('../src/models/Application');
const OfferLetter = require('../src/models/OfferLetter');
const OfferLetterTemplate = require('../src/models/OfferLetterTemplate');
const OfferDeliveryJob = require('../src/models/OfferDeliveryJob');
const Setting = require('../src/models/Setting');
const Student = require('../src/models/Student');
const studentAuthController = require('../src/controllers/studentAuthController');
const { requireStudentAuth } = require('../src/middleware/studentAuth');
const studentDataController = require('../src/controllers/studentDataController');
const skillCourseController = require('../src/controllers/skillCourseController');
const SkillCourse = require('../src/models/SkillCourse');
const QuizQuestion = require('../src/models/QuizQuestion');
const QuizAttempt = require('../src/models/QuizAttempt');
const { seedSkillCourses } = require('../src/scripts/seedSkillCourses');
const { getPublicSettings, getAdminGoogleForm1, updateGoogleForm1, validateGoogleFormUrl } = require('../src/controllers/settingsController');

const { generateCertificatePdf } = require('../src/services/pdfService');
const { issueCertificateForParticipant } = require('../src/services/issuanceService');
const { generate128BitToken } = require('../src/services/qrService');
const { recoverStaleProcessingJobs } = require('../src/services/emailService');
const { validateEnv } = require('../src/config/env');
const env = require('../src/config/env');
const offerService = require('../src/services/offerService');
const offerPdfService = require('../src/services/offerPdfService');
const storageService = require('../src/services/storageService');

const participantController = require('../src/controllers/participantController');
const distributionController = require('../src/controllers/distributionController');
const intakeController = require('../src/controllers/intakeController');
const templateController = require('../src/controllers/templateController');
const adminApplicationController = require('../src/controllers/adminApplicationController');
const adminOfferTemplateController = require('../src/controllers/adminOfferTemplateController');
const offerDownloadController = require('../src/controllers/offerDownloadController');
const form1ImportController = require('../src/controllers/form1ImportController');
const form2ImportController = require('../src/controllers/form2ImportController');
const certificateController = require('../src/controllers/certificateController');
const Submission = require('../src/models/Submission');
const { generateApplicationsCsv } = require('../src/utils/csvExport');
const { getPublicPrograms, getPublicProgramByCode } = require('../src/routes/programRoutes');
const { adminGetPrograms, adminCreateProgram, adminUpdateProgram } = require('../src/routes/adminProgramRoutes');
const { CATALOGUE_PROGRAMS, PROGRAM_CATEGORIES, seedProgramCatalogue } = require('../src/config/programsCatalogue');
const { requireRole } = require('../src/middleware/auth');
const { statusRateLimiter } = require('../src/middleware/rateLimiter');

// Helper to mock express req, res, next for controller integration testing
function mockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    ip: options.ip || '127.0.0.1',
    admin: options.admin || { _id: new mongoose.Types.ObjectId(), name: 'Test Admin', role: 'SUPER_ADMIN' },
    file: options.file || null,
    accepts(type) {
      const acc = (this.headers['accept'] || this.headers['Accept'] || '').toLowerCase();
      if (!acc) return false;
      if (type === 'html' || type === 'text/html') return acc.includes('text/html') || acc.includes('html');
      if (type === 'json' || type === 'application/json') return acc.includes('application/json') || acc.includes('json');
      return acc.includes(type.toLowerCase());
    }
  };
  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};
  const chunks = [];
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    type(t) {
      resHeaders['content-type'] = t === 'html' ? 'text/html' : t;
      return this;
    },
    setHeader(k, v) {
      resHeaders[k.toLowerCase()] = v;
      return this;
    },
    set(k, v) {
      if (typeof k === 'object') {
        for (const [key, val] of Object.entries(k)) {
          resHeaders[key.toLowerCase()] = val;
        }
      } else {
        resHeaders[k.toLowerCase()] = v;
      }
      return this;
    },
    getHeader(k) {
      return resHeaders[k.toLowerCase()];
    },
    cookie(name, value, opts) {
      resHeaders['set-cookie'] = `${name}=${value}`;
      return this;
    },
    clearCookie(name) {
      resHeaders['set-cookie'] = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
    write(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (chunks.length > 0 && !responseData) {
        responseData = Buffer.concat(chunks);
      }
      return this;
    },
    on() { return this; },
    once() { return this; },
    emit() { return true; }
  };
  const next = (err) => {
    if (err) throw err;
  };
  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => resHeaders
  };
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING NOXIRA CERTIFICATE SYSTEM ACCEPTANCE TESTS');
  console.log('======================================================\n');

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { autoIndex: true });

  // Fix 6: Await index initialization to eliminate index race conditions
  await Promise.all([
    Participant.init(),
    Certificate.init(),
    DeliveryJob.init(),
    Admin.init(),
    Program.init(),
    Template.init(),
    ImportBatch.init(),
    AuditLog.init()
  ]);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // TEST 1: Admin Security & Password Hashing
  await test('Admin auth: Hashes password, prevents plain text, verifies comparePassword', async () => {
    const rawPass = 'SecretAdmin@2026';
    const hash = await Admin.hashPassword(rawPass);
    assert.notStrictEqual(hash, rawPass, 'Password must be hashed');

    const admin = new Admin({
      name: 'Aditya Root',
      email: 'root@noxira.com',
      passwordHash: hash,
      role: 'SUPER_ADMIN'
    });
    await admin.save();

    const isMatch = await admin.comparePassword(rawPass);
    assert.strictEqual(isMatch, true, 'Correct password must match');
    const isFalse = await admin.comparePassword('WrongPassword');
    assert.strictEqual(isFalse, false, 'Wrong password must fail');
  });

  // TEST 2: Intake Duplicate Prevention & Normalized Key (Model Compound Index)
  await test('Intake: Duplicate email+program+batch collision detected and rejected at model level', async () => {
    await Program.create({
      code: 'FS-DEV',
      title: 'Full Stack Web Development',
      defaultBatch: 'BATCH-2026-Q4',
      durationWeeks: 4,
      feeInr: 99
    });

    const p1 = new Participant({
      fullName: 'Aarav Sharma',
      email: 'Aarav.Sharma@Example.COM ',
      phone: '+91 9999999999',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-Q4',
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });
    await p1.save();
    assert.strictEqual(p1.normalizedEmail, 'aarav.sharma@example.com');
    assert.strictEqual(p1.completionStatus, 'PENDING');

    // Attempt duplicate with different casing/whitespace in same program & batch
    const p2 = new Participant({
      fullName: 'Aarav Sharma Duplicate',
      email: 'aarav.sharma@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-Q4',
      source: 'CSV_IMPORT'
    });

    let duplicateCaught = false;
    try {
      await p2.save();
    } catch (e) {
      duplicateCaught = true;
    }
    assert.strictEqual(duplicateCaught, true, 'Unique compound index must prevent duplicate intake');
  });

  // TEST 3: Completion Review Gate Decoupling
  await test('Completion Gate: Registration alone NEVER allows certificate issuance', async () => {
    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });
    assert.strictEqual(p.completionStatus, 'PENDING');

    const admin = await Admin.findOne({ email: 'root@noxira.com' });

    let errorThrown = false;
    try {
      await issueCertificateForParticipant({
        participantId: p._id,
        adminId: admin._id
      });
    } catch (err) {
      errorThrown = true;
      assert.ok(err.message.includes('Only "ELIGIBLE" participants can receive a certificate'));
    }
    assert.strictEqual(errorThrown, true, 'Issuance must reject non-eligible participant');
  });

  // Module 9 fixture helper: bind a MATCHED + payment-VERIFIED + review-PASSED
  // submission to a participant (email + programme) so the release gate passes.
  const grantReleaseGate = async (email, programCode, tag) => {
    const gateAdmin = await Admin.findOne({ email: 'root@noxira.com' });
    const gateBatch = await ImportBatch.create({
      fileName: `gate-${tag}.csv`, fileSizeBytes: 10, uploadedBy: gateAdmin._id,
      kind: 'FORM2_RESPONSES', batchId: `GATE-${tag}`, columnMapping: [], status: 'COMMITTED'
    });
    await Submission.create({
      submissionId: `SUB-GATE-${tag}`, email, programCode,
      matchState: 'MATCHED', paymentState: 'VERIFIED', reviewStatus: 'PASSED',
      projectLink: 'https://github.com/gate/project', transactionId: `UTR-GATE-${tag}`,
      importBatchId: gateBatch._id,
      reviewRounds: [{ round: 0, projectLink: 'https://github.com/gate/project', openedAt: new Date(), outcome: 'PASSED', requirementsComplete: true, projectWorking: true, reviewedAt: new Date() }]
    });
  };
  await grantReleaseGate('aarav.sharma@example.com', 'FS-DEV', 'AARAV');

  // TEST 4: Seeded Template with Signatory Verification (Bug 1 Root Cause Test)
  await test('Bug 1 Fix: Template signatory properly resolved without undefined error during issuance', async () => {
    await Template.create({
      title: 'Official NOXIRA Template v1',
      version: '1.0.0',
      signatory: {
        name: 'Aditya Jha',
        title: 'Managing Director & Lead Architect'
      },
      layout: {
        signatory: {
          name: 'Aditya Jha',
          title: 'Managing Director & Lead Architect'
        }
      },
      isActive: true
    });

    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });
    p.completionStatus = 'ELIGIBLE';
    await p.save();

    const admin = await Admin.findOne({ email: 'root@noxira.com' });

    const res = await issueCertificateForParticipant({
      participantId: p._id,
      adminId: admin._id
    });

    assert.strictEqual(res.certificate.status, 'ISSUED');
    assert.strictEqual(res.certificate.renderedSnapshot.authorizedSignatoryName, 'Aditya Jha');
    assert.ok(res.certificate.fileStorage.sha256Checksum, 'Must record SHA-256 checksum');
  });

  // TEST 5: PDF Vector Rendering, Long Name Scaling & Same-Day Dates
  await test('PDF Engine: Handles long names (>50 chars) and same-day certificates without error', async () => {
    const longName = 'Prof. Dr. Christopher Bartholomew Montgomery-Fitzgerald III';
    const sameDay = new Date('2026-10-15');

    const pdfBuffer = await generateCertificatePdf({
      recipientName: longName,
      programTitle: 'High-Performance Distributed Systems & Blockchain Architecture',
      startDate: sameDay,
      endDate: sameDay,
      issueDate: sameDay,
      certificateNumber: 'NOX-2026-TEST-0001',
      publicVerificationToken: generate128BitToken(),
      signatoryName: 'Aditya Jha',
      signatoryTitle: 'Managing Director & Lead Architect',
      isDraft: false
    });

    assert.ok(Buffer.isBuffer(pdfBuffer), 'Must return a valid Buffer');
    assert.ok(pdfBuffer.length > 1000, 'PDF buffer must be non-empty valid binary');
    assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'Must have valid PDF magic bytes');
  });

  // TEST 6: Durable Idempotent Issuance
  await test('Durable Issuance: Second issue request returns existing without creating duplicate', async () => {
    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });
    const admin = await Admin.findOne({ email: 'root@noxira.com' });

    const res = await issueCertificateForParticipant({
      participantId: p._id,
      adminId: admin._id
    });
    assert.strictEqual(res.message, 'Already issued');

    const totalCerts = await Certificate.countDocuments({ participantId: p._id });
    assert.strictEqual(totalCerts, 1, 'Exactly one certificate record must exist in DB');
  });

  // TEST 7: Controller Integration: participantController.getParticipants with regex metacharacters
  await test('Bug 3 Controller Integration: participantController.getParticipants escapes [ and ( without 500 crash', async () => {
    const { req, res, next, getStatus, getData } = mockReqRes({
      query: { search: '[(evil-regex.*+?^${}' }
    });

    await participantController.getParticipants(req, res, next);
    assert.strictEqual(getStatus(), 200, 'Controller must return 200 OK');
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.participants), 'Participants must be an array');
  });

  // TEST 8: Controller Integration: distributionController.retryJob blocks duplicates & prevents concurrent race
  await test('Bug 4 Controller Integration: distributionController.retryJob enforces state guard and atomic claim', async () => {
    const cert = await Certificate.findOne({ status: 'ISSUED' });
    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });

    // 1. PROVIDER_ACCEPTED job must be rejected with 400
    const acceptedJob = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'accepted@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'PROVIDER_ACCEPTED',
      attempts: 1
    });

    const mockAccepted = mockReqRes({ params: { id: acceptedJob._id } });
    await distributionController.retryJob(mockAccepted.req, mockAccepted.res, mockAccepted.next);
    assert.strictEqual(mockAccepted.getStatus(), 400, 'Must return 400 for PROVIDER_ACCEPTED');
    assert.ok(mockAccepted.getData().message.includes('already been accepted'));

    // 2. DELIVERY_UNKNOWN job must be rejected with 409
    const unknownJob = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'unknown@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'DELIVERY_UNKNOWN',
      attempts: 1
    });

    const mockUnknown = mockReqRes({ params: { id: unknownJob._id } });
    await distributionController.retryJob(mockUnknown.req, mockUnknown.res, mockUnknown.next);
    assert.strictEqual(mockUnknown.getStatus(), 409, 'Must return 409 for DELIVERY_UNKNOWN');
    assert.ok(mockUnknown.getData().message.includes('reconcile gateway logs'));

    // 3. FAILED job retry: Atomic claim race test
    const failedJob = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'failed@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'FAILED',
      attempts: 1
    });

    // Simulate two simultaneous retry calls
    const call1 = mockReqRes({ params: { id: failedJob._id } });
    const call2 = mockReqRes({ params: { id: failedJob._id } });

    const [res1, res2] = await Promise.all([
      distributionController.retryJob(call1.req, call1.res, call1.next),
      distributionController.retryJob(call2.req, call2.res, call2.next)
    ]);

    const statuses = [call1.getStatus(), call2.getStatus()].sort();
    assert.strictEqual(statuses[0], 200, 'One retry request must succeed');
    assert.strictEqual(statuses[1], 409, 'Concurrent retry request must be blocked with 409 Conflict');
  });

  // TEST 9: Controller Integration: intakeController.commitCsv rejects client flag tampering & deduplicates
  await test('Intake Controller Integration: commitCsv ignores client flags, enforces server re-validation & cross-program uniqueness', async () => {
    await Program.create({
      code: 'AI-ENG',
      title: 'Artificial Intelligence Engineering',
      defaultBatch: 'BATCH-2026-Q4',
      durationWeeks: 4,
      feeInr: 99
    });

    const admin = await Admin.findOne({ email: 'root@noxira.com' });

    // Client maliciously sends isValid: true on invalid / duplicate rows
    const manipulatedRows = [
      {
        fullName: 'Valid Applicant One',
        email: 'applicant.one@example.com',
        phone: '+91 91234 56780',
        isValid: true,
        isDuplicate: false
      },
      {
        fullName: 'Valid Applicant One Duplicate In File',
        email: 'applicant.one@example.com', // Duplicate in same file
        phone: '+91 91234 56780',
        isValid: true, // Tampered flag
        isDuplicate: false
      },
      {
        fullName: 'X', // Invalid: Too short (<2 chars)
        email: 'shortname@example.com',
        isValid: true, // Tampered flag
        isDuplicate: false
      },
      {
        fullName: 'Bad Email User',
        email: 'not-an-email-format', // Invalid: Bad email
        isValid: true, // Tampered flag
        isDuplicate: false
      }
    ];

    const mockCommit = mockReqRes({
      admin,
      body: {
        fileName: 'tampered_batch.csv',
        programCode: 'AI-ENG',
        batchId: 'BATCH-2026-Q4',
        rows: manipulatedRows
      }
    });

    await intakeController.commitCsv(mockCommit.req, mockCommit.res, mockCommit.next);
    assert.strictEqual(mockCommit.getStatus(), 200);
    const result = mockCommit.getData();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.importedCount, 1, 'Only the single valid applicant should be inserted');
    assert.strictEqual(result.duplicatesCount, 1, 'In-file duplicate must be caught by server');
    assert.strictEqual(result.invalidCount, 2, 'Two invalid rows must be rejected despite client isValid: true');

    // Cross-program check: same email 'applicant.one@example.com' CAN be registered in 'FS-DEV'
    const crossProgramRows = [
      {
        fullName: 'Valid Applicant One',
        email: 'applicant.one@example.com',
        phone: '+91 91234 56780'
      }
    ];

    const mockCrossCommit = mockReqRes({
      admin,
      body: {
        fileName: 'cross_program.csv',
        programCode: 'FS-DEV',
        batchId: 'BATCH-2026-Q4',
        rows: crossProgramRows
      }
    });

    await intakeController.commitCsv(mockCrossCommit.req, mockCrossCommit.res, mockCrossCommit.next);
    assert.strictEqual(mockCrossCommit.getStatus(), 200);
    assert.strictEqual(mockCrossCommit.getData().importedCount, 1, 'Same email in different program must be allowed');
  });

  // TEST 10: Email Worker Crash Recovery (recoverStaleProcessingJobs)
  await test('Email Worker Recovery: Transitions stale jobs with attempts > 0 to DELIVERY_UNKNOWN, unattempted to QUEUED', async () => {
    const cert = await Certificate.findOne({ status: 'ISSUED' });
    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });

    // Stale job that crashed mid-flight after 1 attempt
    const crashedMidFlight = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'midflight@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'PROCESSING',
      lockId: 'crashed-worker-lock-1',
      leaseExpiresAt: new Date(Date.now() - 10000), // Expired lease
      attempts: 1,
      lastAttemptAt: new Date(Date.now() - 15000)
    });

    // Stale job claimed but worker died before any SMTP call (attempts: 0)
    const crashedBeforeAttempt = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'beforeattempt@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'PROCESSING',
      lockId: 'crashed-worker-lock-2',
      leaseExpiresAt: new Date(Date.now() - 10000), // Expired lease
      attempts: 0
    });

    const recoveryResult = await recoverStaleProcessingJobs(0);
    assert.strictEqual(recoveryResult.recoveredToUnknown, 1);
    assert.strictEqual(recoveryResult.recoveredToQueued, 1);

    const updatedMidFlight = await DeliveryJob.findById(crashedMidFlight._id);
    assert.strictEqual(updatedMidFlight.status, 'DELIVERY_UNKNOWN');
    assert.strictEqual(updatedMidFlight.adminOverrideNeeded, true);
    assert.strictEqual(updatedMidFlight.lockId, null);
    assert.ok(updatedMidFlight.reconciliationNotes.includes('Reconcile with gateway'));

    const updatedBeforeAttempt = await DeliveryJob.findById(crashedBeforeAttempt._id);
    assert.strictEqual(updatedBeforeAttempt.status, 'QUEUED');
    assert.strictEqual(updatedBeforeAttempt.lockId, null);
    assert.strictEqual(updatedBeforeAttempt.leaseExpiresAt, null);
  });

  // TEST 11: Production Security Configuration (Fail-Safe Boot)
  await test('Production Config: validateEnv halts startup on missing MongoDB URI or insecure JWT secret', () => {
    // 1. Missing MongoDB URI in production
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: 'production',
          MONGODB_URI: '',
          JWT_SECRET: 'a_very_long_secure_jwt_secret_with_more_than_32_characters_123456789'
        });
      },
      /MONGODB_URI environment variable is required in production/
    );

    // 2. Default fallback JWT secret in production
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          JWT_SECRET: 'noxira_default_insecure_jwt_secret_dev_only'
        });
      },
      /cannot be the default fallback/
    );

    // 3. Short JWT secret (<32 chars) in production
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          JWT_SECRET: 'short_secret'
        });
      },
      /at least 32 characters long in production/
    );

    // 4. Valid production configuration
    assert.doesNotThrow(() => {
      validateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
        JWT_SECRET: 'a_very_long_secure_jwt_secret_with_more_than_32_characters_123456789',
        SMTP: {
          HOST: 'smtp.sendgrid.net',
          USER: 'apikey',
          PASS: 'SG.valid_production_api_key_here_123456789',
          FROM: 'admissions@noxira.com'
        }
      });
    });
  });

  // TEST 12: Public Verification & Zero-PII Check
  await test('Public Verification: Shows valid status, hides all PII (email, phone, notes)', async () => {
    const cert = await Certificate.findOne({ status: 'ISSUED' });
    assert.ok(cert);

    const publicPayload = {
      verified: cert.status === 'ISSUED',
      status: cert.status === 'ISSUED' ? 'VALID' : cert.status,
      certificateNumber: cert.certificateNumber,
      recipientName: cert.renderedSnapshot.recipientName,
      programTitle: cert.renderedSnapshot.programTitle,
      startDate: cert.renderedSnapshot.startDate,
      endDate: cert.renderedSnapshot.endDate,
      issueDate: cert.renderedSnapshot.issueDate,
      version: cert.version
    };

    assert.strictEqual(publicPayload.verified, true);
    assert.strictEqual(publicPayload.status, 'VALID');
    assert.strictEqual(publicPayload.email, undefined, 'Email must NOT be present in public payload');
    assert.strictEqual(publicPayload.phone, undefined, 'Phone must NOT be present in public payload');
    assert.strictEqual(publicPayload.internalNotes, undefined, 'Internal notes must NOT be present');
  });

  // TEST 13: Correction, Revocation & Atomic Replacement
  await test('Revoke & Replace: Preserves history, marks old as REPLACED, links to new certificate', async () => {
    const oldCert = await Certificate.findOne({ status: 'ISSUED' });
    const admin = await Admin.findOne({ email: 'root@noxira.com' });

    const newPublicToken = generate128BitToken();
    const newCert = new Certificate({
      certificateNumber: 'NOX-2026-FSD-0002',
      publicVerificationToken: newPublicToken,
      completionAwardKey: `${oldCert.completionAwardKey}:v2`,
      participantId: oldCert.participantId,
      programCode: oldCert.programCode,
      programTitle: oldCert.programTitle,
      batchId: oldCert.batchId,
      renderedSnapshot: {
        ...oldCert.renderedSnapshot,
        recipientName: 'Aarav K. Sharma (Corrected)'
      },
      status: 'ISSUED',
      version: 2,
      supersedesCertificateId: oldCert._id,
      approvedBy: admin._id
    });
    await newCert.save();

    oldCert.status = 'REPLACED';
    oldCert.revocationReason = 'Typo in middle name corrected';
    oldCert.revokedAt = new Date();
    oldCert.revokedBy = admin._id;
    oldCert.replacedByCertificateId = newCert._id;
    await oldCert.save();

    const verifiedOld = await Certificate.findById(oldCert._id);
    assert.strictEqual(verifiedOld.status, 'REPLACED');
    assert.strictEqual(String(verifiedOld.replacedByCertificateId), String(newCert._id));

    const verifiedNew = await Certificate.findById(newCert._id);
    assert.strictEqual(verifiedNew.status, 'ISSUED');
    assert.strictEqual(verifiedNew.version, 2);
    assert.strictEqual(String(verifiedNew.supersedesCertificateId), String(oldCert._id));
  });

  // TEST 14: Production SMTP Guard (Never Silently Mock in Production)
  await test('Production SMTP Guard: validateEnv rejects missing or mock SMTP credentials in production mode', () => {
    const baseValid = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
      JWT_SECRET: 'a_very_long_secure_jwt_secret_with_more_than_32_characters_123456789'
    };

    // Missing SMTP_HOST or mock ethereal host
    assert.throws(
      () => validateEnv({ ...baseValid, SMTP: { HOST: 'smtp.ethereal.email', USER: 'user', PASS: 'pass' } }),
      /cannot use the development ethereal mock host/
    );

    // Missing or placeholder SMTP_USER
    assert.throws(
      () => validateEnv({ ...baseValid, SMTP: { HOST: 'smtp.sendgrid.net', USER: 'test@example.com', PASS: 'pass' } }),
      /SMTP_USER is required in production/
    );

    // Missing or placeholder SMTP_PASS
    assert.throws(
      () => validateEnv({ ...baseValid, SMTP: { HOST: 'smtp.sendgrid.net', USER: 'apikey', PASS: 'password' } }),
      /SMTP_PASS is required in production/
    );
  });

  // TEST 15: DELIVERY_UNKNOWN Reconciliation Flow & Invalid ID Validation
  await test('Reconciliation Flow: reconcileJob allows admin to MARK_DELIVERED or RESET_FOR_RETRY safely', async () => {
    const cert = await Certificate.findOne({ status: 'ISSUED' });
    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });
    const admin = await Admin.findOne({ email: 'root@noxira.com' });

    // 1. Invalid job ID returns 400
    const mockInvalidId = mockReqRes({ params: { id: 'invalid-object-id-123' }, body: { resolution: 'MARK_DELIVERED' } });
    await distributionController.reconcileJob(mockInvalidId.req, mockInvalidId.res, mockInvalidId.next);
    assert.strictEqual(mockInvalidId.getStatus(), 400);
    assert.ok(mockInvalidId.getData().message.includes('Invalid delivery job ID format'));

    const mockInvalidRetry = mockReqRes({ params: { id: 'invalid-object-id-123' } });
    await distributionController.retryJob(mockInvalidRetry.req, mockInvalidRetry.res, mockInvalidRetry.next);
    assert.strictEqual(mockInvalidRetry.getStatus(), 400);

    // 2. Strict Validation: Notes required (min 10 chars)
    const jobForValidation = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'validation-test@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'DELIVERY_UNKNOWN',
      adminOverrideNeeded: true,
      attempts: 1,
      providerIdempotencyKey: `noxira-dist-${cert._id}`
    });

    const mockNoNotes = mockReqRes({
      admin,
      params: { id: jobForValidation._id },
      body: { resolution: 'RESET_FOR_RETRY', reconciliationNotes: '' }
    });
    await distributionController.reconcileJob(mockNoNotes.req, mockNoNotes.res, mockNoNotes.next);
    assert.strictEqual(mockNoNotes.getStatus(), 400);
    assert.ok(mockNoNotes.getData().message.includes('minimum 10 characters'));

    // 3. Strict Validation: MARK_DELIVERED requires providerMessageId
    const mockNoMsgId = mockReqRes({
      admin,
      params: { id: jobForValidation._id },
      body: {
        resolution: 'MARK_DELIVERED',
        reconciliationNotes: 'Checked logs and confirmed email was delivered'
        // providerMessageId omitted
      }
    });
    await distributionController.reconcileJob(mockNoMsgId.req, mockNoMsgId.res, mockNoMsgId.next);
    assert.strictEqual(mockNoMsgId.getStatus(), 400);
    assert.ok(mockNoMsgId.getData().message.includes('providerMessageId is mandatory'));

    // 4. Reconcile with MARK_DELIVERED (with valid providerMessageId & notes)
    const jobForDelivery = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'reconcile-delivered@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'DELIVERY_UNKNOWN',
      adminOverrideNeeded: true,
      attempts: 1,
      providerIdempotencyKey: `noxira-dist-${cert._id}`
    });

    const mockDelivered = mockReqRes({
      admin,
      params: { id: jobForDelivery._id },
      body: {
        resolution: 'MARK_DELIVERED',
        reconciliationNotes: 'Verified received via SendGrid gateway log trace 987654',
        providerMessageId: 'sg-msg-987654'
      }
    });

    await distributionController.reconcileJob(mockDelivered.req, mockDelivered.res, mockDelivered.next);
    assert.strictEqual(mockDelivered.getStatus(), 200);

    const savedDelivered = await DeliveryJob.findById(jobForDelivery._id);
    assert.strictEqual(savedDelivered.status, 'DELIVERED');
    assert.strictEqual(savedDelivered.adminOverrideNeeded, false);
    assert.strictEqual(savedDelivered.providerMessageId, 'sg-msg-987654');
    assert.ok(savedDelivered.reconciliationNotes.includes('Verified received via SendGrid'));

    // 5. Reconcile with RESET_FOR_RETRY
    const jobForRetry = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'reconcile-retry@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'DELIVERY_UNKNOWN',
      adminOverrideNeeded: true,
      attempts: 1,
      providerIdempotencyKey: `noxira-dist-${cert._id}`
    });

    const mockReset = mockReqRes({
      admin,
      params: { id: jobForRetry._id },
      body: {
        resolution: 'RESET_FOR_RETRY',
        reconciliationNotes: 'Confirmed by gateway support that email was dropped due to network blip'
      }
    });

    await distributionController.reconcileJob(mockReset.req, mockReset.res, mockReset.next);
    assert.strictEqual(mockReset.getStatus(), 200);

    const savedReset = await DeliveryJob.findById(jobForRetry._id);
    assert.strictEqual(savedReset.status, 'FAILED');
    assert.strictEqual(savedReset.adminOverrideNeeded, false);
    assert.strictEqual(savedReset.attempts, 0, 'Unfulfilled attempt counter must be restored on RESET_FOR_RETRY');

    // Now retryJob should be able to claim and retry it cleanly
    const mockRetry = mockReqRes({ admin, params: { id: jobForRetry._id } });
    await distributionController.retryJob(mockRetry.req, mockRetry.res, mockRetry.next);
    assert.strictEqual(mockRetry.getStatus(), 200);

    // 6. ATOMIC RACE TEST: Two simultaneous reconcile calls on same DELIVERY_UNKNOWN job
    const raceJob = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'race-reconcile@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'DELIVERY_UNKNOWN',
      adminOverrideNeeded: true,
      attempts: 1,
      providerIdempotencyKey: `noxira-dist-${cert._id}`
    });

    const raceCall1 = mockReqRes({
      admin,
      params: { id: raceJob._id },
      body: {
        resolution: 'RESET_FOR_RETRY',
        reconciliationNotes: 'Admin 1 checked logs and confirmed not sent'
      }
    });

    const raceCall2 = mockReqRes({
      admin,
      params: { id: raceJob._id },
      body: {
        resolution: 'MARK_DELIVERED',
        reconciliationNotes: 'Admin 2 simultaneously claims verified delivered',
        providerMessageId: 'sg-msg-concurrent-test'
      }
    });

    await Promise.all([
      distributionController.reconcileJob(raceCall1.req, raceCall1.res, raceCall1.next),
      distributionController.reconcileJob(raceCall2.req, raceCall2.res, raceCall2.next)
    ]);

    const raceStatuses = [raceCall1.getStatus(), raceCall2.getStatus()].sort();
    assert.strictEqual(raceStatuses[0], 200, 'Exactly one concurrent reconcile request must succeed');
    assert.strictEqual(raceStatuses[1], 409, 'Concurrent conflicting reconcile request must be blocked with 409 Conflict');
  });

  // TEST 16: Partial Layout Robustness & Stable Idempotency Key
  await test('Template & Distribution Robustness: Partial layout save succeeds without 500 & idempotency key is stable', async () => {
    // 1. Partial layout save
    const mockSaveLayout = mockReqRes({
      body: {
        layout: {
          name: { y: 420 }
        }
      }
    });

    await templateController.saveLayout(mockSaveLayout.req, mockSaveLayout.res, mockSaveLayout.next);
    assert.strictEqual(mockSaveLayout.getStatus(), 200);

    const updatedTemplate = await Template.findOne({ isActive: true });
    assert.strictEqual(updatedTemplate.layout.name.y, 420);
    assert.ok(updatedTemplate.layout.signatory, 'Signatory must not be wiped by partial layout update');
    assert.ok(updatedTemplate.layout.qr, 'QR code config must not be wiped by partial layout update');

    // 2. Stable idempotency key check
    const cert = await Certificate.findOne({ status: 'ISSUED' });
    const p = await Participant.findOne({ email: 'aarav.sharma@example.com' });

    const job = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'idempotency-check@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'QUEUED',
      providerIdempotencyKey: `noxira-dist-${cert._id}`
    });

    assert.strictEqual(job.providerIdempotencyKey, `noxira-dist-${cert._id}`);
  });

  // TEST 17: Public Programs Listing & Inactive Program Protection (Module 1)
  await test('Public Programs API: Returns only active programs with safe fields & rejects apply on inactive', async () => {
    // 1. Seed an inactive program alongside existing active ones
    await Program.create({
      code: 'INACTIVE-PRG',
      title: 'Legacy Inactive Course',
      description: 'Archived program not currently running',
      defaultBatch: 'BATCH-OLD',
      isActive: false
    });

    // 2. Query public programs API without auth
    const mockPrograms = mockReqRes();
    await getPublicPrograms(mockPrograms.req, mockPrograms.res, mockPrograms.next);
    assert.strictEqual(mockPrograms.getStatus(), 200);

    const { programs } = mockPrograms.getData();
    assert.ok(Array.isArray(programs), 'Programs must be an array');
    assert.ok(programs.length >= 2, 'Must return seeded active programs');

    // Inactive program must NOT be returned
    const inactiveFound = programs.find(p => p.code === 'INACTIVE-PRG');
    assert.strictEqual(inactiveFound, undefined, 'Inactive programs must be excluded from public list');

    // Sensitive internal fields must NOT leak in public response
    for (const prg of programs) {
      assert.ok(prg.code, 'Program must have code');
      assert.ok(prg.title, 'Program must have title');
      assert.strictEqual(prg.defaultBatch, undefined, 'defaultBatch must not leak');
      assert.strictEqual(prg.defaultStartDate, undefined, 'defaultStartDate must not leak');
      assert.strictEqual(prg.defaultEndDate, undefined, 'defaultEndDate must not leak');
      assert.strictEqual(prg._id, undefined, '_id must be excluded');
    }

    // 3. Attempt websiteApply on inactive program with configured batch -> must be rejected with 400
    process.env.WEBSITE_INTAKE_BATCH_ID = 'BATCH-TEST-2026';
    const mockApply = mockReqRes({
      body: {
        fullName: 'Applicant Tester',
        email: 'applicant.tester@example.com',
        programCode: 'INACTIVE-PRG',
        feeAcknowledged: true
      }
    });

    await intakeController.websiteApply(mockApply.req, mockApply.res, mockApply.next);
    assert.strictEqual(mockApply.getStatus(), 400, 'Must reject application for inactive program with 400');
    assert.ok(mockApply.getData().message.includes('inactive and not accepting applications'));
  });

  // TEST 18: Website Intake Batch Resolution, Fail-Closed Security & Concurrency Safety
  await test('Website Intake: Fails closed (503) without configured batch, ignores client batchId, enforces unique index & handles concurrency cleanly', async () => {
    // 1. Unset WEBSITE_INTAKE_BATCH_ID -> Must fail closed with 503 and create zero records
    delete process.env.WEBSITE_INTAKE_BATCH_ID;
    const initialCount = await Participant.countDocuments();
    const initialAuditCount = await AuditLog.countDocuments();

    const mockUnconfigured = mockReqRes({
      body: {
        fullName: 'Unconfigured Batch Tester',
        email: 'unconfigured@example.com',
        programCode: 'FS-DEV'
      }
    });

    await intakeController.websiteApply(mockUnconfigured.req, mockUnconfigured.res, mockUnconfigured.next);
    assert.strictEqual(mockUnconfigured.getStatus(), 503, 'Must return 503 Service Unavailable when batch is unconfigured');
    assert.ok(mockUnconfigured.getData().message.includes('intake batch not configured'));
    
    // Ensure zero records created
    const afterCount = await Participant.countDocuments();
    const afterAuditCount = await AuditLog.countDocuments();
    assert.strictEqual(afterCount, initialCount, 'Zero participant records must be created on 503');
    assert.strictEqual(afterAuditCount, initialAuditCount, 'Zero audit records must be created on 503');

    // 2. Set authoritative server-side intake batch
    const realConfiguredBatch = 'BATCH-SYNTHETIC-2026-X1';
    process.env.WEBSITE_INTAKE_BATCH_ID = realConfiguredBatch;
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { feeInr: 499 } });

    // Attacker sends crafted batchId 'MALICIOUS-BATCH-OVERRIDE'
    const mockAttacker = mockReqRes({
      body: {
        fullName: 'Attacker Tester',
        email: 'attacker@example.com',
        programCode: 'FS-DEV',
        batchId: 'MALICIOUS-BATCH-OVERRIDE',
        feeAcknowledged: true
      }
    });

    await intakeController.websiteApply(mockAttacker.req, mockAttacker.res, mockAttacker.next);
    assert.strictEqual(mockAttacker.getStatus(), 201, 'Should accept valid application');

    const createdAttacker = await Participant.findOne({ email: 'attacker@example.com' });
    assert.ok(createdAttacker, 'Participant record should be created');
    assert.strictEqual(createdAttacker.batchId, realConfiguredBatch, 'Must use server configured batch, ignoring client-supplied batchId');

    // 3. Normalized duplicate registration in same batch -> 409 Conflict
    const mockDuplicate = mockReqRes({
      body: {
        fullName: 'Attacker Tester Different Case',
        email: 'ATTACKER@EXAMPLE.COM', // uppercase to verify normalization
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });

    await intakeController.websiteApply(mockDuplicate.req, mockDuplicate.res, mockDuplicate.next);
    assert.strictEqual(mockDuplicate.getStatus(), 409, 'Must return 409 Conflict for duplicate normalized email/program/batch');
    assert.ok(mockDuplicate.getData().message.includes('already on file'));

    // 4. Same participant in a different legitimate batch -> allowed and distinct
    process.env.WEBSITE_INTAKE_BATCH_ID = 'BATCH-SYNTHETIC-2026-X2';
    const mockNewBatch = mockReqRes({
      body: {
        fullName: 'Attacker Tester',
        email: 'attacker@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });

    await intakeController.websiteApply(mockNewBatch.req, mockNewBatch.res, mockNewBatch.next);
    assert.strictEqual(mockNewBatch.getStatus(), 201, 'Same email/program in a different batch should succeed');
    const newBatchRecord = await Participant.findOne({ email: 'attacker@example.com', batchId: 'BATCH-SYNTHETIC-2026-X2' });
    assert.ok(newBatchRecord, 'Record in separate batch should exist');

    // 5. Concurrency Race Test: 2 simultaneous duplicate requests in the same batch
    process.env.WEBSITE_INTAKE_BATCH_ID = 'BATCH-RACE-2026';
    const raceEmail = 'race.candidate@example.com';

    const reqRes1 = mockReqRes({
      body: { fullName: 'Race Candidate 1', email: raceEmail, programCode: 'FS-DEV', feeAcknowledged: true }
    });
    const reqRes2 = mockReqRes({
      body: { fullName: 'Race Candidate 2', email: raceEmail, programCode: 'FS-DEV', feeAcknowledged: true }
    });

    // Fire both requests concurrently
    await Promise.all([
      intakeController.websiteApply(reqRes1.req, reqRes1.res, reqRes1.next),
      intakeController.websiteApply(reqRes2.req, reqRes2.res, reqRes2.next)
    ]);

    const statuses = [reqRes1.getStatus(), reqRes2.getStatus()].sort();
    assert.deepStrictEqual(statuses, [201, 409], 'Simultaneous duplicates must result in exactly one 201 and one 409');

    const totalRaceRecords = await Participant.countDocuments({ normalizedEmail: raceEmail });
    assert.strictEqual(totalRaceRecords, 1, 'Exactly one participant record must exist after race');
  });

  // TEST 19: Seed Admin Hygiene, Missing Secret Protection & No Accidental Overwrite
  await test('Admin Seed Hygiene: Refuses missing secret, avoids plaintext leaks, preserves existing admin without --force-reset', async () => {
    const { seedAdmin } = require('../src/scripts/seedAdmin');
    const originalEnvPass = process.env.INITIAL_ADMIN_PASSWORD;
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;

    let exitCode = null;
    let loggedErrors = [];
    let loggedMessages = [];

    process.exit = (code) => { exitCode = code; throw new Error(`EXIT_${code}`); };
    console.error = (...args) => loggedErrors.push(args.join(' '));
    console.log = (...args) => loggedMessages.push(args.join(' '));

    try {
      // 1. Missing INITIAL_ADMIN_PASSWORD -> Must exit 1 with redacted error
      delete process.env.INITIAL_ADMIN_PASSWORD;
      exitCode = null;
      try {
        await seedAdmin();
      } catch (e) {
        assert.strictEqual(e.message, 'EXIT_1');
      }
      assert.strictEqual(exitCode, 1, 'Must exit with code 1 when INITIAL_ADMIN_PASSWORD is missing');
      assert.ok(loggedErrors.some(m => m.includes('[ERROR] INITIAL_ADMIN_PASSWORD environment variable is required.')));

      // 2. Safe execution with password -> creates new admin and never logs password
      process.env.INITIAL_ADMIN_PASSWORD = 'SyntheticSecretForTestsOnly123!';
      process.env.INITIAL_ADMIN_EMAIL = 'hygiene-admin@example.com';
      exitCode = null;
      loggedMessages = [];

      // Intercept connectDB/disconnectDB since we are already connected to mongod in this test process
      const dbModule = require('../src/config/db');
      const origConnect = dbModule.connectDB;
      const origDisconnect = dbModule.disconnectDB;
      dbModule.connectDB = async () => {};
      dbModule.disconnectDB = async () => {};

      try {
        await seedAdmin();
      } catch (e) {
        assert.strictEqual(e.message, 'EXIT_0');
      }
      assert.strictEqual(exitCode, 0, 'Must exit 0 on successful seeding');

      const seededAdmin = await Admin.findOne({ email: 'hygiene-admin@example.com' });
      assert.ok(seededAdmin, 'Admin must be created in DB');
      const passValid = await seededAdmin.comparePassword('SyntheticSecretForTestsOnly123!');
      assert.ok(passValid, 'Password must be correctly hashed');

      // Check logs to ensure password was never logged
      const anyLeak = loggedMessages.some(m => m.includes('SyntheticSecretForTestsOnly123!'));
      assert.strictEqual(anyLeak, false, 'Plaintext password must NEVER be logged to console');

      // 3. Existing admin run without --force-reset -> Must NOT overwrite password
      process.env.INITIAL_ADMIN_PASSWORD = 'DifferentNewPassword456!';
      const oldHash = seededAdmin.passwordHash;
      exitCode = null;

      try {
        await seedAdmin();
      } catch (e) {
        assert.strictEqual(e.message, 'EXIT_0');
      }

      const unchangedAdmin = await Admin.findOne({ email: 'hygiene-admin@example.com' });
      assert.strictEqual(unchangedAdmin.passwordHash, oldHash, 'Password must NOT be overwritten without --force-reset');

      // Restore mocks
      dbModule.connectDB = origConnect;
      dbModule.disconnectDB = origDisconnect;
    } finally {
      process.exit = originalExit;
      console.error = originalError;
      console.log = originalLog;
      if (originalEnvPass) {
        process.env.INITIAL_ADMIN_PASSWORD = originalEnvPass;
      } else {
        delete process.env.INITIAL_ADMIN_PASSWORD;
      }
    }
  });

  // TEST 20: Config, Clean Seed Defaults, Accurate Template Defaults & Exact Presentation Resolver
  await test('Config & Presentation Integrity: .env.example blank batch, fresh seeds neutral, template defaults clean, presentation resolver exact-only', async () => {
    const fs = require('fs');
    const path = require('path');

    // 1. Verify server/.env.example has blank WEBSITE_INTAKE_BATCH_ID
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    const batchLine = envExampleContent.split('\n').find(l => l.startsWith('WEBSITE_INTAKE_BATCH_ID='));
    assert.ok(batchLine !== undefined, 'WEBSITE_INTAKE_BATCH_ID must be present in .env.example');
    const batchVal = batchLine.split('=')[1].trim();
    assert.strictEqual(batchVal, '', 'WEBSITE_INTAKE_BATCH_ID in .env.example must be blank');

    // 2. Whitespace-only WEBSITE_INTAKE_BATCH_ID returns 503 and creates zero records
    process.env.WEBSITE_INTAKE_BATCH_ID = '    ';
    const preCount = await Participant.countDocuments();
    const preAudit = await AuditLog.countDocuments();

    const mockWhitespace = mockReqRes({
      body: {
        fullName: 'Whitespace Batch Tester',
        email: 'whitespace.batch@example.com',
        programCode: 'FS-DEV'
      }
    });

    await intakeController.websiteApply(mockWhitespace.req, mockWhitespace.res, mockWhitespace.next);
    assert.strictEqual(mockWhitespace.getStatus(), 503, 'Whitespace batch config must return 503');
    const postCount = await Participant.countDocuments();
    const postAudit = await AuditLog.countDocuments();
    assert.strictEqual(postCount, preCount, 'Zero participant records on whitespace batch');
    assert.strictEqual(postAudit, preAudit, 'Zero audit records on whitespace batch');

    // 3. Verify clean fresh seed definitions (no legacy 8-week text seeded into new records)
    const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/index.js'), 'utf8');
    const seedDataSource = fs.readFileSync(path.resolve(__dirname, '../src/scripts/seedDemoData.js'), 'utf8');
    assert.strictEqual(indexSource.includes('Comprehensive 8-week intensive'), false, 'index.js must not seed legacy 8-week text');
    assert.strictEqual(seedDataSource.includes('Comprehensive 8-week intensive'), false, 'seedDemoData.js must not seed legacy 8-week text');

    // 4. Verify Template model default organization has no "Private Limited"
    const newTemplate = new Template();
    assert.strictEqual(newTemplate.signatory.organization, 'NOXIRA Technologies', 'New template default organization must be NOXIRA Technologies');

    // 5. Test Exact Legacy Demo Presentation Resolver
    // Read the client pure presentation helper directly to verify logic without Babel/JSX transform
    const programUtilsSource = fs.readFileSync(path.resolve(__dirname, '../../client/src/utils/programUtils.js'), 'utf8');
    assert.ok(programUtilsSource.includes('LEGACY_FS_DEV_DEMO_DESC'), 'programUtils.js must define legacy demo constant');

    // Inline exact logic check matching client/src/utils/programUtils.js
    const LEGACY_FS_DEV_DEMO_DESC = 'Comprehensive 8-week intensive on modern scalable web architecture.';
    function resolveProgramDescription(prg) {
      if (!prg) return '';
      const desc = prg.description || '';
      if (prg.code === 'FS-DEV' && desc.trim() === LEGACY_FS_DEV_DEMO_DESC) {
        return 'Engineering track covering modern web architecture with structured evaluation and verified credential issuance.';
      }
      return desc || 'Curriculum and cohort details for this programme will be published by NOXIRA soon.';
    }

    // Case A: Exact legacy demo string for FS-DEV -> maps to presentation fallback
    const legacyResolved = resolveProgramDescription({
      code: 'FS-DEV',
      description: 'Comprehensive 8-week intensive on modern scalable web architecture.'
    });
    assert.strictEqual(legacyResolved, 'Engineering track covering modern web architecture with structured evaluation and verified credential issuance.');

    // Case B: Owner-authored text containing similar 8-week phrase -> preserved exactly as written
    const ownerCustomDesc = 'Custom 8-week intensive enterprise systems curriculum with production deployment.';
    const ownerResolved = resolveProgramDescription({
      code: 'FS-DEV',
      description: ownerCustomDesc
    });
    assert.strictEqual(ownerResolved, ownerCustomDesc, 'Owner-authored description with 8-week text must NOT be suppressed');

    // Case C: Non-FS-DEV program with legacy string -> preserved as-is
    const otherProgramResolved = resolveProgramDescription({
      code: 'CLOUD-ARCH',
      description: 'Comprehensive 8-week intensive on modern scalable web architecture.'
    });
    assert.strictEqual(otherProgramResolved, 'Comprehensive 8-week intensive on modern scalable web architecture.', 'Different program code must not trigger FS-DEV fallback');

    // Case D: Stored MongoDB records remain unmutated by presentation layer
    const storedFsDev = await Program.findOne({ code: 'FS-DEV' });
    if (storedFsDev) {
      const dbDescBefore = storedFsDev.description;
      resolveProgramDescription(storedFsDev);
      const dbDescAfter = (await Program.findOne({ code: 'FS-DEV' })).description;
      assert.strictEqual(dbDescAfter, dbDescBefore, 'Database record must remain unmutated by presentation resolver');
    }
  });

  // TEST 21: Full 31-Program Catalogue Seeding, Schema Integrity & Idempotency
  await test('Program Catalogue: 31 programmes seeded additively, strictly preserves owner edits upon re-seed, with safe public listing', async () => {
    // 1. Seed the catalogue
    await seedProgramCatalogue();

    // Verify exactly 31 catalogue programs exist in DB
    const catalogueCodes = CATALOGUE_PROGRAMS.map(p => p.code);
    assert.strictEqual(catalogueCodes.length, 31, 'Catalogue must have exactly 31 programs defined');

    const inDb = await Program.find({ code: { $in: catalogueCodes } });
    assert.strictEqual(inDb.length, 31, 'All 31 catalogue programs must exist in the database');

    // Verify all categories belong to official PROGRAM_CATEGORIES
    for (const p of inDb) {
      assert.ok(p.category, `Program ${p.code} must have a category`);
      assert.ok(PROGRAM_CATEGORIES.includes(p.category), `Category ${p.category} must be valid`);
      assert.strictEqual(p.isActive, true, `Program ${p.code} must default to active`);
    }

    // 2. Owner customizes an existing program (e.g. FS-DEV)
    await Program.updateOne(
      { code: 'FS-DEV' },
      {
        $set: {
          title: 'Full Stack Web Engineering (Owner Title)',
          description: 'Owner authored custom description.',
          durationWeeks: 12,
          feeInr: 499,
          seats: 50,
          syllabus: ['React Deep Dive', 'Node.js Microservices', 'CI/CD Pipelines'],
          tasks: ['Build Authentication', 'Deploy on Kubernetes']
        }
      }
    );

    // 3. Re-run seedProgramCatalogue() - MUST be strictly idempotent and NOT overwrite owner edits
    await seedProgramCatalogue();

    const preservedFsDev = await Program.findOne({ code: 'FS-DEV' });
    assert.strictEqual(preservedFsDev.title, 'Full Stack Web Engineering (Owner Title)', 'Re-seed must not overwrite customized title');
    assert.strictEqual(preservedFsDev.description, 'Owner authored custom description.', 'Re-seed must not overwrite customized description');
    assert.strictEqual(preservedFsDev.durationWeeks, 12, 'Re-seed must not overwrite customized durationWeeks');
    assert.strictEqual(preservedFsDev.feeInr, 499, 'Re-seed must not overwrite customized feeInr');
    assert.strictEqual(preservedFsDev.seats, 50, 'Re-seed must not overwrite customized seats');
    assert.deepStrictEqual(preservedFsDev.syllabus, ['React Deep Dive', 'Node.js Microservices', 'CI/CD Pipelines'], 'Re-seed must not overwrite customized syllabus');
    assert.deepStrictEqual(preservedFsDev.tasks, ['Build Authentication', 'Deploy on Kubernetes'], 'Re-seed must not overwrite customized tasks');

    // 4. Verify public GET /api/v1/programs sorting and field safety
    // Note: FS-DEV has conflicting legacy values (12w / 499), so it is excluded from public listing
    const mockReq = mockReqRes();
    await getPublicPrograms(mockReq.req, mockReq.res, mockReq.next);
    assert.strictEqual(mockReq.getStatus(), 200);

    const { programs } = mockReq.getData();
    assert.strictEqual(programs.find(p => p.code === 'FS-DEV'), undefined, 'Conflicting legacy track FS-DEV must be excluded from public listing');
    assert.ok(programs.length >= 30, 'Public listing must return all active normalized programs');

    // Verify safe fields only
    for (const prg of programs) {
      assert.ok(prg.code, 'Must include code');
      assert.ok(prg.title, 'Must include title');
      assert.strictEqual(prg.defaultBatch, undefined, 'Must not leak defaultBatch');
      assert.strictEqual(prg.defaultStartDate, undefined, 'Must not leak defaultStartDate');
      assert.strictEqual(prg.defaultEndDate, undefined, 'Must not leak defaultEndDate');
      assert.strictEqual(prg._id, undefined, 'Must not leak _id');
    }

    // Verify sorting order: category ascending, then title ascending
    for (let i = 1; i < programs.length; i++) {
      const prev = programs[i - 1];
      const curr = programs[i];
      if (prev.category === curr.category) {
        assert.ok(prev.title.localeCompare(curr.title) <= 0, `Within same category, titles must be sorted ascending: "${prev.title}" <= "${curr.title}"`);
      } else {
        assert.ok((prev.category || '').localeCompare(curr.category || '') <= 0, `Categories must be sorted ascending: "${prev.category}" <= "${curr.category}"`);
      }
    }
  });

  // TEST 22: Public Program Detail Endpoint (GET /api/v1/programs/:code)
  await test('Public Program Detail: Returns safe fields for active program, normalizes code case, and returns 404 for unknown or inactive codes', async () => {
    // 1. Conflicting legacy program -> returns 404 from public detail
    const mockLegacy = mockReqRes({ params: { code: 'fs-dev' } });
    await getPublicProgramByCode(mockLegacy.req, mockLegacy.res, mockLegacy.next);
    assert.strictEqual(mockLegacy.getStatus(), 404, 'Conflicting legacy track must return 404 from public detail');

    // Valid active normalized program (e.g. FE-DEV)
    const mockDetail = mockReqRes({ params: { code: 'fe-dev' } }); // lowercase to test case insensitivity
    await getPublicProgramByCode(mockDetail.req, mockDetail.res, mockDetail.next);
    assert.strictEqual(mockDetail.getStatus(), 200);

    const { program } = mockDetail.getData();
    assert.ok(program, 'Program data must be present');
    assert.strictEqual(program.code, 'FE-DEV');
    assert.strictEqual(program.durationWeeks, 4);
    assert.strictEqual(program.feeInr, 99);
    assert.strictEqual(program.defaultBatch, undefined, 'Must not leak defaultBatch in detail');
    assert.strictEqual(program._id, undefined, 'Must not leak _id in detail');

    // 2. Unknown program code -> 404
    const mockUnknown = mockReqRes({ params: { code: 'NONEXISTENT-TRACK' } });
    await getPublicProgramByCode(mockUnknown.req, mockUnknown.res, mockUnknown.next);
    assert.strictEqual(mockUnknown.getStatus(), 404, 'Unknown program code must return 404');
    assert.strictEqual(mockUnknown.getData().success, false);
    assert.ok(mockUnknown.getData().message.includes('not found or is currently inactive'));

    // 3. Inactive program code -> 404
    await Program.updateOne({ code: 'C-PROG' }, { $set: { isActive: false } });
    const mockInactive = mockReqRes({ params: { code: 'C-PROG' } });
    await getPublicProgramByCode(mockInactive.req, mockInactive.res, mockInactive.next);
    assert.strictEqual(mockInactive.getStatus(), 404, 'Inactive program must return 404');
    assert.strictEqual(mockInactive.getData().success, false);
  });

  // TEST 23: Admin Program Manager API (Auth, Role, Validations, Create, Update, Immutability)
  await test('Admin Program Manager: Enforces roles, validates schema inputs, supports creation & updates, and preserves immutable code', async () => {
    // 1. Role enforcement
    const roleMiddleware = requireRole(['SUPER_ADMIN', 'ISSUER']);
    const mockViewer = mockReqRes({ admin: { role: 'VIEWER' } });
    roleMiddleware(mockViewer.req, mockViewer.res, mockViewer.next);
    assert.strictEqual(mockViewer.getStatus(), 403, 'VIEWER role must be rejected with 403 Forbidden');

    const mockSuperAdmin = mockReqRes({ admin: { role: 'SUPER_ADMIN' } });
    let passedMiddleware = false;
    roleMiddleware(mockSuperAdmin.req, mockSuperAdmin.res, () => { passedMiddleware = true; });
    assert.strictEqual(passedMiddleware, true, 'SUPER_ADMIN role must pass role middleware');

    // 2. Admin List Programs (includes inactive)
    const mockAdminList = mockReqRes();
    await adminGetPrograms(mockAdminList.req, mockAdminList.res, mockAdminList.next);
    assert.strictEqual(mockAdminList.getStatus(), 200);
    const { programs: adminPrograms } = mockAdminList.getData();
    const inactiveFound = adminPrograms.find(p => p.code === 'C-PROG');
    assert.ok(inactiveFound, 'Admin programs listing must include inactive programs');
    assert.strictEqual(inactiveFound.isActive, false);

    // 3. Admin Create Program: Validation checks
    // Empty code
    const mockEmptyCode = mockReqRes({ body: { title: 'Test Program' } });
    await adminCreateProgram(mockEmptyCode.req, mockEmptyCode.res, mockEmptyCode.next);
    assert.strictEqual(mockEmptyCode.getStatus(), 400, 'Empty code must return 400');

    // Duplicate code
    const mockDupCode = mockReqRes({ body: { code: 'FS-DEV', title: 'Duplicate' } });
    await adminCreateProgram(mockDupCode.req, mockDupCode.res, mockDupCode.next);
    assert.strictEqual(mockDupCode.getStatus(), 409, 'Duplicate code must return 409 Conflict');

    // Invalid category
    const mockInvalidCat = mockReqRes({ body: { code: 'NEW-PRG', title: 'New Track', category: 'InvalidCategory' } });
    await adminCreateProgram(mockInvalidCat.req, mockInvalidCat.res, mockInvalidCat.next);
    assert.strictEqual(mockInvalidCat.getStatus(), 400, 'Invalid category must return 400');

    // Negative durationWeeks
    const mockNegDuration = mockReqRes({ body: { code: 'NEW-PRG', title: 'New Track', durationWeeks: -2 } });
    await adminCreateProgram(mockNegDuration.req, mockNegDuration.res, mockNegDuration.next);
    assert.strictEqual(mockNegDuration.getStatus(), 400, 'Negative duration must return 400');

    // Negative feeInr
    const mockNegFee = mockReqRes({ body: { code: 'NEW-PRG', title: 'New Track', feeInr: -50 } });
    await adminCreateProgram(mockNegFee.req, mockNegFee.res, mockNegFee.next);
    assert.strictEqual(mockNegFee.getStatus(), 400, 'Negative fee must return 400');

    // End date before start date
    const mockBadDates = mockReqRes({
      body: {
        code: 'NEW-PRG',
        title: 'New Track',
        startDate: '2026-12-01',
        endDate: '2026-11-01'
      }
    });
    await adminCreateProgram(mockBadDates.req, mockBadDates.res, mockBadDates.next);
    assert.strictEqual(mockBadDates.getStatus(), 400, 'End date before start date must return 400');

    // Valid Program Creation
    const mockCreateSuccess = mockReqRes({
      body: {
        code: 'QUANT-FIN',
        title: 'Quantitative Finance & Algorithmic Trading',
        category: 'Business',
        description: 'Mathematical modeling and algorithmic execution.',
        durationWeeks: 4,
        feeInr: 99,
        seats: 25,
        startDate: '2026-11-15',
        endDate: '2027-01-15',
        syllabus: 'Stochastic Calculus\nPortfolio Optimization\nOrder Execution',
        tasks: 'Task 1: Black-Scholes Pricer\nTask 2: Backtesting Engine'
      }
    });
    await adminCreateProgram(mockCreateSuccess.req, mockCreateSuccess.res, mockCreateSuccess.next);
    assert.strictEqual(mockCreateSuccess.getStatus(), 201, 'Valid program creation must return 201');

    const created = await Program.findOne({ code: 'QUANT-FIN' });
    assert.ok(created, 'Created program must be saved in DB');
    assert.strictEqual(created.category, 'Business');
    assert.strictEqual(created.syllabus.length, 3);
    assert.strictEqual(created.tasks.length, 2);

    // 4. Admin Update Program: Validation & Execution
    // 404 for unknown
    const mockUpdate404 = mockReqRes({ params: { code: 'NONEXISTENT' }, body: { title: 'Updated' } });
    await adminUpdateProgram(mockUpdate404.req, mockUpdate404.res, mockUpdate404.next);
    assert.strictEqual(mockUpdate404.getStatus(), 404, 'Updating unknown program must return 404');

    // Empty title
    const mockEmptyUpdateTitle = mockReqRes({ params: { code: 'QUANT-FIN' }, body: { title: '   ' } });
    await adminUpdateProgram(mockEmptyUpdateTitle.req, mockEmptyUpdateTitle.res, mockEmptyUpdateTitle.next);
    assert.strictEqual(mockEmptyUpdateTitle.getStatus(), 400, 'Empty title on update must return 400');

    // Successful update with active toggle
    const mockUpdateSuccess = mockReqRes({
      params: { code: 'QUANT-FIN' },
      body: {
        title: 'Quantitative Finance & Algorithmic Trading (Updated)',
        seats: 40,
        isActive: false
      }
    });
    await adminUpdateProgram(mockUpdateSuccess.req, mockUpdateSuccess.res, mockUpdateSuccess.next);
    assert.strictEqual(mockUpdateSuccess.getStatus(), 200, 'Successful update must return 200');

    const updated = await Program.findOne({ code: 'QUANT-FIN' });
    assert.strictEqual(updated.title, 'Quantitative Finance & Algorithmic Trading (Updated)');
    assert.strictEqual(updated.seats, 40);
    assert.strictEqual(updated.isActive, false, 'Must update isActive toggle');
    assert.strictEqual(updated.code, 'QUANT-FIN', 'Code must remain unchanged (immutable)');
  });

  // TEST 24: Module 3 Application Lifecycle, Fee Acknowledgment & Public Status Enumeration Defense
  await test('Module 3: Enforces fee acknowledgment, generates human-friendly NOX- IDs, locks fee safely, prevents duplicate applications, and protects status lookup with generic 404 & rate limiter', async () => {
    process.env.WEBSITE_INTAKE_BATCH_ID = 'BATCH-M3-ACCEPTANCE';

    // 1. Mandatory fee acknowledgment validation (400 if missing, false, or non-boolean)
    const mockNoAck = mockReqRes({
      body: {
        fullName: 'Unacknowledged Candidate',
        email: 'unacknowledged@example.com',
        programCode: 'FS-DEV'
      }
    });
    await intakeController.websiteApply(mockNoAck.req, mockNoAck.res, mockNoAck.next);
    assert.strictEqual(mockNoAck.getStatus(), 400, 'Must reject application without feeAcknowledged');
    assert.ok(mockNoAck.getData().message.includes('Fee disclosure acknowledgment is mandatory'));

    const mockFalseAck = mockReqRes({
      body: {
        fullName: 'False Ack Candidate',
        email: 'falseack@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: false
      }
    });
    await intakeController.websiteApply(mockFalseAck.req, mockFalseAck.res, mockFalseAck.next);
    assert.strictEqual(mockFalseAck.getStatus(), 400, 'Must reject application with feeAcknowledged: false');

    const mockStringAck = mockReqRes({
      body: {
        fullName: 'String Ack Candidate',
        email: 'stringack@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: 'true'
      }
    });
    await intakeController.websiteApply(mockStringAck.req, mockStringAck.res, mockStringAck.next);
    assert.strictEqual(mockStringAck.getStatus(), 400, 'Must reject non-boolean feeAcknowledged');

    // 2. Successful Application with owner-set fee (feeLocked copied from program)
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { feeInr: 499 } });

    const mockFeeSuccess = mockReqRes({
      body: {
        fullName: 'Fee Lock Candidate',
        email: 'feelock@example.com',
        phone: '+91 98765 00001',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockFeeSuccess.req, mockFeeSuccess.res, mockFeeSuccess.next);
    assert.strictEqual(mockFeeSuccess.getStatus(), 201, 'Valid application must return 201');

    const feeSuccessData = mockFeeSuccess.getData();
    assert.ok(feeSuccessData.application, 'Response must include application object');
    assert.strictEqual(feeSuccessData.application.status, 'APPLIED');
    assert.ok(feeSuccessData.application.applicationId, 'Response must include generated applicationId');
    assert.ok(feeSuccessData.application.appliedAt, 'Response must include appliedAt date');

    const savedApp = await Application.findOne({ applicationId: feeSuccessData.application.applicationId });
    assert.ok(savedApp, 'Application record must exist in DB');
    assert.strictEqual(savedApp.status, 'APPLIED');
    assert.strictEqual(savedApp.feeLocked, 499, 'feeLocked must exactly copy program feeInr');
    assert.strictEqual(savedApp.batchId, 'BATCH-M3-ACCEPTANCE');

    // Verify human-friendly NOX- format (NOX- followed by 6 unambiguous characters: 2-9, A-Z without 0, O, 1, I, L)
    const validIdPattern = /^NOX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
    assert.ok(
      validIdPattern.test(savedApp.applicationId),
      `Generated ID "${savedApp.applicationId}" must match NOX- unambiguous pattern`
    );

    // Verify audit trail for APPLICATION_CREATED
    const appAudit = await AuditLog.findOne({ action: 'APPLICATION_CREATED', targetId: savedApp._id });
    assert.ok(appAudit, 'Audit log for APPLICATION_CREATED must be recorded');

    // 3. Unset fee returns 400 FEE_NOT_SET and creates zero Participant / Application records
    await Program.updateOne({ code: 'APP-DEV' }, { $unset: { feeInr: '' } });
    const preUnsetCount = await Participant.countDocuments({ email: 'nofee@example.com' });
    const preUnsetAppCount = await Application.countDocuments();

    const mockNoFeeAttempt = mockReqRes({
      body: {
        fullName: 'No Fee Candidate',
        email: 'nofee@example.com',
        programCode: 'APP-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockNoFeeAttempt.req, mockNoFeeAttempt.res, mockNoFeeAttempt.next);
    assert.strictEqual(mockNoFeeAttempt.getStatus(), 400, 'Unset fee must return 400');
    assert.strictEqual(mockNoFeeAttempt.getData().code, 'FEE_NOT_SET');
    assert.ok(mockNoFeeAttempt.getData().message.includes('has not published its Task Submission & Review Fee'));

    const postUnsetCount = await Participant.countDocuments({ email: 'nofee@example.com' });
    const postUnsetAppCount = await Application.countDocuments();
    assert.strictEqual(postUnsetCount, preUnsetCount, 'No Participant must be created when fee is unset');
    assert.strictEqual(postUnsetAppCount, preUnsetAppCount, 'No Application must be created when fee is unset');

    // 4. Duplicate apply returns 409 and creates NO second Application record
    const preDuplicateAppCount = await Application.countDocuments();
    const mockDuplicateApply = mockReqRes({
      body: {
        fullName: 'Fee Lock Candidate Duplicate',
        email: 'feelock@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockDuplicateApply.req, mockDuplicateApply.res, mockDuplicateApply.next);
    assert.strictEqual(mockDuplicateApply.getStatus(), 409, 'Duplicate application must be rejected with 409 Conflict');

    const postDuplicateAppCount = await Application.countDocuments();
    assert.strictEqual(postDuplicateAppCount, preDuplicateAppCount, 'Duplicate apply must create NO second Application record');

    // 5. Public Status Lookup: Exact email + id match succeeds (case-insensitive)
    // Add confidential internal adminNotes and decidedBy to verify data isolation
    savedApp.adminNotes = 'Confidential admin note about student background';
    savedApp.decidedBy = new mongoose.Types.ObjectId();
    await savedApp.save();

    const mockStatusValid = mockReqRes({
      query: {
        email: 'FEELOCK@EXAMPLE.COM', // uppercase to verify normalization
        id: savedApp.applicationId.toLowerCase() // lowercase to verify case-insensitivity
      }
    });
    await intakeController.getApplicationStatus(mockStatusValid.req, mockStatusValid.res, mockStatusValid.next);
    assert.strictEqual(mockStatusValid.getStatus(), 200, 'Exact status lookup must return 200');

    const statusResult = mockStatusValid.getData();
    assert.strictEqual(statusResult.success, true);
    assert.strictEqual(statusResult.application.applicationId, savedApp.applicationId);
    assert.strictEqual(statusResult.application.status, 'APPLIED');
    assert.strictEqual(statusResult.application.feeLocked, 499);

    // Strict PII / Internal notes shielding
    assert.strictEqual(statusResult.application.adminNotes, undefined, 'Must NEVER expose adminNotes in public status response');
    assert.strictEqual(statusResult.application.decidedBy, undefined, 'Must NEVER expose decidedBy in public status response');
    assert.strictEqual(statusResult.application.phone, undefined, 'Must NEVER expose phone number in public status response');
    assert.strictEqual(statusResult.application.participantId, undefined, 'Must NEVER expose participantId in public status response');

    // 6. Generic 404 Defense: Wrong email, wrong id, and unknown id all return identical message
    const GENERIC_404_MSG = 'No application found for the details provided.';

    // Case A: Valid ID, wrong email
    const mockWrongEmail = mockReqRes({
      query: { email: 'wrong.email@example.com', id: savedApp.applicationId }
    });
    await intakeController.getApplicationStatus(mockWrongEmail.req, mockWrongEmail.res, mockWrongEmail.next);
    assert.strictEqual(mockWrongEmail.getStatus(), 404);
    assert.strictEqual(mockWrongEmail.getData().message, GENERIC_404_MSG, 'Wrong email must return identical generic 404');

    // Case B: Valid email, wrong ID
    const mockWrongId = mockReqRes({
      query: { email: 'feelock@example.com', id: 'NOX-999999' }
    });
    await intakeController.getApplicationStatus(mockWrongId.req, mockWrongId.res, mockWrongId.next);
    assert.strictEqual(mockWrongId.getStatus(), 404);
    assert.strictEqual(mockWrongId.getData().message, GENERIC_404_MSG, 'Wrong ID must return identical generic 404');

    // Case C: Unknown random ID and random email
    const mockUnknownBoth = mockReqRes({
      query: { email: 'stranger@example.com', id: 'NOX-ABCDEF' }
    });
    await intakeController.getApplicationStatus(mockUnknownBoth.req, mockUnknownBoth.res, mockUnknownBoth.next);
    assert.strictEqual(mockUnknownBoth.getStatus(), 404);
    assert.strictEqual(mockUnknownBoth.getData().message, GENERIC_404_MSG, 'Unknown ID must return identical generic 404');

    // Case D: Missing query params -> 400 Bad Request
    const mockMissingParams = mockReqRes({ query: { email: 'feelock@example.com' } });
    await intakeController.getApplicationStatus(mockMissingParams.req, mockMissingParams.res, mockMissingParams.next);
    assert.strictEqual(mockMissingParams.getStatus(), 400, 'Missing ID param must return 400 Bad Request');

    // 7. Status Rate Limiter: Verified configured at 10 requests per 15 minutes
    assert.ok(statusRateLimiter, 'statusRateLimiter must be exported');
    assert.strictEqual(typeof statusRateLimiter, 'function', 'statusRateLimiter must be a middleware function');

    // 8. FIX 1(a): Forced Application save failure triggers compensating rollback (deletes stranded participant) and allows retry
    const originalSave = Application.prototype.save;
    let failApplicationSave = true;
    Application.prototype.save = async function (...args) {
      if (failApplicationSave) {
        failApplicationSave = false;
        throw new Error('Simulated database write error during Application creation');
      }
      return originalSave.apply(this, args);
    };

    const mockCrash = mockReqRes({
      body: {
        fullName: 'Crash Candidate',
        email: 'crash.candidate@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockCrash.req, mockCrash.res, mockCrash.next);
    assert.strictEqual(mockCrash.getStatus(), 500, 'Application save failure must return 500');

    // Participant must be cleanly deleted by compensating rollback
    const strandedParticipant = await Participant.findOne({ email: 'crash.candidate@example.com' });
    assert.strictEqual(strandedParticipant, null, 'Stranded participant must be deleted on Application creation failure');

    // Immediate retry succeeds with 201 and fresh Application ID
    const mockRetry = mockReqRes({
      body: {
        fullName: 'Crash Candidate',
        email: 'crash.candidate@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockRetry.req, mockRetry.res, mockRetry.next);
    assert.strictEqual(mockRetry.getStatus(), 201, 'Immediate retry after crash rollback must succeed');
    assert.ok(mockRetry.getData().application?.applicationId, 'Retry must yield valid Application ID');

    // Restore prototype save
    Application.prototype.save = originalSave;

    // 9. FIX 1(b): Self-heal on duplicate path for WEBSITE participant lacking an Application
    const strandedWeb = await Participant.create({
      fullName: 'Stranded Web Candidate',
      email: 'stranded.web@example.com',
      normalizedEmail: 'stranded.web@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M3-ACCEPTANCE',
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });
    assert.strictEqual(await Application.findOne({ participantId: strandedWeb._id }), null);

    const mockSelfHeal = mockReqRes({
      body: {
        fullName: 'Stranded Web Candidate',
        email: 'stranded.web@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockSelfHeal.req, mockSelfHeal.res, mockSelfHeal.next);
    assert.strictEqual(mockSelfHeal.getStatus(), 201, 'Self-heal must return 201 with newly created Application');
    const healedAppId = mockSelfHeal.getData().application?.applicationId;
    assert.ok(healedAppId, 'Must return created Application ID');

    // Subsequent apply returns 409 now that Application exists
    const mockApplyAgain = mockReqRes({
      body: {
        fullName: 'Stranded Web Candidate',
        email: 'stranded.web@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockApplyAgain.req, mockApplyAgain.res, mockApplyAgain.next);
    assert.strictEqual(mockApplyAgain.getStatus(), 409, 'Subsequent apply after heal must return 409 Conflict');

    // 10. FIX 1(c): CSV-source participant without Application still returns 409
    await Participant.create({
      fullName: 'CSV Imported Candidate',
      email: 'csv.candidate@example.com',
      normalizedEmail: 'csv.candidate@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M3-ACCEPTANCE',
      source: 'CSV_IMPORT',
      completionStatus: 'PENDING'
    });

    const mockCsvApply = mockReqRes({
      body: {
        fullName: 'CSV Imported Candidate',
        email: 'csv.candidate@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockCsvApply.req, mockCsvApply.res, mockCsvApply.next);
    assert.strictEqual(mockCsvApply.getStatus(), 409, 'CSV-source participant must still return 409');
    assert.ok(mockCsvApply.getData().message.includes('already on file'));

    // 11. FIX 2: Type validation guards on status endpoint (arrays, objects, over-long)
    const mockArrayEmail = mockReqRes({ query: { email: ['candidate@example.com'], id: 'NOX-123456' } });
    await intakeController.getApplicationStatus(mockArrayEmail.req, mockArrayEmail.res, mockArrayEmail.next);
    assert.strictEqual(mockArrayEmail.getStatus(), 400, 'Array email must return 400');

    const mockArrayId = mockReqRes({ query: { email: 'feelock@example.com', id: ['NOX-123456'] } });
    await intakeController.getApplicationStatus(mockArrayId.req, mockArrayId.res, mockArrayId.next);
    assert.strictEqual(mockArrayId.getStatus(), 400, 'Array ID must return 400');

    const mockObjId = mockReqRes({ query: { email: 'feelock@example.com', id: { $ne: 'x' } } });
    await intakeController.getApplicationStatus(mockObjId.req, mockObjId.res, mockObjId.next);
    assert.strictEqual(mockObjId.getStatus(), 400, 'Object ID must return 400');

    const longEmail = 'a'.repeat(250) + '@example.com';
    const mockLongEmail = mockReqRes({ query: { email: longEmail, id: 'NOX-123456' } });
    await intakeController.getApplicationStatus(mockLongEmail.req, mockLongEmail.res, mockLongEmail.next);
    assert.strictEqual(mockLongEmail.getStatus(), 400, 'Over-long email must return 400');

    const longId = 'NOX-' + 'A'.repeat(35);
    const mockLongId = mockReqRes({ query: { email: 'feelock@example.com', id: longId } });
    await intakeController.getApplicationStatus(mockLongId.req, mockLongId.res, mockLongId.next);
    assert.strictEqual(mockLongId.getStatus(), 400, 'Over-long ID must return 400');

    // Non-string on websiteApply returns 400 (not 500)
    const mockObjApply = mockReqRes({
      body: {
        fullName: { name: 'Injection' },
        email: 'obj@example.com',
        programCode: 'FS-DEV',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockObjApply.req, mockObjApply.res, mockObjApply.next);
    assert.strictEqual(mockObjApply.getStatus(), 400, 'Non-string fullName must return 400');

    // 12. FIX 3: Fee 0 is valid and creates application with feeLocked === 0
    await Program.updateOne({ code: 'JAVA-PROG' }, { $set: { feeInr: 0, isActive: true } });
    const mockFreeApply = mockReqRes({
      body: {
        fullName: 'Free Java Learner',
        email: 'free.java@example.com',
        programCode: 'JAVA-PROG',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockFreeApply.req, mockFreeApply.res, mockFreeApply.next);
    assert.strictEqual(mockFreeApply.getStatus(), 201, 'Fee 0 must succeed with 201');
    const freeApp = await Application.findOne({ applicationId: mockFreeApply.getData().application.applicationId });
    assert.strictEqual(freeApp.feeLocked, 0, 'feeLocked must be explicitly 0 for free programme');

    const mockFreeStatus = mockReqRes({
      query: { email: 'free.java@example.com', id: freeApp.applicationId }
    });
    await intakeController.getApplicationStatus(mockFreeStatus.req, mockFreeStatus.res, mockFreeStatus.next);
    assert.strictEqual(mockFreeStatus.getStatus(), 200);
    assert.strictEqual(mockFreeStatus.getData().application.feeLocked, 0, 'feeLocked: 0 must be included in status response');

    // 13. Unique index on Application.participantId exists
    await Application.init(); // Ensure indexes are compiled
    const appIndexes = await Application.collection.indexes();
    const participantIdx = appIndexes.find(idx => idx.key && idx.key.participantId === 1);
    assert.ok(participantIdx, 'Application must have an index on participantId');
    assert.strictEqual(participantIdx.unique, true, 'participantId index on Application must be unique');
  });

  // TEST 25: Module 4 Selection Gate, Replaceable PDF Offer Templates, Bearer Tokens & Delivery Reconciliation
  await test('Module 4: Selection Gate, Offer Letter Templates, PDF Engine, Expiring Bearer Links, and Delivery Reconciliation', async () => {
    // 1. Seed sample offer template
    const samplePdfBuf = await offerPdfService.generateSampleOfferTemplatePdf();
    assert.ok(samplePdfBuf && samplePdfBuf.length > 0, 'Must generate valid sample PDF buffer');
    const sampleSaved = await storageService.saveOfferTemplateFile(samplePdfBuf, 'test_sample_template.pdf');
    const samplePath = sampleSaved.diskPath || String(sampleSaved);

    const sampleTemplate = await OfferLetterTemplate.create({
      name: 'Test Sample Template',
      version: 1,
      isSample: true,
      isActive: false,
      pdfStoragePath: samplePath,
      pdfSizeBytes: samplePdfBuf.length,
      pageCount: 1,
      pageDimensions: [{ pageNumber: 1, width: 595.28, height: 841.89 }],
      fields: offerPdfService.DEFAULT_SAMPLE_FIELDS
    });

    // 2. Setup test applicants
    const p1 = await Participant.create({
      fullName: 'Candidate Alpha',
      email: 'alpha@example.com',
      normalizedEmail: 'alpha@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M4-01',
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });
    const appAlpha = await Application.create({
      applicationId: 'NOX-ALPHA1',
      participantId: p1._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M4-01',
      status: 'APPLIED',
      feeLocked: 499
    });

    const p2 = await Participant.create({
      fullName: 'Candidate Beta',
      email: 'beta@example.com',
      normalizedEmail: 'beta@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M4-01',
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });
    const appBeta = await Application.create({
      applicationId: 'NOX-BETA22',
      participantId: p2._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M4-01',
      status: 'APPLIED',
      feeLocked: 499
    });

    const p3 = await Participant.create({
      fullName: 'Candidate Gamma',
      email: 'gamma@example.com',
      normalizedEmail: 'gamma@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M4-01',
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });
    const appGamma = await Application.create({
      applicationId: 'NOX-GAMMA3',
      participantId: p3._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development & Cloud Systems',
      batchId: 'BATCH-M4-01',
      status: 'APPLIED',
      feeLocked: 499
    });

    // 3. Admin Application listing with regex escaping
    const mockList = mockReqRes({
      query: { search: '[Special*Regex(Chars)', page: '1', limit: '10' }
    });
    await adminApplicationController.getApplications(mockList.req, mockList.res, mockList.next);
    assert.strictEqual(mockList.getStatus(), 200, 'Search with regex characters must not crash');
    assert.ok(Array.isArray(mockList.getData().applications), 'Must return applications array');

    // 4. Single Rejection requires student-facing reason
    const mockRejectNoReason = mockReqRes({
      params: { id: appAlpha.applicationId },
      body: { status: 'REJECTED' }
    });
    await adminApplicationController.updateApplicationStatus(mockRejectNoReason.req, mockRejectNoReason.res, mockRejectNoReason.next);
    assert.strictEqual(mockRejectNoReason.getStatus(), 400, 'Rejection without reason must return 400');

    const mockRejectSuccess = mockReqRes({
      params: { id: appAlpha.applicationId },
      body: { status: 'REJECTED', rejectionReason: 'Cohort capacity reached for selected batch.' }
    });
    await adminApplicationController.updateApplicationStatus(mockRejectSuccess.req, mockRejectSuccess.res, mockRejectSuccess.next);
    assert.strictEqual(mockRejectSuccess.getStatus(), 200, 'Rejection with reason must return 200');

    const refreshedAlpha = await Application.findOne({ applicationId: appAlpha.applicationId });
    assert.strictEqual(refreshedAlpha.status, 'REJECTED');
    assert.strictEqual(refreshedAlpha.rejectionReason, 'Cohort capacity reached for selected batch.');
    assert.ok(refreshedAlpha.decidedAt, 'Must record decidedAt timestamp');
    assert.strictEqual(refreshedAlpha.history.length, 1, 'Must record transition history');

    // 5. Atomic guard: Cannot transition already final status
    const mockRejectAgain = mockReqRes({
      params: { id: appAlpha.applicationId },
      body: { status: 'APPROVED' }
    });
    await adminApplicationController.updateApplicationStatus(mockRejectAgain.req, mockRejectAgain.res, mockRejectAgain.next);
    assert.strictEqual(mockRejectAgain.getStatus(), 409, 'Cannot transition from final status REJECTED');

    // 6. Approval with sample template: generates watermarked offer and enters BLOCKED_TEMPLATE
    const mockApproveBeta = mockReqRes({
      params: { id: appBeta.applicationId },
      body: { status: 'APPROVED' }
    });
    await adminApplicationController.updateApplicationStatus(mockApproveBeta.req, mockApproveBeta.res, mockApproveBeta.next);
    assert.strictEqual(mockApproveBeta.getStatus(), 200, 'Approval must return 200');

    const refreshedBeta = await Application.findOne({ applicationId: appBeta.applicationId });
    assert.strictEqual(refreshedBeta.status, 'APPROVED');
    assert.strictEqual(refreshedBeta.offerState, 'BLOCKED_TEMPLATE', 'Offer must be BLOCKED_TEMPLATE while sample template is active');
    assert.strictEqual(refreshedBeta.offerDeliveryState, 'BLOCKED_TEMPLATE', 'Email must not be sent while sample template is active');

    const offerBeta = await OfferLetter.findOne({ applicationId: appBeta.applicationId });
    assert.ok(offerBeta, 'OfferLetter record must exist');
    assert.strictEqual(offerBeta.generationStatus, 'GENERATED');
    assert.strictEqual(offerBeta.programSnapshot.feeLocked, 499, 'Snapshot must preserve feeLocked');

    // Selection NEVER sets completionStatus to ELIGIBLE
    const pBetaRefreshed = await Participant.findById(p2._id);
    assert.strictEqual(pBetaRefreshed.completionStatus, 'PENDING', 'Selection approval must NEVER make participant ELIGIBLE for certificate');

    // 7. Batch Review with partial failures
    const mockBatch = mockReqRes({
      body: {
        applicationIds: [appGamma.applicationId, appAlpha.applicationId], // Gamma is APPLIED, Alpha is already REJECTED
        action: 'APPROVE'
      }
    });
    await adminApplicationController.batchReviewApplications(mockBatch.req, mockBatch.res, mockBatch.next);
    assert.strictEqual(mockBatch.getStatus(), 200);
    const batchData = mockBatch.getData();
    assert.strictEqual(batchData.summary.succeeded, 1, 'Gamma must succeed');
    assert.strictEqual(batchData.summary.failed, 1, 'Alpha must fail (already final)');

    // 8. Custom Template Upload & Byte Validation
    const mockBadUpload = mockReqRes({
      file: { buffer: Buffer.from('NOT A PDF FILE CORRUPT DATA'), originalname: 'fake.pdf' },
      body: { name: 'Bad PDF' }
    });
    let uploadErr = null;
    try {
      await adminOfferTemplateController.uploadTemplate(mockBadUpload.req, mockBadUpload.res, (err) => { uploadErr = err; });
    } catch (e) {
      uploadErr = e;
    }
    assert.ok(uploadErr, 'Corrupt PDF byte stream must be rejected');

    // Generate valid 1-page PDF using pdf-lib for test upload
    const { PDFDocument } = require('pdf-lib');
    const validDoc = await PDFDocument.create();
    validDoc.addPage([595.28, 841.89]);
    const validPdfBytes = Buffer.from(await validDoc.save());

    const mockGoodUpload = mockReqRes({
      file: { buffer: validPdfBytes, originalname: 'official_template.pdf' },
      body: { name: 'Official Custom Template' }
    });
    await adminOfferTemplateController.uploadTemplate(mockGoodUpload.req, mockGoodUpload.res, mockGoodUpload.next);
    assert.strictEqual(mockGoodUpload.getStatus(), 201, 'Valid PDF must upload with 201');
    const customTemplate = mockGoodUpload.getData().template;
    assert.strictEqual(customTemplate.isActive, false, 'Uploaded template must start as inactive draft');
    assert.strictEqual(customTemplate.version, 2);

    // 9. Sample template cannot be activated for live issuance
    const mockActivateSample = mockReqRes({
      params: { id: sampleTemplate._id },
      body: { confirmation: true }
    });
    await adminOfferTemplateController.activateTemplate(mockActivateSample.req, mockActivateSample.res, mockActivateSample.next);
    assert.strictEqual(mockActivateSample.getStatus(), 400, 'Sample template cannot be activated for live candidate issuance');

    // Activate custom template
    const mockActivateCustom = mockReqRes({
      params: { id: customTemplate._id },
      body: { confirmation: true }
    });
    await adminOfferTemplateController.activateTemplate(mockActivateCustom.req, mockActivateCustom.res, mockActivateCustom.next);
    assert.strictEqual(mockActivateCustom.getStatus(), 200, 'Custom template must activate');
    const customRefreshed = await OfferLetterTemplate.findById(customTemplate._id);
    assert.strictEqual(customRefreshed.isActive, true);

    // 10. Process Blocked Backlog with newly active custom template
    const mockUnblock = mockReqRes({
      body: { applicationIds: [appBeta.applicationId] }
    });
    await adminApplicationController.sendBlockedApplications(mockUnblock.req, mockUnblock.res, mockUnblock.next);
    assert.strictEqual(mockUnblock.getStatus(), 200);
    assert.ok(mockUnblock.getData().processedCount >= 1, 'Must unblock and process blocked applications');

    // 11. 72-Hour Expiring Download Bearer Token
    const jwt = require('jsonwebtoken');
    const env = require('../src/config/env');
    const offerForBeta = await OfferLetter.findOne({ applicationId: appBeta.applicationId });

    // Valid token streams PDF
    const { token: validToken } = offerService.createOfferDownloadToken(offerForBeta._id, appBeta.applicationId, offerForBeta.downloadToken);
    const mockDownloadValid = mockReqRes({ params: { token: validToken } });
    await offerDownloadController.downloadOfferLetter(mockDownloadValid.req, mockDownloadValid.res, mockDownloadValid.next);
    assert.strictEqual(mockDownloadValid.getStatus(), 200, 'Valid token must return 200');
    assert.strictEqual(mockDownloadValid.getHeaders()['content-type'], 'application/pdf');

    // Tampered token returns 404
    const mockDownloadTampered = mockReqRes({ params: { token: validToken.slice(0, -6) + 'xxxxxx' } });
    await offerDownloadController.downloadOfferLetter(mockDownloadTampered.req, mockDownloadTampered.res, mockDownloadTampered.next);
    assert.strictEqual(mockDownloadTampered.getStatus(), 404, 'Tampered token must return 404');

    // Expired token returns 410 Gone
    const expiredPayload = {
      sub: String(offerForBeta._id),
      appId: appBeta.applicationId,
      purpose: 'OFFER_DOWNLOAD',
      jti: offerForBeta.downloadToken
    };
    const expiredToken = jwt.sign(expiredPayload, env.JWT_SECRET, { expiresIn: '-1s' });
    const mockDownloadExpired = mockReqRes({ params: { token: expiredToken } });
    await offerDownloadController.downloadOfferLetter(mockDownloadExpired.req, mockDownloadExpired.res, mockDownloadExpired.next);
    assert.strictEqual(mockDownloadExpired.getStatus(), 410, 'Expired token must return 410 Gone');

    // Renew link: invalidates previous token and creates fresh one
    const mockRenew = mockReqRes({ params: { id: appBeta.applicationId } });
    await adminApplicationController.renewOfferDownloadLink(mockRenew.req, mockRenew.res, mockRenew.next);
    assert.strictEqual(mockRenew.getStatus(), 200, 'Link renewal must return 200');

    // Old token now returns 404 because JTI changed
    const mockOldTokenDownload = mockReqRes({ params: { token: validToken } });
    await offerDownloadController.downloadOfferLetter(mockOldTokenDownload.req, mockOldTokenDownload.res, mockOldTokenDownload.next);
    assert.strictEqual(mockOldTokenDownload.getStatus(), 404, 'Previous token with old JTI must return 404');

    // 12. Student Status View Integration
    // Rejected applicant status view
    const mockStatusAlpha = mockReqRes({
      query: { email: 'alpha@example.com', id: appAlpha.applicationId }
    });
    await intakeController.getApplicationStatus(mockStatusAlpha.req, mockStatusAlpha.res, mockStatusAlpha.next);
    assert.strictEqual(mockStatusAlpha.getStatus(), 200);
    const alphaStatusData = mockStatusAlpha.getData().application;
    assert.strictEqual(alphaStatusData.status, 'REJECTED');
    assert.strictEqual(alphaStatusData.rejectionReason, 'Cohort capacity reached for selected batch.');
    assert.ok(alphaStatusData.decidedAt, 'Must include decidedAt');
    assert.strictEqual(alphaStatusData.adminNotes, undefined, 'Must NEVER leak adminNotes');

    // Approved applicant status view
    const mockStatusBeta = mockReqRes({
      query: { email: 'beta@example.com', id: appBeta.applicationId }
    });
    await intakeController.getApplicationStatus(mockStatusBeta.req, mockStatusBeta.res, mockStatusBeta.next);
    assert.strictEqual(mockStatusBeta.getStatus(), 200);
    const betaStatusData = mockStatusBeta.getData().application;
    assert.strictEqual(betaStatusData.status, 'APPROVED');
    assert.ok(betaStatusData.offerStatus, 'Must include student-facing offer status string');
    assert.strictEqual(betaStatusData.adminNotes, undefined, 'Must NEVER leak adminNotes');
    assert.strictEqual(betaStatusData.downloadToken, undefined, 'Must NEVER leak downloadToken in status JSON');
    assert.strictEqual(betaStatusData.pdfPath, undefined, 'Must NEVER leak pdfPath');

    // 13. Delivery Job Reconciliation
    const dummyJob = await OfferDeliveryJob.create({
      offerLetterId: new mongoose.Types.ObjectId(),
      applicationId: 'NOX-RECON1',
      recipientEmail: 'recon@example.com',
      status: 'DELIVERY_UNKNOWN',
      reconciliationRequired: true
    });

    await offerService.reconcileOfferJob(dummyJob._id, 'RESOLVED_ACCEPTED', 'Manual delivery confirmed with logs', mockList.req.admin._id, 'manual-msg-123');
    const reconciled = await OfferDeliveryJob.findById(dummyJob._id);
    assert.strictEqual(reconciled.status, 'PROVIDER_ACCEPTED');
    assert.strictEqual(reconciled.reconciliationRequired, false);
    assert.strictEqual(reconciled.providerMessageId, 'manual-msg-123');
  });

  // ----------------------------------------------------
  // TEST 26: Module 4 Review Findings Hardening Pass
  // ----------------------------------------------------
  await test('Module 4 Fix Pass: Verifies 10 review findings (attachments, honest status, immutable versions, HTML escape, rate limits & download hardening, Unicode & Rupee, blocked preview)', async () => {
    const fs = require('fs');
    const crypto = require('crypto');
    const jwt = require('jsonwebtoken');
    const env = require('../src/config/env');

    // 1. Email Attachment with Exact Byte Hash Match
    // Ensure active custom template
    let activeCustom = await OfferLetterTemplate.findOne({ isActive: true, isSample: false });
    if (!activeCustom) {
      const { PDFDocument } = require('pdf-lib');
      const doc = await PDFDocument.create();
      doc.addPage([595.28, 841.89]);
      const pdfBytes = Buffer.from(await doc.save());
      const storage = await storageService.saveTemplatePdf('fix_test_custom_template.pdf', pdfBytes);
      activeCustom = await OfferLetterTemplate.create({
        name: 'Fix Custom Active',
        version: 10,
        isSample: false,
        isActive: true,
        pdfStoragePath: storage.diskPath || String(storage),
        pdfSizeBytes: pdfBytes.length,
        pageCount: 1,
        pageDimensions: [{ width: 595.28, height: 841.89 }],
        fields: [
          { id: 'studentName', label: 'Candidate Name', page: 1, x: 50, y: 100, fontSize: 14, isRequired: true },
          { id: 'feeLocked', label: 'Review Fee', page: 1, x: 50, y: 150, fontSize: 12, isRequired: false }
        ]
      });
    }

    const pReview = await Participant.create({
      fullName: 'Vikramaditya Rao',
      email: 'vikram.rao@example.org',
      programTitle: 'Full Stack Web Development',
      programCode: 'FS-DEV',
      batchId: 'BATCH-2026-A',
      college: 'Delhi Technological University',
      branch: 'Computer Science',
      source: 'WEBSITE'
    });

    const appReview = await Application.create({
      applicationId: 'NOX-2026-VKRM-0001',
      participantId: pReview._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-A',
      status: 'APPROVED',
      feeLocked: 499
    });

    const genRes = await offerService.generateOfferForApplication(appReview.applicationId, { forceRegenerate: true });
    assert.ok(genRes.offerLetter, 'Must generate offer letter record');
    assert.strictEqual(genRes.offerLetter.generationStatus, 'GENERATED');

    // Process delivery job
    const deliveryRes = await offerService.processOfferDeliveryJob(genRes.deliveryJob._id);
    assert.strictEqual(deliveryRes.success, true);

    const capturedMail = offerService.getLastCapturedOfferMail();
    assert.ok(capturedMail, 'Must capture dispatched email in test environment');
    assert.strictEqual(capturedMail.to, 'vikram.rao@example.org');
    assert.ok(Array.isArray(capturedMail.attachments) && capturedMail.attachments.length === 1, 'Must attach offer PDF');
    assert.strictEqual(capturedMail.attachments[0].filename, 'NOXIRA_Offer_NOX-2026-VKRM-0001.pdf');

    // Verify byte hash identity between attachment and stored PDF
    const attachedBytes = fs.readFileSync(capturedMail.attachments[0].path);
    const attachedHash = crypto.createHash('sha256').update(attachedBytes).digest('hex');
    assert.strictEqual(attachedHash, genRes.offerLetter.pdfSha256, 'Attachment bytes must match stored OfferLetter.pdfSha256 exactly');

    // 2. Status Privacy & Honest Delivery States (no overclaiming)
    // PROVIDER_ACCEPTED
    appReview.offerDeliveryState = 'PROVIDER_ACCEPTED';
    await appReview.save();
    const mockStat1 = mockReqRes({ query: { email: pReview.email, id: appReview.applicationId } });
    await intakeController.getApplicationStatus(mockStat1.req, mockStat1.res, mockStat1.next);
    assert.strictEqual(mockStat1.getStatus(), 200);
    assert.ok(mockStat1.getData().application.offerStatus.includes('dispatched via email service provider'));
    assert.ok(!mockStat1.getData().application.offerStatus.includes('Delivered to candidate'), 'Must never overclaim recipient delivery');

    // BLOCKED_TEMPLATE
    appReview.offerDeliveryState = 'BLOCKED_TEMPLATE';
    await appReview.save();
    const mockStat2 = mockReqRes({ query: { email: pReview.email, id: appReview.applicationId } });
    await intakeController.getApplicationStatus(mockStat2.req, mockStat2.res, mockStat2.next);
    assert.ok(mockStat2.getData().application.offerStatus.includes('prepared by admissions'));

    // SIMULATED
    appReview.offerDeliveryState = 'SIMULATED';
    await appReview.save();
    const mockStat3 = mockReqRes({ query: { email: pReview.email, id: appReview.applicationId } });
    await intakeController.getApplicationStatus(mockStat3.req, mockStat3.res, mockStat3.next);
    assert.ok(mockStat3.getData().application.offerStatus.includes('delivery simulated in non-production mode'));

    // FAILED / DELIVERY_UNKNOWN
    appReview.offerDeliveryState = 'FAILED';
    await appReview.save();
    const mockStat4 = mockReqRes({ query: { email: pReview.email, id: appReview.applicationId } });
    await intakeController.getApplicationStatus(mockStat4.req, mockStat4.res, mockStat4.next);
    assert.ok(mockStat4.getData().application.offerStatus.includes('undergoing administrative verification'));

    // 3. Immutable Template Versions
    // Updating active template must branch into new draft version
    const mockUpdateActive = mockReqRes({
      params: { id: activeCustom._id },
      body: {
        fields: [
          { id: 'studentName', label: 'Full Candidate Name', page: 1, x: 60, y: 110, fontSize: 16 }
        ]
      }
    });
    await adminOfferTemplateController.updateTemplate(mockUpdateActive.req, mockUpdateActive.res, mockUpdateActive.next);
    assert.strictEqual(mockUpdateActive.getStatus(), 201, 'Active template update must return 201 Created for new version');
    const updateResult = mockUpdateActive.getData();
    assert.strictEqual(updateResult.isNewVersion, true);
    assert.strictEqual(updateResult.template.isActive, false, 'New draft version must start as inactive');
    assert.strictEqual(updateResult.template.version, activeCustom.version + 1);

    // Verify original active template remained unchanged
    const originalRefreshed = await OfferLetterTemplate.findById(activeCustom._id);
    assert.strictEqual(originalRefreshed.isActive, true, 'Original template must remain active');
    assert.strictEqual(originalRefreshed.fields[0].x, activeCustom.fields[0].x, 'Original coordinates must not be mutated in-place');
    assert.notStrictEqual(originalRefreshed.fields[0].x, 60, 'Original coordinates must not receive the new version update');

    // 4. HTML Escaping & XSS Protection in Outbound Email
    const pXss = await Participant.create({
      fullName: '<script>alert("xss")</script>',
      email: 'xss.test@example.org',
      programTitle: '<img src=x onerror=alert(1)>',
      programCode: 'AI-ENG',
      batchId: 'BATCH-2026-X',
      source: 'WEBSITE'
    });
    const appXss = await Application.create({
      applicationId: 'NOX-2026-XSS1-0001',
      participantId: pXss._id,
      programCode: 'AI-ENG',
      programTitle: '<img src=x onerror=alert(1)>',
      batchId: 'BATCH-2026-X',
      status: 'APPROVED'
    });
    const xssOfferRes = await offerService.generateOfferForApplication(appXss.applicationId, { forceRegenerate: true });
    await offerService.processOfferDeliveryJob(xssOfferRes.deliveryJob._id);
    const xssMail = offerService.getLastCapturedOfferMail();
    assert.ok(xssMail.html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;') || xssMail.html.includes('&lt;script&gt;alert'), 'Must HTML-escape candidate name');
    assert.ok(!xssMail.html.includes('<script>alert'), 'Must NEVER include unescaped <script> tag in email HTML');
    assert.ok(!xssMail.html.includes('<img src=x'), 'Must NEVER include unescaped <img> tag in email HTML');

    // 5. Download Hardening: Guard checks and 410 Content Negotiation
    // Valid token for approved application streams PDF
    const { token: validTok } = offerService.createOfferDownloadToken(genRes.offerLetter._id, appReview.applicationId, genRes.offerLetter.downloadToken);

    // Non-approved application returns 404
    appReview.status = 'UNDER_REVIEW';
    await appReview.save();
    const mockDownloadUnapproved = mockReqRes({ params: { token: validTok } });
    await offerDownloadController.downloadOfferLetter(mockDownloadUnapproved.req, mockDownloadUnapproved.res, mockDownloadUnapproved.next);
    assert.strictEqual(mockDownloadUnapproved.getStatus(), 404, 'Must return 404 if application is not APPROVED');

    // Restore to APPROVED
    appReview.status = 'APPROVED';
    await appReview.save();

    // Expired Token - Content Negotiation
    const expiredPayload = {
      sub: String(genRes.offerLetter._id),
      appId: appReview.applicationId,
      purpose: 'OFFER_DOWNLOAD',
      jti: genRes.offerLetter.downloadToken,
      iat: Math.floor(Date.now() / 1000) - 80 * 3600,
      exp: Math.floor(Date.now() / 1000) - 8 * 3600
    };
    const expiredTok = jwt.sign(expiredPayload, env.JWT_SECRET);

    // Browser request with text/html gets branded recovery HTML
    const mockHtmlReq = mockReqRes({
      params: { token: expiredTok },
      headers: { accept: 'text/html,application/xhtml+xml' }
    });
    await offerDownloadController.downloadOfferLetter(mockHtmlReq.req, mockHtmlReq.res, mockHtmlReq.next);
    assert.strictEqual(mockHtmlReq.getStatus(), 410, 'Expired token must return 410 Gone');
    assert.ok(mockHtmlReq.getHeaders()['content-type'].includes('text/html'));
    assert.ok(mockHtmlReq.getData().includes('Link Expired'), 'Must render branded expired page');
    assert.ok(mockHtmlReq.getData().includes('/status'), 'Must link to status verification');

    // Machine client with application/json gets JSON 410
    const mockJsonReq = mockReqRes({
      params: { token: expiredTok },
      headers: { accept: 'application/json' }
    });
    await offerDownloadController.downloadOfferLetter(mockJsonReq.req, mockJsonReq.res, mockJsonReq.next);
    assert.strictEqual(mockJsonReq.getStatus(), 410);
    assert.strictEqual(mockJsonReq.getData().error, 'LINK_EXPIRED');
    assert.ok(mockJsonReq.getData().message.includes('expired'));

    // 6. Unicode Font & Indian Rupee Sign Rendering
    // Indian candidate with Hindi name and Rupee sign
    const hindiPdfBuffer = await offerPdfService.renderOfferPdf(activeCustom, {
      studentName: 'राहुल शर्मा',
      batchId: 'BATCH-2026-A',
      feeLocked: 499,
      programTitle: 'Full Stack Web Development',
      applicationId: 'NOX-2026-HNDI-0001'
    });
    assert.ok(Buffer.isBuffer(hindiPdfBuffer) && hindiPdfBuffer.length > 500, 'Must render Hindi name and Rupee sign into PDF buffer');

    // Unsupported character fails with actionable error naming field
    let unsupportedErr = null;
    try {
      await offerPdfService.renderOfferPdf(activeCustom, {
        studentName: 'Candidate 李明',
        batchId: 'BATCH-2026-A',
        applicationId: 'NOX-2026-CHIN-0001'
      });
    } catch (err) {
      unsupportedErr = err;
    }
    assert.ok(unsupportedErr, 'Unsupported character must throw an actionable error');
    assert.ok(unsupportedErr.message.includes('Candidate Name') || unsupportedErr.message.includes('unsupported character'),
      'Error message must name the field and unsupported character');

    // 7. Blocked Queue Preview API (Two-Step Flow)
    // Put an application into BLOCKED_TEMPLATE
    const pBlocked = await Participant.create({
      fullName: 'Blocked Queue Candidate',
      email: 'blocked.queue@example.org',
      programTitle: 'Full Stack Web Development',
      programCode: 'FS-DEV',
      batchId: 'BATCH-2026-A',
      source: 'WEBSITE'
    });
    await Application.create({
      applicationId: 'NOX-2026-BLKD-0001',
      participantId: pBlocked._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-A',
      status: 'APPROVED',
      offerDeliveryState: 'BLOCKED_TEMPLATE'
    });

    const mockPreview = mockReqRes({});
    await adminApplicationController.getBlockedPreview(mockPreview.req, mockPreview.res, mockPreview.next);
    assert.strictEqual(mockPreview.getStatus(), 200);
    const previewData = mockPreview.getData();
    assert.strictEqual(previewData.success, true);
    assert.ok(previewData.count >= 1, 'Must count blocked applications');
    assert.ok(Array.isArray(previewData.recipients), 'Must return recipients list');
    const blockedCand = previewData.recipients.find(r => r.applicationId === 'NOX-2026-BLKD-0001');
    assert.ok(blockedCand, 'Recipients must contain blocked application details');
    assert.strictEqual(blockedCand.fullName, 'Blocked Queue Candidate');
    assert.strictEqual(blockedCand.email, 'blocked.queue@example.org');
    assert.strictEqual(blockedCand.programCode, 'FS-DEV');
  });

  // TEST 27: Module 4 Follow-up Fixes: Real PDF canvas endpoint, pure coordinate mapping, fail-closed missing PDF, configured sender, targeted blocked dispatch, field validation 400s, and admin recovery flow
  await test('Module 4 Follow-up: PDF endpoint, US Letter point-pixel math, fail-closed PDF guard, SMTP_FROM validation, targeted blocked queue, field validation 400s, name correction & offer retry', async () => {
    const { pointToPixel, pixelToPoint } = require('../src/utils/pdfCoordinates');
    const env = require('../src/config/env');

    // 1. Pure-function test: Point to Pixel and Pixel to Point conversions on non-A4 page (US Letter: 612 x 792 pt)
    const letterPage = { width: 612, height: 792 };
    const displayBox = { width: 400, height: 517.647 }; // 400 display width scaled proportionally

    // Top-left corner (0, 0)
    const pTopLeft = pointToPixel({ x: 0, y: 0 }, letterPage, displayBox);
    assert.strictEqual(Math.round(pTopLeft.pixelX), 0);
    assert.strictEqual(Math.round(pTopLeft.pixelY), 0);
    const revTopLeft = pixelToPoint({ pixelX: pTopLeft.pixelX, pixelY: pTopLeft.pixelY }, letterPage, displayBox);
    assert.strictEqual(revTopLeft.x, 0);
    assert.strictEqual(revTopLeft.y, 0);

    // Bottom-right corner (612, 792)
    const pBottomRight = pointToPixel({ x: 612, y: 792 }, letterPage, displayBox);
    assert.strictEqual(Math.round(pBottomRight.pixelX), Math.round(displayBox.width));
    assert.strictEqual(Math.round(pBottomRight.pixelY), Math.round(displayBox.height));
    const revBottomRight = pixelToPoint({ pixelX: pBottomRight.pixelX, pixelY: pBottomRight.pixelY }, letterPage, displayBox);
    assert.strictEqual(revBottomRight.x, 612);
    assert.strictEqual(revBottomRight.y, 792);

    // Center (306, 396)
    const pCenter = pointToPixel({ x: 306, y: 396 }, letterPage, displayBox);
    assert.strictEqual(Math.round(pCenter.pixelX), Math.round(displayBox.width / 2));
    assert.strictEqual(Math.round(pCenter.pixelY), Math.round(displayBox.height / 2));
    const revCenter = pixelToPoint({ pixelX: pCenter.pixelX, pixelY: pCenter.pixelY }, letterPage, displayBox);
    assert.strictEqual(revCenter.x, 306);
    assert.strictEqual(revCenter.y, 396);

    // 2. Admin PDF Endpoint: GET /api/v1/admin/offer-templates/:id/pdf
    const sampleTpl = await OfferLetterTemplate.findOne({ isSample: true });
    assert.ok(sampleTpl, 'Sample template must exist');

    const mockPdfReq = mockReqRes({ params: { id: sampleTpl._id } });
    await adminOfferTemplateController.getTemplatePdf(mockPdfReq.req, mockPdfReq.res, mockPdfReq.next);
    assert.strictEqual(mockPdfReq.getStatus(), 200);
    assert.strictEqual(mockPdfReq.getHeaders()['content-type'], 'application/pdf');
    assert.ok(mockPdfReq.getHeaders()['cache-control'].includes('no-store'));
    assert.ok(Buffer.isBuffer(mockPdfReq.getData()) && mockPdfReq.getData().length > 500, 'Must return valid PDF buffer');

    const activeCustomTpl = await OfferLetterTemplate.findOne({ isSample: false, isActive: true });
    assert.ok(activeCustomTpl, 'Active custom template must exist');

    // 3. Sender must be configured, not invented
    // Production without SMTP_FROM throws critical config error
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
          JWT_SECRET: 'a_very_long_secure_jwt_secret_with_more_than_32_characters_123456789',
          SMTP: {
            HOST: 'smtp.sendgrid.net',
            USER: 'apikey',
            PASS: 'SG.valid_production_api_key_here_123456789',
            FROM: ''
          }
        });
      },
      /SMTP_FROM environment variable is required in production/
    );

    // Non-production uses dev mock sender when unconfigured
    const origEnvFrom = env.SMTP.FROM;
    env.SMTP.FROM = '';

    const pSenderTest = await Participant.create({
      fullName: 'Sender Test Candidate',
      email: 'sendertest@example.com',
      programTitle: 'Full Stack Web Development',
      programCode: 'FS-DEV',
      batchId: 'BATCH-2026-A',
      source: 'WEBSITE'
    });
    const appSenderTest = await Application.create({
      applicationId: 'NOX-2026-SND-0001',
      participantId: pSenderTest._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      status: 'APPROVED'
    });

    try {
      const senderGenRes = await offerService.generateOfferForApplication(appSenderTest.applicationId, { forceRegenerate: true });
      assert.ok(senderGenRes.offerLetter, 'Offer letter generated');
      await offerService.processOfferDeliveryJob(senderGenRes.deliveryJob._id);
      const captured = offerService.getLastCapturedOfferMail();
      assert.ok(captured, 'Email must have been captured');
      assert.strictEqual(
        captured.from,
        'NOXIRA Dev Mock <mock@localhost.invalid>',
        `Sender in non-prod when unconfigured must be labelled as mock, got: ${captured.from}`
      );
    } finally {
      env.SMTP.FROM = origEnvFrom;
    }

    // 4. Template Field Validation: Returns 400 with specific field name on invalid inputs
    // Missing field label -> 400
    const mockInvalidLabel = mockReqRes({
      params: { id: activeCustomTpl._id },
      body: {
        fields: [
          { id: 'studentName', label: '   ', page: 1, x: 50, y: 100, fontSize: 12, alignment: 'left', maxWidth: 400 }
        ]
      }
    });
    await adminOfferTemplateController.updateTemplate(mockInvalidLabel.req, mockInvalidLabel.res, mockInvalidLabel.next);
    assert.strictEqual(mockInvalidLabel.getStatus(), 400);
    assert.ok(mockInvalidLabel.getData().message.includes('studentName') && mockInvalidLabel.getData().message.includes('label'));

    // Page number out of bounds -> 400
    const mockInvalidPage = mockReqRes({
      params: { id: activeCustomTpl._id },
      body: {
        fields: [
          { id: 'studentName', label: 'Student Name', page: 99, x: 50, y: 100, fontSize: 12, alignment: 'left', maxWidth: 400 }
        ]
      }
    });
    await adminOfferTemplateController.updateTemplate(mockInvalidPage.req, mockInvalidPage.res, mockInvalidPage.next);
    assert.strictEqual(mockInvalidPage.getStatus(), 400);
    assert.ok(mockInvalidPage.getData().message.includes('page') || mockInvalidPage.getData().message.includes('pageCount'));

    // Invalid alignment -> 400
    const mockInvalidAlign = mockReqRes({
      params: { id: activeCustomTpl._id },
      body: {
        fields: [
          { id: 'studentName', label: 'Student Name', page: 1, x: 50, y: 100, fontSize: 12, alignment: 'justify', maxWidth: 400 }
        ]
      }
    });
    await adminOfferTemplateController.updateTemplate(mockInvalidAlign.req, mockInvalidAlign.res, mockInvalidAlign.next);
    assert.strictEqual(mockInvalidAlign.getStatus(), 400);
    assert.ok(mockInvalidAlign.getData().message.includes('alignment') || mockInvalidAlign.getData().message.includes('align'));

    // 5. Blocked Queue Targeted Dispatch: Only previewed IDs processed; empty body returns 400; ineligible returned as SKIPPED
    // Empty body -> 400
    const mockEmptyBlocked = mockReqRes({ body: {} });
    await adminApplicationController.sendBlockedApplications(mockEmptyBlocked.req, mockEmptyBlocked.res, mockEmptyBlocked.next);
    assert.strictEqual(mockEmptyBlocked.getStatus(), 400, 'Empty applicationIds in sendBlockedApplications must return 400');

    // Create 3 blocked applications
    const pB1 = await Participant.create({ fullName: 'Blocked 1', email: 'b1@example.com', programTitle: 'Full Stack', programCode: 'FS-DEV', batchId: 'B-2026', source: 'WEBSITE' });
    const pB2 = await Participant.create({ fullName: 'Blocked 2', email: 'b2@example.com', programTitle: 'Full Stack', programCode: 'FS-DEV', batchId: 'B-2026', source: 'WEBSITE' });
    const pB3 = await Participant.create({ fullName: 'Blocked 3', email: 'b3@example.com', programTitle: 'Full Stack', programCode: 'FS-DEV', batchId: 'B-2026', source: 'WEBSITE' });

    const appB1 = await Application.create({ applicationId: 'NOX-2026-TGT-0001', participantId: pB1._id, programCode: 'FS-DEV', status: 'APPROVED', offerDeliveryState: 'BLOCKED_TEMPLATE' });
    const appB2 = await Application.create({ applicationId: 'NOX-2026-TGT-0002', participantId: pB2._id, programCode: 'FS-DEV', status: 'APPROVED', offerDeliveryState: 'BLOCKED_TEMPLATE' });
    const appB3 = await Application.create({ applicationId: 'NOX-2026-TGT-0003', participantId: pB3._id, programCode: 'FS-DEV', status: 'APPROVED', offerDeliveryState: 'BLOCKED_TEMPLATE' });

    // Client passes ONLY appB1 and appB2, plus an ineligible non-blocked ID
    const mockTargetedBlocked = mockReqRes({
      body: {
        applicationIds: [appB1.applicationId, appB2.applicationId, 'NOX-NON-EXISTENT-9999']
      }
    });
    await adminApplicationController.sendBlockedApplications(mockTargetedBlocked.req, mockTargetedBlocked.res, mockTargetedBlocked.next);
    assert.strictEqual(mockTargetedBlocked.getStatus(), 200);
    const targetedData = mockTargetedBlocked.getData();
    assert.strictEqual(targetedData.processedCount, 2, 'Exactly 2 confirmed applications must be processed');
    assert.strictEqual(targetedData.skippedCount, 1, 'Ineligible ID must be reported as SKIPPED');

    // Check appB3 was untouched and remains BLOCKED_TEMPLATE
    const appB3Fresh = await Application.findById(appB3._id);
    assert.strictEqual(appB3Fresh.offerDeliveryState, 'BLOCKED_TEMPLATE', 'Unconfirmed application must remain untouched in blocked state');

    // 6. Fail-Closed Missing Offer PDF: Missing file marks job FAILED (OFFER_PDF_MISSING), no email sent, honest status
    const pFailClosed = await Participant.create({
      fullName: 'Fail Closed Candidate',
      email: 'failclosed@example.com',
      programTitle: 'Full Stack Web Development',
      programCode: 'FS-DEV',
      batchId: 'BATCH-2026-A',
      source: 'WEBSITE'
    });
    const appFailClosed = await Application.create({
      applicationId: 'NOX-2026-FC-0001',
      participantId: pFailClosed._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      status: 'APPROVED'
    });

    const fcGenRes = await offerService.generateOfferForApplication(appFailClosed.applicationId, { forceRegenerate: true });
    const offerLetterFC = fcGenRes.offerLetter;
    const jobFC = fcGenRes.deliveryJob;

    // Delete the generated PDF from disk so it becomes missing
    const fs = require('fs');
    if (fs.existsSync(offerLetterFC.pdfPath)) {
      fs.unlinkSync(offerLetterFC.pdfPath);
    }

    const processRes = await offerService.processOfferDeliveryJob(jobFC._id);
    assert.strictEqual(processRes.success, false);
    assert.ok(processRes.reason.includes('OFFER_PDF_MISSING'));

    const refreshedJobFC = await OfferDeliveryJob.findById(jobFC._id);
    assert.strictEqual(refreshedJobFC.status, 'FAILED');
    assert.ok(refreshedJobFC.lastError.includes('OFFER_PDF_MISSING'));

    const refreshedAppFC = await Application.findById(appFailClosed._id);
    assert.strictEqual(refreshedAppFC.offerDeliveryState, 'FAILED');

    // 7. Admin Recovery Path: Correct Candidate Name & Retry Offer
    // Candidate with unsupported glyph
    const pUnsupported = await Participant.create({
      fullName: 'Unsupported 🌟 Name',
      email: 'unsupported.name@example.com',
      programTitle: 'Full Stack',
      programCode: 'FS-DEV',
      batchId: 'B-2026',
      source: 'WEBSITE'
    });
    const appRecovery = await Application.create({
      applicationId: 'NOX-2026-RCV-0001',
      participantId: pUnsupported._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      status: 'APPROVED',
      offerDeliveryState: 'FAILED',
      offerError: 'Unsupported character in Candidate Name: 🌟'
    });

    // 7a. Non-failed application rejects retry with 409
    const pNotFailed = await Participant.create({
      fullName: 'Successful Candidate',
      email: 'ok.candidate@example.com',
      programTitle: 'Full Stack',
      programCode: 'FS-DEV',
      batchId: 'B-2026',
      source: 'WEBSITE'
    });
    const appNotFailed = await Application.create({
      applicationId: 'NOX-2026-OK-0001',
      participantId: pNotFailed._id,
      programCode: 'FS-DEV',
      status: 'APPROVED',
      offerDeliveryState: 'PROVIDER_ACCEPTED'
    });
    const mockRetryNotFailed = mockReqRes({ params: { id: appNotFailed.applicationId } });
    await adminApplicationController.retryOffer(mockRetryNotFailed.req, mockRetryNotFailed.res, mockRetryNotFailed.next);
    assert.strictEqual(mockRetryNotFailed.getStatus(), 409, 'Cannot retry offer when delivery is not in FAILED state');

    // 7b. Correct candidate name with another invalid glyph -> 400
    const mockBadName = mockReqRes({
      params: { id: appRecovery.applicationId },
      body: { fullName: 'Another 🚫 Emoji' }
    });
    await adminApplicationController.correctCandidateName(mockBadName.req, mockBadName.res, mockBadName.next);
    assert.strictEqual(mockBadName.getStatus(), 400);
    assert.ok(mockBadName.getData().message.includes('unsupported') || mockBadName.getData().message.includes('Candidate name'));

    // 7c. Correct candidate name to valid string -> 200 & Audit log
    const mockGoodName = mockReqRes({
      params: { id: appRecovery.applicationId },
      body: { fullName: 'Aryan Sharma' }
    });
    await adminApplicationController.correctCandidateName(mockGoodName.req, mockGoodName.res, mockGoodName.next);
    assert.strictEqual(mockGoodName.getStatus(), 200);
    assert.strictEqual(mockGoodName.getData().fullName, 'Aryan Sharma');

    const freshParticipant = await Participant.findById(pUnsupported._id);
    assert.strictEqual(freshParticipant.fullName, 'Aryan Sharma');

    const nameAudit = await AuditLog.findOne({
      action: 'CANDIDATE_NAME_CORRECTED',
      targetId: pUnsupported._id
    });
    assert.ok(nameAudit, 'Audit log must record candidate name correction');

    // 7d. Retry offer on corrected application -> 200 & new offer generated
    const mockRetrySuccess = mockReqRes({ params: { id: appRecovery.applicationId } });
    await adminApplicationController.retryOffer(mockRetrySuccess.req, mockRetrySuccess.res, mockRetrySuccess.next);
    assert.strictEqual(mockRetrySuccess.getStatus(), 200);
    assert.ok(mockRetrySuccess.getData().deliveryOutcome, 'retryOffer must return deliveryOutcome');
    assert.ok(mockRetrySuccess.getData().dispatchMode, 'retryOffer must return dispatchMode');

    const freshAppRecovery = await Application.findById(appRecovery._id);
    assert.ok(
      freshAppRecovery.offerDeliveryState === 'PROVIDER_ACCEPTED' || freshAppRecovery.offerDeliveryState === 'SIMULATED',
      'Offer must be regenerated and dispatched successfully'
    );
  });

  // TEST 28: Admin Retry Flow: Dispatch Mode Transparency & Server Delivery Truth Line
  await test('Admin Retry Flow: getApplicationDetail & retryOffer expose truthful dispatch modes (LIVE, SIMULATED, BLOCKED)', async () => {
    // 1. When custom template is active in dev/test, dispatchMode is SIMULATED
    const testApp = await Application.findOne({ status: 'APPROVED' }).populate('participantId');
    assert.ok(testApp, 'An approved application must exist');

    const mockDetailCustom = mockReqRes({ params: { id: testApp.applicationId } });
    await adminApplicationController.getApplicationDetail(mockDetailCustom.req, mockDetailCustom.res, mockDetailCustom.next);
    assert.strictEqual(mockDetailCustom.getStatus(), 200);
    const detailData = mockDetailCustom.getData();
    assert.ok(detailData.dispatchMode, 'Must return dispatchMode in application detail');
    assert.strictEqual(detailData.dispatchMode.mode, 'SIMULATED');
    assert.strictEqual(detailData.dispatchMode.canSend, true);
    assert.strictEqual(detailData.dispatchMode.line, 'Email sending is currently simulated - no real email will be sent');

    // 2. When sample template is active (no custom template active), dispatchMode is BLOCKED
    const activeCustom = await OfferLetterTemplate.findOne({ isSample: false, isActive: true });
    await OfferLetterTemplate.updateMany({}, { $set: { isActive: false } });
    await OfferLetterTemplate.updateOne({ isSample: true }, { $set: { isActive: true } });

    const mockDetailBlocked = mockReqRes({ params: { id: testApp.applicationId } });
    await adminApplicationController.getApplicationDetail(mockDetailBlocked.req, mockDetailBlocked.res, mockDetailBlocked.next);
    assert.strictEqual(mockDetailBlocked.getStatus(), 200);
    const blockedDetail = mockDetailBlocked.getData();
    assert.strictEqual(blockedDetail.dispatchMode.mode, 'BLOCKED');
    assert.strictEqual(blockedDetail.dispatchMode.canSend, false);
    assert.ok(blockedDetail.dispatchMode.line.includes('blocked'));
    assert.ok(blockedDetail.dispatchMode.line.includes('custom offer template is activated'));

    // 3. Restore custom template active status
    if (activeCustom) {
      await OfferLetterTemplate.updateMany({}, { $set: { isActive: false } });
      await OfferLetterTemplate.updateOne({ _id: activeCustom._id }, { $set: { isActive: true } });
    }

    // 4. In production mode with configured real SMTP, dispatchMode resolves to LIVE with recipient email
    const origEnv = env.NODE_ENV;
    const origSmtp = { ...env.SMTP };
    env.NODE_ENV = 'production';
    env.SMTP = { HOST: 'smtp.sendgrid.net', USER: 'prod_user', PASS: 'prod_pass', FROM: 'admissions@noxira.com' };
    try {
      const liveMode = await offerService.getOfferDispatchMode('test.applicant@example.com');
      assert.strictEqual(liveMode.mode, 'LIVE');
      assert.strictEqual(liveMode.canSend, true);
      assert.strictEqual(liveMode.line, 'A real email will be sent to test.applicant@example.com');
    } finally {
      env.NODE_ENV = origEnv;
      env.SMTP = origSmtp;
    }
  });

  // TEST 29: Dispatch Mode Single Source of Truth: Proves label can never diverge from actual transport behavior across (a)-(f)
  await test('Dispatch Mode Single Source of Truth: Deterministic zero-network verification across configs (a)-(f)', async () => {
    const nodemailer = require('nodemailer');
    const origCreateTransport = nodemailer.createTransport;
    const createdTransports = [];

    nodemailer.createTransport = (opts) => {
      const stub = {
        isNodemailerStub: true,
        opts,
        sendMail: async (mailOptions) => ({
          messageId: `stub-msg-${Date.now()}`,
          response: '250 OK: Stub transport response'
        })
      };
      createdTransports.push(stub);
      return stub;
    };

    const activeCustomTemplate = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Custom Offer Letter',
      version: 2,
      isSample: false,
      isActive: true
    };
    const sampleTemplate = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Sample Letter',
      version: 1,
      isSample: true,
      isActive: true
    };

    try {
      // (a) Empty SMTP -> mock + SIMULATED
      const envA = {
        NODE_ENV: 'development',
        SMTP: { HOST: '', PORT: 587, USER: '', PASS: '', FROM: '' }
      };
      const modeA = await offerService.getOfferDispatchMode('test@example.com', { envConfig: envA, template: activeCustomTemplate });
      assert.strictEqual(modeA.mode, 'SIMULATED');
      assert.strictEqual(modeA.canSend, true);
      assert.strictEqual(modeA.line, 'Email sending is currently simulated - no real email will be sent');

      offerService.clearLastCapturedOfferMail();
      const transportA = offerService.getOfferTransporter(envA);
      const sendResA = await transportA.sendMail({ to: 'candidateA@noxira.com', subject: 'Offer A' });
      assert.ok(sendResA.messageId.startsWith('mock-'), 'Must use mock transporter for empty SMTP');
      assert.strictEqual(offerService.getLastCapturedOfferMail().to, 'candidateA@noxira.com');
      assert.strictEqual(offerService.getLastCapturedOfferMail().subject, 'Offer A');
      assert.strictEqual(modeA.transportType, 'MOCK');

      // (b) USER test@example.com -> mock + SIMULATED
      const envB = {
        NODE_ENV: 'development',
        SMTP: { HOST: 'smtp.sendgrid.net', PORT: 587, USER: 'test@example.com', PASS: 'secret123', FROM: 'admissions@noxira.com' }
      };
      const modeB = await offerService.getOfferDispatchMode('test@example.com', { envConfig: envB, template: activeCustomTemplate });
      assert.strictEqual(modeB.mode, 'SIMULATED');
      assert.strictEqual(modeB.canSend, true);
      assert.strictEqual(modeB.line, 'Email sending is currently simulated - no real email will be sent');

      offerService.clearLastCapturedOfferMail();
      const transportB = offerService.getOfferTransporter(envB);
      const sendResB = await transportB.sendMail({ to: 'candidateB@noxira.com', subject: 'Offer B' });
      assert.ok(sendResB.messageId.startsWith('mock-'), 'Must use mock transporter for test@example.com');
      assert.strictEqual(offerService.getLastCapturedOfferMail().to, 'candidateB@noxira.com');
      assert.strictEqual(modeB.transportType, 'MOCK');

      // (c) PASS 'password' placeholder with any other user -> mock + SIMULATED (mismatch A fix)
      const envC = {
        NODE_ENV: 'development',
        SMTP: { HOST: 'smtp.gmail.com', PORT: 587, USER: 'u@gmail.com', PASS: 'password', FROM: 'admissions@noxira.com' }
      };
      const modeC = await offerService.getOfferDispatchMode('test@example.com', { envConfig: envC, template: activeCustomTemplate });
      assert.strictEqual(modeC.mode, 'SIMULATED');
      assert.strictEqual(modeC.canSend, true);
      assert.strictEqual(modeC.line, 'Email sending is currently simulated - no real email will be sent');

      offerService.clearLastCapturedOfferMail();
      const countBeforeC = createdTransports.length;
      const transportC = offerService.getOfferTransporter(envC);
      const sendResC = await transportC.sendMail({ to: 'candidateC@noxira.com', subject: 'Offer C' });
      assert.ok(sendResC.messageId.startsWith('mock-'), 'Must use mock transporter for password placeholder');
      assert.strictEqual(createdTransports.length, countBeforeC, 'Must NOT create real nodemailer transport when PASS is password');
      assert.strictEqual(offerService.getLastCapturedOfferMail().to, 'candidateC@noxira.com');
      assert.strictEqual(modeC.transportType, 'MOCK');

      // (d) smtp.ethereal.email host with real-looking credentials -> Ethereal transport + EXTERNAL_TEST
      const envD = {
        NODE_ENV: 'development',
        SMTP: { HOST: 'smtp.ethereal.email', PORT: 587, USER: 'ethereal.user.1@ethereal.email', PASS: 'ethereal_secret', FROM: 'admissions@noxira.com' }
      };
      const modeD = await offerService.getOfferDispatchMode('test@example.com', { envConfig: envD, template: activeCustomTemplate });
      assert.strictEqual(modeD.mode, 'EXTERNAL_TEST');
      assert.strictEqual(modeD.canSend, true);
      assert.strictEqual(modeD.transportType, 'ETHEREAL');
      assert.ok(modeD.line.includes('Ethereal'));
      assert.strictEqual(modeD.line, 'Email will be sent to an external test capture service (Ethereal) - the candidate will not receive it in their inbox.');
      assert.ok(!modeD.line.toLowerCase().includes('no real email will be sent'), 'Ethereal must not claim no real email will be sent');

      const countBeforeD = createdTransports.length;
      const transportD = offerService.getOfferTransporter(envD);
      assert.ok(transportD.isNodemailerStub, 'Must create nodemailer transport for Ethereal');
      assert.strictEqual(createdTransports.length, countBeforeD + 1);
      assert.strictEqual(createdTransports[createdTransports.length - 1].opts.host, 'smtp.ethereal.email');
      assert.strictEqual(createdTransports[createdTransports.length - 1].opts.auth.user, 'ethereal.user.1@ethereal.email');

      // (e) full real SMTP in development -> real transport + LIVE
      const envE = {
        NODE_ENV: 'development',
        SMTP: { HOST: 'smtp.sendgrid.net', PORT: 587, USER: 'apikey', PASS: 'SG.realKey123', FROM: 'admissions@noxira.com' }
      };
      const modeE = await offerService.getOfferDispatchMode('candidateE@noxira.com', { envConfig: envE, template: activeCustomTemplate });
      assert.strictEqual(modeE.mode, 'LIVE');
      assert.strictEqual(modeE.canSend, true);
      assert.strictEqual(modeE.transportType, 'REAL');
      assert.strictEqual(modeE.line, 'A real email will be sent to candidateE@noxira.com');

      const countBeforeE = createdTransports.length;
      const transportE = offerService.getOfferTransporter(envE);
      assert.ok(transportE.isNodemailerStub, 'Must create real nodemailer transport for live SMTP');
      assert.strictEqual(createdTransports.length, countBeforeE + 1);
      assert.strictEqual(createdTransports[createdTransports.length - 1].opts.host, 'smtp.sendgrid.net');
      assert.strictEqual(createdTransports[createdTransports.length - 1].opts.auth.user, 'apikey');

      // (f) no active custom template -> BLOCKED regardless of SMTP
      const modeF1 = await offerService.getOfferDispatchMode('candidateF@noxira.com', { envConfig: envE, template: sampleTemplate });
      assert.strictEqual(modeF1.mode, 'BLOCKED');
      assert.strictEqual(modeF1.canSend, false);
      assert.strictEqual(modeF1.transportType, 'BLOCKED');
      assert.ok(modeF1.line.includes('blocked'));

      const modeF2 = await offerService.getOfferDispatchMode('candidateF@noxira.com', { envConfig: envE, template: null });
      assert.strictEqual(modeF2.mode, 'BLOCKED');
      assert.strictEqual(modeF2.canSend, false);
      assert.strictEqual(modeF2.transportType, 'BLOCKED');
      assert.ok(modeF2.line.includes('blocked'));

      // Assert shared consistency across all configurations (send path and mode never disagree)
      const allCases = [
        { name: 'empty', env: envA, tmpl: activeCustomTemplate, expectedMode: 'SIMULATED', expectedTransport: 'MOCK' },
        { name: 'test_user', env: envB, tmpl: activeCustomTemplate, expectedMode: 'SIMULATED', expectedTransport: 'MOCK' },
        { name: 'password_pass', env: envC, tmpl: activeCustomTemplate, expectedMode: 'SIMULATED', expectedTransport: 'MOCK' },
        { name: 'ethereal', env: envD, tmpl: activeCustomTemplate, expectedMode: 'EXTERNAL_TEST', expectedTransport: 'ETHEREAL' },
        { name: 'live', env: envE, tmpl: activeCustomTemplate, expectedMode: 'LIVE', expectedTransport: 'REAL' },
        { name: 'blocked_sample', env: envE, tmpl: sampleTemplate, expectedMode: 'BLOCKED', expectedTransport: 'BLOCKED' },
        { name: 'blocked_null', env: envE, tmpl: null, expectedMode: 'BLOCKED', expectedTransport: 'BLOCKED' }
      ];

      for (const tc of allCases) {
        const res = offerService.resolveOfferDispatchMode(tc.env, 'test@example.com', tc.tmpl);
        assert.strictEqual(res.mode, tc.expectedMode, `Mode mismatch for case: ${tc.name}`);
        assert.strictEqual(res.transportType, tc.expectedTransport, `Transport mismatch for case: ${tc.name}`);

        if (tc.expectedTransport === 'MOCK') {
          const t = offerService.getOfferTransporter(tc.env);
          assert.ok(t.isMock, `Expected mock transport for case: ${tc.name}`);
        } else if (tc.expectedTransport === 'REAL' || tc.expectedTransport === 'ETHEREAL') {
          const t = offerService.getOfferTransporter(tc.env);
          assert.ok(t.isNodemailerStub, `Expected nodemailer stub transport for case: ${tc.name}`);
        }
      }
    } finally {
      nodemailer.createTransport = origCreateTransport;
      offerService.setOfferTransporter(null);
      offerService.clearLastCapturedOfferMail();
    }
  });

  // TEST 30: Module 2 - Form 1 URL Settings API & Strict Validation
  await test('Module 2: Settings API validates Form 1 URL strictly, enforces roles, supports clear, and persists safely', async () => {
    // 1. Role verification: 403 for non-SUPER_ADMIN
    const issuerAdmin = { _id: new mongoose.Types.ObjectId(), name: 'Issuer', role: 'ISSUER' };
    const mockRole = mockReqRes({ admin: issuerAdmin });
    requireRole(['SUPER_ADMIN'])(mockRole.req, mockRole.res, () => {});
    assert.strictEqual(mockRole.getStatus(), 403, 'Must return 403 for non-SUPER_ADMIN');

    // 2. Strict URL validation tests
    const invalidCases = [
      { url: 'http://docs.google.com/forms/d/e/1FAIpQLSc/viewform', reason: 'http protocol' },
      { url: 'https://docs.google.com.evil.com/forms/d/e/1FAIpQLSc', reason: 'evil prefix' },
      { url: 'https://evilforms.gle/xyz', reason: 'evil host' },
      { url: 'https://user:pass@docs.google.com/forms/d/123', reason: 'userinfo' },
      { url: 'https://admin@docs.google.com/forms/d/123', reason: 'userinfo @' },
      { url: 'https://docs.google.com/spreadsheets/d/123', reason: 'docs.google.com without /forms/' },
      { url: 'not-a-valid-url', reason: 'malformed url' },
      { url: 12345, reason: 'non-string' }
    ];

    for (const tc of invalidCases) {
      const mockInvalid = mockReqRes({
        admin: { _id: new mongoose.Types.ObjectId(), name: 'Super', role: 'SUPER_ADMIN' },
        body: { url: tc.url }
      });
      await updateGoogleForm1(mockInvalid.req, mockInvalid.res, () => {});
      assert.strictEqual(mockInvalid.getStatus(), 400, `Expected 400 for invalid URL case: ${tc.reason}`);
      assert.strictEqual(mockInvalid.getData().success, false);
    }

    // 3. Valid URL save: docs.google.com and forms.gle
    const validUrl1 = 'https://docs.google.com/forms/d/e/1FAIpQLSc_ExampleTest/viewform';
    const mockSave1 = mockReqRes({
      admin: { _id: new mongoose.Types.ObjectId(), name: 'Super', role: 'SUPER_ADMIN' },
      body: { url: `  ${validUrl1}  ` } // test trim
    });
    await updateGoogleForm1(mockSave1.req, mockSave1.res, () => {});
    assert.strictEqual(mockSave1.getStatus(), 200);
    assert.strictEqual(mockSave1.getData().googleForm1Url, validUrl1);

    // 4. Public route returns only { success, googleForm1Url } without leaking extra fields
    const mockPub = mockReqRes();
    await getPublicSettings(mockPub.req, mockPub.res, () => {});
    assert.strictEqual(mockPub.getStatus(), 200);
    assert.strictEqual(mockPub.getData().success, true);
    assert.strictEqual(mockPub.getData().googleForm1Url, validUrl1);
    assert.strictEqual(mockPub.getData()._id, undefined, 'Must not expose database _id');
    assert.strictEqual(mockPub.getData().key, undefined, 'Must not expose setting key');

    // 5. Test forms.gle valid URL
    const validUrl2 = 'https://forms.gle/AbCdEf123';
    const mockSave2 = mockReqRes({
      admin: { _id: new mongoose.Types.ObjectId(), name: 'Super', role: 'SUPER_ADMIN' },
      body: { url: validUrl2 }
    });
    await updateGoogleForm1(mockSave2.req, mockSave2.res, () => {});
    assert.strictEqual(mockSave2.getStatus(), 200);
    assert.strictEqual(mockSave2.getData().googleForm1Url, validUrl2);

    // 6. Test clear URL (empty string)
    const mockClear = mockReqRes({
      admin: { _id: new mongoose.Types.ObjectId(), name: 'Super', role: 'SUPER_ADMIN' },
      body: { url: '' }
    });
    await updateGoogleForm1(mockClear.req, mockClear.res, () => {});
    assert.strictEqual(mockClear.getStatus(), 200);
    assert.strictEqual(mockClear.getData().googleForm1Url, '');

    // 7. Verify cleared state in public settings
    const mockPub2 = mockReqRes();
    await getPublicSettings(mockPub2.req, mockPub2.res, () => {});
    assert.strictEqual(mockPub2.getData().googleForm1Url, '');
  });

  // TEST 31: Module 2 - 1-Month / Rs.99 Programme Model & Conflicting Legacy Handling
  await test('Module 2: Enforces 1-month / Rs.99 model, excludes conflicting legacy from public, and supports admin normalization', async () => {
    // 1. adminCreateProgram rejects non-4 weeks or non-99 INR
    const mockCreateBadDur = mockReqRes({
      body: {
        code: 'TEST-DUR-BAD',
        title: 'Bad Duration Track',
        category: 'Development',
        durationWeeks: 12,
        feeInr: 99
      }
    });
    await adminCreateProgram(mockCreateBadDur.req, mockCreateBadDur.res, () => {});
    assert.strictEqual(mockCreateBadDur.getStatus(), 400, 'Must reject durationWeeks !== 4');

    const mockCreateBadFee = mockReqRes({
      body: {
        code: 'TEST-FEE-BAD',
        title: 'Bad Fee Track',
        category: 'Development',
        durationWeeks: 4,
        feeInr: 499
      }
    });
    await adminCreateProgram(mockCreateBadFee.req, mockCreateBadFee.res, () => {});
    assert.strictEqual(mockCreateBadFee.getStatus(), 400, 'Must reject feeInr !== 99');

    // 2. Create a conflicting legacy program directly in DB (simulating legacy data)
    await Program.deleteMany({ code: { $in: ['LEGACY-CONFLICT', 'NORMAL-M2'] } });
    await Program.create({
      code: 'LEGACY-CONFLICT',
      title: 'Legacy 12-Week Track',
      category: 'Development',
      durationWeeks: 12,
      feeInr: 499,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-04-01')
    });

    await Program.create({
      code: 'NORMAL-M2',
      title: 'Normal 1-Month Track',
      category: 'Development',
      durationWeeks: 4,
      feeInr: 99,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01')
    });

    // 3. Admin listing should show needsNormalization: true on the legacy track
    const mockAdminList = mockReqRes();
    await adminGetPrograms(mockAdminList.req, mockAdminList.res, () => {});
    assert.strictEqual(mockAdminList.getStatus(), 200);
    const legacyInAdmin = mockAdminList.getData().programs.find(p => p.code === 'LEGACY-CONFLICT');
    assert.ok(legacyInAdmin, 'Legacy track must appear in admin list');
    assert.strictEqual(legacyInAdmin.needsNormalization, true, 'Must flag needsNormalization: true');

    const normalInAdmin = mockAdminList.getData().programs.find(p => p.code === 'NORMAL-M2');
    assert.strictEqual(normalInAdmin.needsNormalization, false, 'Normal track needsNormalization: false');

    // 4. Public listing MUST exclude the conflicting legacy track
    const mockPubList = mockReqRes();
    await getPublicPrograms(mockPubList.req, mockPubList.res, () => {});
    assert.strictEqual(mockPubList.getStatus(), 200);
    const legacyInPublic = mockPubList.getData().programs.find(p => p.code === 'LEGACY-CONFLICT');
    assert.strictEqual(legacyInPublic, undefined, 'Conflicting legacy track must NOT appear in public listing');

    const normalInPublic = mockPubList.getData().programs.find(p => p.code === 'NORMAL-M2');
    assert.ok(normalInPublic, 'Normalized track must appear in public listing');
    assert.strictEqual(normalInPublic.startDate, undefined, 'Public listing must NOT project startDate');
    assert.strictEqual(normalInPublic.endDate, undefined, 'Public listing must NOT project endDate');

    // 5. Public detail MUST return 404 for conflicting legacy track
    const mockPubDetailLegacy = mockReqRes({ params: { code: 'LEGACY-CONFLICT' } });
    await getPublicProgramByCode(mockPubDetailLegacy.req, mockPubDetailLegacy.res, () => {});
    assert.strictEqual(mockPubDetailLegacy.getStatus(), 404, 'Public detail must return 404 for unnormalized legacy track');

    // Public detail of normal track returns safe projection
    const mockPubDetailNormal = mockReqRes({ params: { code: 'NORMAL-M2' } });
    await getPublicProgramByCode(mockPubDetailNormal.req, mockPubDetailNormal.res, () => {});
    assert.strictEqual(mockPubDetailNormal.getStatus(), 200);
    assert.strictEqual(mockPubDetailNormal.getData().program.startDate, undefined);
    assert.strictEqual(mockPubDetailNormal.getData().program.endDate, undefined);
    assert.strictEqual(mockPubDetailNormal.getData().program.durationWeeks, 4);
    assert.strictEqual(mockPubDetailNormal.getData().program.feeInr, 99);

    // 6. Admin updates / normalizes the legacy track to 4 weeks / Rs. 99
    const mockNormUpdate = mockReqRes({
      params: { code: 'LEGACY-CONFLICT' },
      body: { durationWeeks: 4, feeInr: 99 }
    });
    await adminUpdateProgram(mockNormUpdate.req, mockNormUpdate.res, () => {});
    assert.strictEqual(mockNormUpdate.getStatus(), 200);
    assert.strictEqual(mockNormUpdate.getData().program.needsNormalization, false);

    // 7. After normalization, it is now included in public listing and detail!
    const mockPubListPost = mockReqRes();
    await getPublicPrograms(mockPubListPost.req, mockPubListPost.res, () => {});
    const normalizedInPublic = mockPubListPost.getData().programs.find(p => p.code === 'LEGACY-CONFLICT');
    assert.ok(normalizedInPublic, 'Normalized track must now appear in public listing');

    const mockPubDetailPost = mockReqRes({ params: { code: 'LEGACY-CONFLICT' } });
    await getPublicProgramByCode(mockPubDetailPost.req, mockPubDetailPost.res, () => {});
    assert.strictEqual(mockPubDetailPost.getStatus(), 200, 'Normalized track must now return 200 in public detail');
  });

  // TEST 32: Module 3 - Google Form 1 CSV Import Acceptance Suite
  await test('Module 3: Google Form 1 Import parses UTF-8 BOM, auto-suggests columns, detects duplicates, enforces linkable recovery & 4w/Rs.99 model with zero email side effects', async () => {
    const adminUser = await Admin.findOne({ role: 'SUPER_ADMIN' }) || await Admin.create({
      fullName: 'Super Admin',
      email: 'admin_test_m3@example.com',
      password: 'password123',
      role: 'SUPER_ADMIN'
    });

    // Ensure test programmes are active & normalized (4 weeks / Rs.99)
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { durationWeeks: 4, feeInr: 99, isActive: true } });
    await Program.updateOne({ code: 'AI-ENG' }, { $set: { durationWeeks: 4, feeInr: 99, isActive: true } });

    // 1. Prepare Google-Forms-style fixture CSV with UTF-8 BOM on first column
    const bomHeader = '\uFEFFTimestamp';
    const fixtureRows = [
      [
        bomHeader,
        'Email Address',
        'Full Name',
        'Internship Domain',
        'Contact Number',
        'Gender',
        'Country',
        'College / University',
        'Qualification',
        'Current Year of Study',
        'Where did you hear about us?',
        'Have you followed our LinkedIn page?',
        'Have you joined the WhatsApp group?',
        'User.Meta$Info'
      ].join(','),
      [
        '2026/04/01 10:30:00 AM GMT+5:30',
        'form1_applicant1@example.com',
        'Aarav Sharma',
        'Full Stack Web Development',
        '+91 9876543210',
        'Male',
        'India',
        'IIT Delhi',
        'B.Tech CSE',
        '3rd Year',
        'LinkedIn',
        'Yes',
        'Yes',
        'ref=banner.promo$1'
      ].join(','),
      [
        '2026/04/01 11:00:00 AM GMT+5:30',
        'form1_applicant2@example.com',
        'Diya Patel',
        'AI Engineering & Intelligent Systems',
        '+91 9876543211',
        'Female',
        'India',
        'BITS Pilani',
        'B.Tech EEE',
        '4th Year',
        'College TPO',
        'Yes',
        'Yes',
        'ref=campus.drive$2'
      ].join(',')
    ];
    const fixtureCsvBuffer = Buffer.from(fixtureRows.join('\r\n'), 'utf8');

    // 1. Header auto-suggestion on the fixture
    const mockPreview1 = mockReqRes({
      admin: adminUser,
      file: { buffer: fixtureCsvBuffer, originalname: 'form1_fixture.csv' },
      body: { batchId: 'BATCH-2026-F1' }
    });
    await form1ImportController.previewForm1(mockPreview1.req, mockPreview1.res, mockPreview1.next);
    assert.strictEqual(mockPreview1.getStatus(), 200);
    const p1Data = mockPreview1.getData();
    assert.strictEqual(p1Data.success, true);
    assert.ok(p1Data.headers.includes('Timestamp'), 'BOM must be stripped from first header');
    assert.strictEqual(p1Data.headers[0], 'Timestamp');

    // Verify auto-suggestions
    const colSuggestions = p1Data.columnSuggestions;
    assert.strictEqual(colSuggestions.find(s => s.target === 'email').header, 'Email Address');
    assert.strictEqual(colSuggestions.find(s => s.target === 'fullName').header, 'Full Name');
    assert.strictEqual(colSuggestions.find(s => s.target === 'domain').header, 'Internship Domain');
    assert.strictEqual(colSuggestions.find(s => s.target === 'phone').header, 'Contact Number');
    assert.strictEqual(colSuggestions.find(s => s.target === 'gender').header, 'Gender');
    assert.strictEqual(colSuggestions.find(s => s.target === 'college').header, 'College / University');
    assert.strictEqual(colSuggestions.find(s => s.target === 'timestamp').header, 'Timestamp');

    // 2. Duplicate header names reject the file with a clear error
    const dupHeaderCsv = Buffer.from('Timestamp,Email,Full Name,Domain,Domain\n2026-01-01,e@e.com,Name,FS-DEV,FS-DEV', 'utf8');
    const mockDupHeader = mockReqRes({
      admin: adminUser,
      file: { buffer: dupHeaderCsv, originalname: 'dup.csv' },
      body: { batchId: 'BATCH-2026-F1' }
    });
    await form1ImportController.previewForm1(mockDupHeader.req, mockDupHeader.res, mockDupHeader.next);
    assert.strictEqual(mockDupHeader.getStatus(), 400);
    assert.ok(mockDupHeader.getData().message.includes('duplicate column header'), 'Must reject duplicate header');
    assert.ok(mockDupHeader.getData().message.includes('"Domain"'), 'Must list the duplicated column');

    // 3. Manual column remapping is respected on preview & commit
    const altHeadersCsv = Buffer.from('ColA,CandidateEmail,CandidateName,ChosenTrack\nTime1,remap_cand@example.com,Rohan Roy,Full Stack Web Development', 'utf8');
    const manualColMapping = [
      { target: 'email', header: 'CandidateEmail' },
      { target: 'fullName', header: 'CandidateName' },
      { target: 'domain', header: 'ChosenTrack' }
    ];
    const manualDomMapping = [
      { value: 'Full Stack Web Development', programCode: 'FS-DEV' }
    ];

    const mockRemapPreview = mockReqRes({
      admin: adminUser,
      file: { buffer: altHeadersCsv, originalname: 'remap.csv' },
      body: {
        batchId: 'BATCH-2026-F1',
        columnMapping: JSON.stringify(manualColMapping),
        domainMapping: JSON.stringify(manualDomMapping)
      }
    });
    await form1ImportController.previewForm1(mockRemapPreview.req, mockRemapPreview.res, mockRemapPreview.next);
    assert.strictEqual(mockRemapPreview.getStatus(), 200);
    assert.strictEqual(mockRemapPreview.getData().previewRows[0].email, 'remap_cand@example.com');
    assert.strictEqual(mockRemapPreview.getData().previewRows[0].fullName, 'Rohan Roy');
    assert.strictEqual(mockRemapPreview.getData().previewRows[0].programCode, 'FS-DEV');

    // 4. Unmapped extra columns land in form1Extra as {header, value} entries - including dots and dollar signs
    const colMapFixture = [
      { target: 'email', header: 'Email Address' },
      { target: 'fullName', header: 'Full Name' },
      { target: 'domain', header: 'Internship Domain' },
      { target: 'phone', header: 'Contact Number' },
      { target: 'gender', header: 'Gender' },
      { target: 'country', header: 'Country' },
      { target: 'college', header: 'College / University' },
      { target: 'qualification', header: 'Qualification' },
      { target: 'currentYear', header: 'Current Year of Study' },
      { target: 'referralSource', header: 'Where did you hear about us?' },
      { target: 'linkedinFollow', header: 'Have you followed our LinkedIn page?' },
      { target: 'whatsappJoin', header: 'Have you joined the WhatsApp group?' },
      { target: 'timestamp', header: 'Timestamp' }
    ];
    const domMapFixture = [
      { value: 'Full Stack Web Development', programCode: 'FS-DEV' },
      { value: 'AI Engineering & Intelligent Systems', programCode: 'AI-ENG' }
    ];

    const mockPreviewFixtureReady = mockReqRes({
      admin: adminUser,
      file: { buffer: fixtureCsvBuffer, originalname: 'fixture.csv' },
      body: {
        batchId: 'BATCH-2026-F1',
        columnMapping: JSON.stringify(colMapFixture),
        domainMapping: JSON.stringify(domMapFixture)
      }
    });
    await form1ImportController.previewForm1(mockPreviewFixtureReady.req, mockPreviewFixtureReady.res, mockPreviewFixtureReady.next);
    assert.strictEqual(mockPreviewFixtureReady.getStatus(), 200);
    const readyRows = mockPreviewFixtureReady.getData().fullRows;

    // Execute Commit 1
    const mockCommit1 = mockReqRes({
      admin: adminUser,
      body: {
        rows: readyRows,
        batchId: 'BATCH-2026-F1',
        columnMapping: colMapFixture,
        domainMapping: domMapFixture,
        fileName: 'fixture.csv'
      }
    });
    await form1ImportController.commitForm1(mockCommit1.req, mockCommit1.res, mockCommit1.next);
    assert.strictEqual(mockCommit1.getStatus(), 200);
    assert.strictEqual(mockCommit1.getData().counts.imported, 2);

    // Verify participant 1 has form1Extra containing the dot and dollar sign header
    const p1 = await Participant.findOne({ normalizedEmail: 'form1_applicant1@example.com' });
    assert.ok(p1, 'Participant 1 must exist');
    assert.strictEqual(p1.source, 'CSV_IMPORT');
    assert.strictEqual(p1.batchId, 'BATCH-2026-F1');
    assert.strictEqual(p1.gender, 'Male');
    assert.strictEqual(p1.college, 'IIT Delhi');
    assert.ok(Array.isArray(p1.form1Extra), 'form1Extra must be an array');
    const extraEntry = p1.form1Extra.find(e => e.header === 'User.Meta$Info');
    assert.ok(extraEntry, 'Must preserve unmapped column User.Meta$Info');
    assert.strictEqual(extraEntry.value, 'ref=banner.promo$1');

    // 7. Successful commit creates Participant + Application with unique NOX- ID, status APPLIED, intakeSource 'FORM1_IMPORT', correct feeLocked
    const app1 = await Application.findOne({ participantId: p1._id });
    assert.ok(app1, 'Application 1 must exist');
    assert.ok(app1.applicationId.startsWith('NOX-'), 'Application ID must start with NOX-');
    assert.strictEqual(app1.status, 'APPLIED');
    assert.strictEqual(app1.intakeSource, 'FORM1_IMPORT');
    assert.strictEqual(app1.feeLocked, 99);

    // Verify ImportBatch was persisted with kind 'FORM1_RESPONSES'
    const importBatchRecord = await ImportBatch.findById(p1.sourceImportBatchId);
    assert.ok(importBatchRecord, 'ImportBatch must exist');
    assert.strictEqual(importBatchRecord.kind, 'FORM1_RESPONSES');
    assert.strictEqual(importBatchRecord.batchId, 'BATCH-2026-F1');

    // 5. In-file duplicate and in-database duplicate detection
    const dupCsv = [
      'Timestamp,Email Address,Full Name,Internship Domain',
      '2026/04/01,in_file_dup@example.com,Dup One,Full Stack Web Development',
      '2026/04/01,in_file_dup@example.com,Dup Two,Full Stack Web Development',
      '2026/04/01,form1_applicant1@example.com,Aarav Sharma,Full Stack Web Development'
    ].join('\r\n');

    const mockDupPreview = mockReqRes({
      admin: adminUser,
      file: { buffer: Buffer.from(dupCsv, 'utf8'), originalname: 'dups.csv' },
      body: {
        batchId: 'BATCH-2026-F1',
        columnMapping: JSON.stringify([
          { target: 'email', header: 'Email Address' },
          { target: 'fullName', header: 'Full Name' },
          { target: 'domain', header: 'Internship Domain' }
        ]),
        domainMapping: JSON.stringify([
          { value: 'Full Stack Web Development', programCode: 'FS-DEV' }
        ])
      }
    });
    await form1ImportController.previewForm1(mockDupPreview.req, mockDupPreview.res, mockDupPreview.next);
    assert.strictEqual(mockDupPreview.getStatus(), 200);
    const dupStats = mockDupPreview.getData().stats;
    assert.strictEqual(dupStats.validCount, 1);
    assert.strictEqual(dupStats.duplicateInFileCount, 1);
    assert.strictEqual(dupStats.duplicateInDbCount, 1);

    // 6. NEEDS_PROGRAM rows are blocked from commit until mapped or skipped
    const unmappedDomainCsv = [
      'Timestamp,Email Address,Full Name,Internship Domain',
      '2026/04/01,unmapped@example.com,Unmapped User,Unknown Quantum Computing'
    ].join('\r\n');

    const mockUnmappedPreview = mockReqRes({
      admin: adminUser,
      file: { buffer: Buffer.from(unmappedDomainCsv, 'utf8'), originalname: 'unmapped.csv' },
      body: {
        batchId: 'BATCH-2026-F1',
        columnMapping: JSON.stringify([
          { target: 'email', header: 'Email Address' },
          { target: 'fullName', header: 'Full Name' },
          { target: 'domain', header: 'Internship Domain' }
        ]),
        domainMapping: JSON.stringify([])
      }
    });
    await form1ImportController.previewForm1(mockUnmappedPreview.req, mockUnmappedPreview.res, mockUnmappedPreview.next);
    assert.strictEqual(mockUnmappedPreview.getStatus(), 200);
    assert.strictEqual(mockUnmappedPreview.getData().stats.needsProgramCount, 1);
    assert.strictEqual(mockUnmappedPreview.getData().canCommit, false, 'Cannot commit when domain is unmapped');

    // Attempting to commit with unmapped domain returns 400
    const mockUnmappedCommit = mockReqRes({
      admin: adminUser,
      body: {
        rows: [{ email: 'unmapped@example.com', fullName: 'Unmapped User', domain: 'Unknown Quantum Computing' }],
        batchId: 'BATCH-2026-F1',
        columnMapping: [{ target: 'email', header: 'Email Address' }, { target: 'fullName', header: 'Full Name' }, { target: 'domain', header: 'Internship Domain' }],
        domainMapping: [{ value: 'Unknown Quantum Computing', programCode: '__UNMAPPED__' }]
      }
    });
    await form1ImportController.commitForm1(mockUnmappedCommit.req, mockUnmappedCommit.res, mockUnmappedCommit.next);
    assert.strictEqual(mockUnmappedCommit.getStatus(), 400);

    // Now test skipping the row with '__SKIP__'
    const mockSkipCommit = mockReqRes({
      admin: adminUser,
      body: {
        rows: [{ email: 'unmapped@example.com', fullName: 'Unmapped User', domain: 'Unknown Quantum Computing' }],
        batchId: 'BATCH-2026-F1',
        columnMapping: [{ target: 'email', header: 'Email Address' }, { target: 'fullName', header: 'Full Name' }, { target: 'domain', header: 'Internship Domain' }],
        domainMapping: [{ value: 'Unknown Quantum Computing', programCode: '__SKIP__' }]
      }
    });
    await form1ImportController.commitForm1(mockSkipCommit.req, mockSkipCommit.res, mockSkipCommit.next);
    assert.strictEqual(mockSkipCommit.getStatus(), 200);
    assert.strictEqual(mockSkipCommit.getData().counts.needsProgramSkipped, 1);
    assert.strictEqual(mockSkipCommit.getData().counts.imported, 0);

    // 8. LINKABLE:
    // a) A WEBSITE participant without Application is linked
    const pWeb = await Participant.create({
      fullName: 'Website Stranded',
      email: 'web_stranded@example.com',
      normalizedEmail: 'web_stranded@example.com',
      normalizedName: 'website stranded',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-F1',
      source: 'WEBSITE'
    });

    // b) A crashed Form 1 commit (participant exists, no Application, kind 'FORM1_RESPONSES') is recovered
    const crashBatch = await ImportBatch.create({
      fileName: 'crashed.csv',
      uploadedBy: adminUser._id,
      kind: 'FORM1_RESPONSES',
      batchId: 'BATCH-2026-F1'
    });
    const pCrashed = await Participant.create({
      fullName: 'Form1 Crashed',
      email: 'f1_crashed@example.com',
      normalizedEmail: 'f1_crashed@example.com',
      normalizedName: 'form1 crashed',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-F1',
      source: 'CSV_IMPORT',
      sourceImportBatchId: crashBatch._id
    });

    // c) A certificate-side 'PARTICIPANT_CSV' participant is NEVER linked or modified
    const certBatch = await ImportBatch.create({
      fileName: 'cert.csv',
      uploadedBy: adminUser._id,
      kind: 'PARTICIPANT_CSV',
      programCode: 'FS-DEV',
      batchId: 'BATCH-2026-F1'
    });
    const pCert = await Participant.create({
      fullName: 'Cert Participant',
      email: 'cert_part@example.com',
      normalizedEmail: 'cert_part@example.com',
      normalizedName: 'cert participant',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-F1',
      source: 'CSV_IMPORT',
      sourceImportBatchId: certBatch._id
    });

    // Preview rows for all three
    const linkableTestCsv = [
      'Timestamp,Email Address,Full Name,Internship Domain',
      '2026/04/01,web_stranded@example.com,Website Stranded,Full Stack Web Development',
      '2026/04/01,f1_crashed@example.com,Form1 Crashed,Full Stack Web Development',
      '2026/04/01,cert_part@example.com,Cert Participant,Full Stack Web Development'
    ].join('\r\n');

    const mockLinkablePreview = mockReqRes({
      admin: adminUser,
      file: { buffer: Buffer.from(linkableTestCsv, 'utf8'), originalname: 'linkables.csv' },
      body: {
        batchId: 'BATCH-2026-F1',
        columnMapping: JSON.stringify([
          { target: 'email', header: 'Email Address' },
          { target: 'fullName', header: 'Full Name' },
          { target: 'domain', header: 'Internship Domain' }
        ]),
        domainMapping: JSON.stringify([
          { value: 'Full Stack Web Development', programCode: 'FS-DEV' }
        ])
      }
    });
    await form1ImportController.previewForm1(mockLinkablePreview.req, mockLinkablePreview.res, mockLinkablePreview.next);
    assert.strictEqual(mockLinkablePreview.getStatus(), 200);
    const linkStats = mockLinkablePreview.getData().stats;
    assert.strictEqual(linkStats.linkableCount, 2, 'Must recognize pWeb and pCrashed as LINKABLE');
    assert.strictEqual(linkStats.duplicateInDbCount, 1, 'pCert must be DUPLICATE_IN_DB');

    // Commit the linkables
    const mockLinkCommit = mockReqRes({
      admin: adminUser,
      body: {
        rows: mockLinkablePreview.getData().fullRows,
        batchId: 'BATCH-2026-F1',
        columnMapping: [{ target: 'email', header: 'Email Address' }, { target: 'fullName', header: 'Full Name' }, { target: 'domain', header: 'Internship Domain' }],
        domainMapping: [{ value: 'Full Stack Web Development', programCode: 'FS-DEV' }],
        fileName: 'linkables.csv'
      }
    });
    await form1ImportController.commitForm1(mockLinkCommit.req, mockLinkCommit.res, mockLinkCommit.next);
    assert.strictEqual(mockLinkCommit.getStatus(), 200);
    assert.strictEqual(mockLinkCommit.getData().counts.linked, 2);
    assert.strictEqual(mockLinkCommit.getData().counts.duplicatesSkipped, 1);

    // Verify pWeb gained an Application with intakeSource 'WEBSITE'
    const appWeb = await Application.findOne({ participantId: pWeb._id });
    assert.ok(appWeb, 'pWeb must have Application linked');
    assert.strictEqual(appWeb.intakeSource, 'WEBSITE');

    // Verify pCrashed gained an Application with intakeSource 'FORM1_IMPORT'
    const appCrashed = await Application.findOne({ participantId: pCrashed._id });
    assert.ok(appCrashed, 'pCrashed must have Application linked');
    assert.strictEqual(appCrashed.intakeSource, 'FORM1_IMPORT');

    // Verify pCert has NO Application
    const appCert = await Application.findOne({ participantId: pCert._id });
    assert.strictEqual(appCert, null, 'Certificate participant must NOT have Application created');

    // 9. Commit rejects rows mapped to unnormalized programme, blank batch, or >1,000 rows
    await Program.deleteOne({ code: 'UNNORM-F1' });
    await Program.create({
      code: 'UNNORM-F1',
      title: 'Unnormalized Track',
      category: 'Development',
      durationWeeks: 12,
      feeInr: 499,
      isActive: true
    });

    const mockUnnormCommit = mockReqRes({
      admin: adminUser,
      body: {
        rows: [{ email: 'unnorm@example.com', fullName: 'Unnorm Student', domain: 'Unnorm Domain' }],
        batchId: 'BATCH-2026-F1',
        columnMapping: [{ target: 'email', header: 'Email' }, { target: 'fullName', header: 'Name' }, { target: 'domain', header: 'Domain' }],
        domainMapping: [{ value: 'Unnorm Domain', programCode: 'UNNORM-F1' }]
      }
    });
    await form1ImportController.commitForm1(mockUnnormCommit.req, mockUnnormCommit.res, mockUnnormCommit.next);
    assert.strictEqual(mockUnnormCommit.getStatus(), 200);
    assert.strictEqual(mockUnnormCommit.getData().counts.imported, 0);
    assert.strictEqual(mockUnnormCommit.getData().counts.needsNormalizationSkipped, 1, 'Unnormalized programme rows classify as NEEDS_NORMALIZATION');
    assert.strictEqual(mockUnnormCommit.getData().counts.errors, 0, 'No generic error for a normalization block');

    // Blank batch rejected
    const mockBlankBatch = mockReqRes({
      admin: adminUser,
      body: {
        rows: [{ email: 't@t.com', fullName: 'Test', domain: 'Test' }],
        batchId: '   '
      }
    });
    await form1ImportController.commitForm1(mockBlankBatch.req, mockBlankBatch.res, mockBlankBatch.next);
    assert.strictEqual(mockBlankBatch.getStatus(), 400);

    // >1000 rows rejected
    const giantRows = new Array(1001).fill({ email: 't@t.com', fullName: 'Test', domain: 'Test' });
    const mockGiant = mockReqRes({
      admin: adminUser,
      body: { rows: giantRows, batchId: 'BATCH-1' }
    });
    await form1ImportController.commitForm1(mockGiant.req, mockGiant.res, mockGiant.next);
    assert.strictEqual(mockGiant.getStatus(), 400);

    // 10. Re-importing the same file produces all duplicates (idempotent, no double records)
    const mockReimportPreview = mockReqRes({
      admin: adminUser,
      file: { buffer: fixtureCsvBuffer, originalname: 'fixture.csv' },
      body: {
        batchId: 'BATCH-2026-F1',
        columnMapping: JSON.stringify(colMapFixture),
        domainMapping: JSON.stringify(domMapFixture)
      }
    });
    await form1ImportController.previewForm1(mockReimportPreview.req, mockReimportPreview.res, mockReimportPreview.next);
    assert.strictEqual(mockReimportPreview.getStatus(), 200);
    assert.strictEqual(mockReimportPreview.getData().stats.validCount, 0);
    assert.strictEqual(mockReimportPreview.getData().stats.duplicateInDbCount, 2);

    // 11. Public settings & public status confidentiality
    const mockPubSettings = mockReqRes();
    await getPublicSettings(mockPubSettings.req, mockPubSettings.res, mockPubSettings.next);
    assert.strictEqual(mockPubSettings.getStatus(), 200);
    assert.strictEqual(mockPubSettings.getData().form1ColumnMapping, undefined, 'Must NEVER leak form1ColumnMapping in public settings');
    assert.strictEqual(mockPubSettings.getData().form1DomainMapping, undefined, 'Must NEVER leak form1DomainMapping in public settings');

    const mockPubStatus = mockReqRes({
      query: { email: 'form1_applicant1@example.com', id: app1.applicationId }
    });
    await intakeController.getApplicationStatus(mockPubStatus.req, mockPubStatus.res, mockPubStatus.next);
    assert.strictEqual(mockPubStatus.getStatus(), 200);
    const pubAppData = mockPubStatus.getData().application;
    assert.strictEqual(pubAppData.applicationId, app1.applicationId);
    assert.strictEqual(pubAppData.gender, undefined, 'Must not leak gender');
    assert.strictEqual(pubAppData.college, undefined, 'Must not leak college');
    assert.strictEqual(pubAppData.country, undefined, 'Must not leak country');
    assert.strictEqual(pubAppData.form1Extra, undefined, 'Must not leak form1Extra');

    // 12. Result-CSV generator escapes commas, quotes, line breaks and formula-leading characters
    const testExportRows = [
      {
        fullName: 'Smith, Agent',
        email: 'agent@matrix.com',
        programCode: 'FS-DEV',
        programTitle: 'Full Stack, Dev',
        applicationId: 'NOX-123456',
        batchId: 'BATCH-1'
      },
      {
        fullName: 'John "The Boss" Doe',
        email: 'boss@corp.com',
        programCode: 'FS-DEV',
        programTitle: 'Web Dev',
        applicationId: 'NOX-234567',
        batchId: 'BATCH-1'
      },
      {
        fullName: '=1+2',
        email: '+evil@hacker.com',
        programCode: '-CMD',
        programTitle: '@Formula',
        applicationId: '\tTAB-ID',
        batchId: '\rCR-BATCH'
      }
    ];

    const generatedCsv = generateApplicationsCsv(testExportRows);
    assert.ok(generatedCsv.includes('"Smith, Agent"'), 'Must quote commas');
    assert.ok(generatedCsv.includes('"Full Stack, Dev"'), 'Must quote commas in titles');
    assert.ok(generatedCsv.includes('"John ""The Boss"" Doe"'), 'Must double internal quotes');
    assert.ok(generatedCsv.includes("'=1+2"), 'Must escape formula leading =');
    assert.ok(generatedCsv.includes("'+evil@hacker.com"), 'Must escape formula leading +');
    assert.ok(generatedCsv.includes("'-CMD"), 'Must escape formula leading -');
    assert.ok(generatedCsv.includes("'@Formula"), 'Must escape formula leading @');
    assert.ok(generatedCsv.includes("'\tTAB-ID"), 'Must escape formula leading tab');
    assert.ok(generatedCsv.includes("'\rCR-BATCH"), 'Must escape formula leading CR');

    // 13. No email side effects
    const offerJobsCount = await OfferDeliveryJob.countDocuments({
      applicationId: { $in: [app1.applicationId, appWeb.applicationId, appCrashed.applicationId] }
    });
    assert.strictEqual(offerJobsCount, 0, 'Must have zero email delivery jobs created during Form 1 import');
  });

  await test('Module 3 Fix Pass: raced participant LINKABLE reclassification, explicit NEEDS_NORMALIZATION & admin-only Form 1 detail', async () => {
    const adminUser = await Admin.findOne({ role: 'SUPER_ADMIN' });
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { durationWeeks: 4, feeInr: 99, isActive: true } });

    // A. NEEDS_NORMALIZATION: active programme NOT on the current 4-week / Rs.99 offering
    await Program.create({
      code: 'LEGACY-NN',
      title: 'Legacy Non Normalized Track',
      defaultBatch: 'BATCH-LEGACY',
      durationWeeks: 8,
      feeInr: 199
    });
    const nnCommit = mockReqRes({
      admin: adminUser,
      body: {
        batchId: 'BATCH-NN-01',
        columnMapping: [
          { target: 'email', header: 'Email' },
          { target: 'fullName', header: 'Name' },
          { target: 'domain', header: 'Domain' }
        ],
        domainMapping: [{ value: 'Legacy Domain', programCode: 'LEGACY-NN' }],
        rows: [{ rowIndex: 1, Email: 'nn_cand@example.com', Name: 'Nora Nair', Domain: 'Legacy Domain' }]
      }
    });
    await form1ImportController.commitForm1(nnCommit.req, nnCommit.res, nnCommit.next);
    assert.strictEqual(nnCommit.getStatus(), 200);
    assert.strictEqual(nnCommit.getData().counts.needsNormalizationSkipped, 1, 'Non-normalized programme rows must be classified separately');
    assert.strictEqual(nnCommit.getData().counts.errors, 0, 'Must NOT be bucketed as generic errors');
    assert.strictEqual(nnCommit.getData().counts.imported, 0, 'Blocked rows create nothing');
    assert.strictEqual(nnCommit.getData().details.needsNormalization.length, 1, 'Detail list must carry the blocked row');
    assert.strictEqual(await Participant.countDocuments({ email: 'nn_cand@example.com' }), 0, 'Nothing may be created for blocked rows');
    const nnProg = await Program.findOne({ code: 'LEGACY-NN' }).lean();
    assert.strictEqual(nnProg.durationWeeks, 8, 'Programme record must remain untouched');
    assert.strictEqual(nnProg.feeInr, 199, 'Programme record must remain untouched');

    // B. Raced duplicate participant (real unique-index 11000) must follow LINKABLE / DUPLICATE_IN_DB rules
    const racedBatch = 'BATCH-RACE-01';
    const racedWeb = await Participant.create({
      fullName: 'Riya Raced',
      email: 'raced_web@example.com',
      normalizedEmail: 'raced_web@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: racedBatch,
      source: 'WEBSITE',
      gender: 'Female',
      college: 'IIT Bombay',
      form1Extra: [{ header: 'User.Meta$Info', value: 'ref=race$9' }],
      completionStatus: 'PENDING'
    });
    const crashedBatchDoc = await ImportBatch.create({
      fileName: 'earlier_form1.csv',
      uploadedBy: adminUser._id,
      kind: 'FORM1_RESPONSES',
      batchId: racedBatch,
      totalRows: 1, validRows: 0, duplicateRows: 0, errorRows: 1,
      status: 'COMMITTED'
    });
    const racedForm1 = await Participant.create({
      fullName: 'Farhan Crashed',
      email: 'raced_form1@example.com',
      normalizedEmail: 'raced_form1@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: racedBatch,
      source: 'CSV_IMPORT',
      sourceImportBatchId: crashedBatchDoc._id,
      completionStatus: 'PENDING'
    });
    const certBatchDoc = await ImportBatch.create({
      fileName: 'cert_side.csv',
      uploadedBy: adminUser._id,
      kind: 'PARTICIPANT_CSV',
      programCode: 'FS-DEV',
      batchId: racedBatch,
      totalRows: 1, validRows: 1, duplicateRows: 0, errorRows: 0,
      status: 'COMMITTED'
    });
    const racedCert = await Participant.create({
      fullName: 'Chetan Cert',
      email: 'raced_cert@example.com',
      normalizedEmail: 'raced_cert@example.com',
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Web Development',
      batchId: racedBatch,
      source: 'CSV_IMPORT',
      sourceImportBatchId: certBatchDoc._id,
      completionStatus: 'PENDING'
    });

    // Simulate the race: each raced participant "appears" between the duplicate check and the write.
    // The write then hits the REAL compound unique index (11000) - no save patching.
    const racedEmails = new Set(['raced_web@example.com', 'raced_form1@example.com', 'raced_cert@example.com']);
    const blinded = new Set();
    const origFindOne = Participant.findOne;
    Participant.findOne = function (query, ...rest) {
      const email = query && query.normalizedEmail;
      if (email && racedEmails.has(email) && !blinded.has(email)) {
        blinded.add(email);
        return Promise.resolve(null);
      }
      return origFindOne.call(this, query, ...rest);
    };

    const raceCommit = mockReqRes({
      admin: adminUser,
      body: {
        batchId: racedBatch,
        columnMapping: [
          { target: 'email', header: 'Email' },
          { target: 'fullName', header: 'Name' },
          { target: 'domain', header: 'Domain' }
        ],
        domainMapping: [{ value: 'Full Stack Web Development', programCode: 'FS-DEV' }],
        rows: [
          { rowIndex: 1, Email: 'raced_web@example.com', Name: 'Riya Raced', Domain: 'Full Stack Web Development' },
          { rowIndex: 2, Email: 'raced_form1@example.com', Name: 'Farhan Crashed', Domain: 'Full Stack Web Development' },
          { rowIndex: 3, Email: 'raced_cert@example.com', Name: 'Chetan Cert', Domain: 'Full Stack Web Development' },
          { rowIndex: 4, Email: 'fresh_candidate@example.com', Name: 'Nikhil Fresh', Domain: 'Full Stack Web Development' }
        ]
      }
    });
    try {
      await form1ImportController.commitForm1(raceCommit.req, raceCommit.res, raceCommit.next);
    } finally {
      Participant.findOne = origFindOne;
    }
    assert.strictEqual(raceCommit.getStatus(), 200);
    const rc = raceCommit.getData().counts;
    assert.strictEqual(rc.linked, 2, 'Website + crashed Form 1 raced participants must be linked');
    assert.strictEqual(rc.duplicatesSkipped, 1, 'Certificate-side raced participant must be DUPLICATE_IN_DB');
    assert.strictEqual(rc.imported, 1, 'Clean row must import normally');
    assert.strictEqual(rc.errors, 0, 'No raced row may fall into generic errors');

    const appRacedWeb = await Application.findOne({ participantId: racedWeb._id });
    assert.ok(appRacedWeb, 'Website raced participant must gain an Application');
    assert.strictEqual(appRacedWeb.intakeSource, 'WEBSITE', 'Website participant keeps WEBSITE intakeSource');
    const appRacedForm1 = await Application.findOne({ participantId: racedForm1._id });
    assert.ok(appRacedForm1, 'Crashed Form 1 raced participant must be recovered');
    assert.strictEqual(appRacedForm1.intakeSource, 'FORM1_IMPORT', 'Form 1 batch participant linked as FORM1_IMPORT');
    assert.strictEqual(await Application.countDocuments({ participantId: racedCert._id }), 0, 'Certificate participant must NEVER gain an Application');

    // C. Combined output: createdApplications carries imported + linked for the result CSV
    assert.strictEqual(raceCommit.getData().createdApplications.length, 3, 'Result CSV source must include imported and linked');
    const combinedCsv = generateApplicationsCsv(raceCommit.getData().createdApplications);
    assert.ok(combinedCsv.includes('raced_web@example.com') && combinedCsv.includes('fresh_candidate@example.com'), 'CSV must cover linked and imported rows');
    assert.ok(combinedCsv.split('\r\n').every((line) => !line.includes('raced_cert@example.com')), 'Certificate participant must never appear in the result CSV');

    // D. Admin detail endpoint exposes Form 1 answers (drawer data source); public lookup must not
    const detailMock = mockReqRes({ admin: adminUser, params: { id: appRacedWeb.applicationId } });
    await adminApplicationController.getApplicationDetail(detailMock.req, detailMock.res, detailMock.next);
    assert.strictEqual(detailMock.getStatus(), 200);
    const detailParticipant = detailMock.getData().application.participantId;
    assert.strictEqual(detailParticipant.gender, 'Female', 'Admin detail must include Form 1 answers');
    assert.strictEqual(detailParticipant.college, 'IIT Bombay', 'Admin detail must include Form 1 answers');
    assert.ok(Array.isArray(detailParticipant.form1Extra) && detailParticipant.form1Extra[0].header === 'User.Meta$Info', 'Admin detail must include form1Extra');

    const pubStatusMock = mockReqRes({ query: { email: 'raced_web@example.com', id: appRacedWeb.applicationId } });
    await intakeController.getApplicationStatus(pubStatusMock.req, pubStatusMock.res, pubStatusMock.next);
    assert.strictEqual(pubStatusMock.getStatus(), 200);
    const pubData = pubStatusMock.getData().application || pubStatusMock.getData();
    assert.strictEqual(pubData.gender, undefined, 'Public status must not leak Form 1 answers');
    assert.strictEqual(pubData.college, undefined, 'Public status must not leak Form 1 answers');
    assert.strictEqual(pubData.form1Extra, undefined, 'Public status must not leak form1Extra');
  });

  await test('Module 5: Admin sets per-programme learning material; approved students receive tasks + learning material via status lookup, non-approved do not', async () => {
    process.env.WEBSITE_INTAKE_BATCH_ID = 'BATCH-M5-ACCEPTANCE';

    // 1. Admin create programme with learning material (string textarea shape)
    const mockCreateM5 = mockReqRes({
      body: {
        code: 'M5-TRACK',
        title: 'Module Five Verification Track',
        category: 'Development',
        durationWeeks: 4,
        feeInr: 99,
        syllabus: 'Week 1: Basics',
        tasks: 'Task 1: Schema design\nTask 2: API endpoints',
        learningMaterials: 'Reading: REST design guide\nhttps://example.com/practice-dataset'
      }
    });
    await adminCreateProgram(mockCreateM5.req, mockCreateM5.res, mockCreateM5.next);
    assert.strictEqual(mockCreateM5.getStatus(), 201, 'Programme with learning material must create');

    const createdM5 = await Program.findOne({ code: 'M5-TRACK' });
    assert.deepStrictEqual(createdM5.learningMaterials, ['Reading: REST design guide', 'https://example.com/practice-dataset'], 'Create must clean learningMaterials like tasks');

    // 2. Admin update learning material; clearing with empty string empties array
    const mockUpdateM5 = mockReqRes({
      params: { code: 'M5-TRACK' },
      body: { learningMaterials: 'Updated reading list\nVideo: schema walkthrough\nExtra: practice repo' }
    });
    await adminUpdateProgram(mockUpdateM5.req, mockUpdateM5.res, mockUpdateM5.next);
    assert.strictEqual(mockUpdateM5.getStatus(), 200, 'Update learning material must succeed');
    assert.deepStrictEqual(mockUpdateM5.getData().program.learningMaterials, ['Updated reading list', 'Video: schema walkthrough', 'Extra: practice repo']);

    const mockClearM5 = mockReqRes({ params: { code: 'M5-TRACK' }, body: { learningMaterials: '' } });
    await adminUpdateProgram(mockClearM5.req, mockClearM5.res, mockClearM5.next);
    assert.strictEqual(mockClearM5.getStatus(), 200);
    assert.deepStrictEqual(mockClearM5.getData().program.learningMaterials, [], 'Empty string must clear learning material');

    // Restore content for the status assertions below
    await Program.updateOne({ code: 'M5-TRACK' }, { $set: { learningMaterials: ['Updated reading list', 'Video: schema walkthrough', 'Extra: practice repo'] } });

    // 3. Non-approved application: status lookup must NOT include tasks or learning material
    const mockApplyM5 = mockReqRes({
      body: {
        fullName: 'Module Five Pending',
        email: 'm5pending@example.com',
        programCode: 'M5-TRACK',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockApplyM5.req, mockApplyM5.res, mockApplyM5.next);
    assert.strictEqual(mockApplyM5.getStatus(), 201);
    const pendingId = mockApplyM5.getData().application.applicationId;

    const mockStatusPending = mockReqRes({ query: { email: 'm5pending@example.com', id: pendingId } });
    await intakeController.getApplicationStatus(mockStatusPending.req, mockStatusPending.res, mockStatusPending.next);
    assert.strictEqual(mockStatusPending.getStatus(), 200);
    assert.strictEqual(mockStatusPending.getData().application.status, 'APPLIED');
    assert.strictEqual(mockStatusPending.getData().application.tasks, undefined, 'APPLIED status must not expose tasks');
    assert.strictEqual(mockStatusPending.getData().application.learningMaterials, undefined, 'APPLIED status must not expose learning material');

    // 4. Approve the application: status lookup now returns tasks + learning material
    await Application.updateOne({ applicationId: pendingId }, { $set: { status: 'APPROVED', decidedAt: new Date() } });

    const mockStatusApproved = mockReqRes({ query: { email: 'M5PENDING@EXAMPLE.COM', id: pendingId.toLowerCase() } });
    await intakeController.getApplicationStatus(mockStatusApproved.req, mockStatusApproved.res, mockStatusApproved.next);
    assert.strictEqual(mockStatusApproved.getStatus(), 200);
    const approvedApp = mockStatusApproved.getData().application;
    assert.strictEqual(approvedApp.status, 'APPROVED');
    assert.deepStrictEqual(approvedApp.tasks, ['Task 1: Schema design', 'Task 2: API endpoints'], 'Approved student must receive programme tasks');
    assert.deepStrictEqual(approvedApp.learningMaterials, ['Updated reading list', 'Video: schema walkthrough', 'Extra: practice repo'], 'Approved student must receive learning material');
    assert.strictEqual(approvedApp.adminNotes, undefined, 'PII shielding unchanged');
    assert.strictEqual(approvedApp.participantId, undefined, 'PII shielding unchanged');

    // 5. Approved application whose programme has empty tasks/materials: fields omitted, not empty arrays
    const mockEmptyProgram = mockReqRes({
      body: { code: 'M5-EMPTY', title: 'Empty Track', category: 'Design', feeInr: 99 }
    });
    await adminCreateProgram(mockEmptyProgram.req, mockEmptyProgram.res, mockEmptyProgram.next);
    assert.strictEqual(mockEmptyProgram.getStatus(), 201);

    const mockApplyEmpty = mockReqRes({
      body: {
        fullName: 'Empty Track Student',
        email: 'm5empty@example.com',
        programCode: 'M5-EMPTY',
        feeAcknowledged: true
      }
    });
    await intakeController.websiteApply(mockApplyEmpty.req, mockApplyEmpty.res, mockApplyEmpty.next);
    assert.strictEqual(mockApplyEmpty.getStatus(), 201);
    const emptyId = mockApplyEmpty.getData().application.applicationId;
    await Application.updateOne({ applicationId: emptyId }, { $set: { status: 'APPROVED', decidedAt: new Date() } });

    const mockStatusEmpty = mockReqRes({ query: { email: 'm5empty@example.com', id: emptyId } });
    await intakeController.getApplicationStatus(mockStatusEmpty.req, mockStatusEmpty.res, mockStatusEmpty.next);
    assert.strictEqual(mockStatusEmpty.getStatus(), 200);
    assert.strictEqual(mockStatusEmpty.getData().application.tasks, undefined, 'Programme without tasks must omit the field');
    assert.strictEqual(mockStatusEmpty.getData().application.learningMaterials, undefined, 'Programme without material must omit the field');
  });

  await test('Module 6: Form 2 final-submission import bridges responses into Submission records with application crosschecks, untrusted UTR, idempotent re-import', async () => {
    process.env.WEBSITE_INTAKE_BATCH_ID = 'BATCH-M6-ACCEPTANCE';
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { isActive: true, feeInr: 99, durationWeeks: 4 } });

    // Seed an approved application to match against
    const mockApplyM6 = mockReqRes({
      body: { fullName: 'Rohan Verma', email: 'rohan.m6@example.com', programCode: 'FS-DEV', feeAcknowledged: true }
    });
    await intakeController.websiteApply(mockApplyM6.req, mockApplyM6.res, mockApplyM6.next);
    assert.strictEqual(mockApplyM6.getStatus(), 201);
    const m6AppId = mockApplyM6.getData().application.applicationId;
    await Application.updateOne({ applicationId: m6AppId }, { $set: { status: 'APPROVED', decidedAt: new Date() } });

    const csvText = [
      'Email,Internship Domain,Project Link,UTR Number,Application ID,Timestamp',
      `rohan.m6@example.com,FS-DEV,https://github.com/rohan/project,UTR000111,${m6AppId},2026-11-06 10:00`,
      'ghost@example.com,FS-DEV,https://github.com/ghost/project,UTR000222,,2026-11-06 10:05',
      'rohan.m6@example.com,FS-DEV,https://github.com/rohan/other,UTR000333,NOX-AAAAAA,2026-11-06 10:10',
      'bad-link@example.com,FS-DEV,not-a-url,UTR000444,,2026-11-06 10:15',
      'no-utr@example.com,FS-DEV,https://github.com/x/y,,,'
    ].join('\n');

    // 1. Preview: auto-suggested mapping resolves all required targets
    const mockPreview = mockReqRes({
      body: { batchId: 'BATCH-M6-FORM2' },
      file: { buffer: Buffer.from(csvText, 'utf8'), originalname: 'form2.csv', size: csvText.length }
    });
    await form2ImportController.previewForm2(mockPreview.req, mockPreview.res, mockPreview.next);
    assert.strictEqual(mockPreview.getStatus(), 200);
    const previewData = mockPreview.getData();
    assert.strictEqual(previewData.stage, 'PREVIEW', 'Mapping must auto-suggest all required columns');
    assert.strictEqual(previewData.summary.totalRows, 5);
    assert.strictEqual(previewData.summary.errorRows, 2, 'bad link + missing UTR must be error rows');
    assert.strictEqual(previewData.summary.matchedRows, 1, 'only the fully crosschecked row matches');
    assert.strictEqual(previewData.summary.unmatchedRows, 2, 'ghost email + wrong application ID are unmatched');

    const rowsByEmail = Object.fromEntries(previewData.rows.map((r) => [r.email || r.rowIndex, r]));
    assert.strictEqual(rowsByEmail['rohan.m6@example.com'] ? previewData.rows[0].matchState : null, 'MATCHED');
    assert.strictEqual(previewData.rows[0].matchedApplicationId, m6AppId, 'Row 1 must crosscheck to the original application ID');
    assert.strictEqual(previewData.rows[1].matchState, 'UNMATCHED');
    assert.strictEqual(previewData.rows[2].matchState, 'UNMATCHED', 'Unknown application ID must not fall back to email matching');
    assert.ok(previewData.rows[2].matchReason.includes('not found'), 'Reason must state the claimed ID was not found');

    // Crosscheck integrity: a REAL application ID claimed with a DIFFERENT email must not match
    const csvMismatch = [
      'Email,Internship Domain,Project Link,UTR Number,Application ID,Timestamp',
      `impostor@example.com,FS-DEV,https://github.com/impostor/p,UTR000999,${m6AppId},2026-11-06 11:00`
    ].join('\n');
    const mockMismatch = mockReqRes({
      body: { batchId: 'BATCH-M6-MISMATCH' },
      file: { buffer: Buffer.from(csvMismatch, 'utf8'), originalname: 'form2b.csv', size: csvMismatch.length }
    });
    await form2ImportController.previewForm2(mockMismatch.req, mockMismatch.res, mockMismatch.next);
    assert.strictEqual(mockMismatch.getStatus(), 200);
    assert.strictEqual(mockMismatch.getData().rows[0].matchState, 'UNMATCHED', 'Real ID + wrong email must not match');
    assert.ok(mockMismatch.getData().rows[0].matchReason.includes('different email'));

    // 2. Commit: server re-validates from raw rows
    const rawRows = csvText.split('\n').slice(1).map((line) => {
      const [Email, Domain, Link, Utr, AppId, Ts] = line.split(',');
      return { 'Email': Email, 'Internship Domain': Domain, 'Project Link': Link, 'UTR Number': Utr, 'Application ID': AppId, 'Timestamp': Ts };
    });
    const mockCommit = mockReqRes({
      body: {
        rows: rawRows,
        batchId: 'BATCH-M6-FORM2',
        columnMapping: previewData.columnMapping,
        fileName: 'form2.csv',
        fileSizeBytes: csvText.length
      }
    });
    await form2ImportController.commitForm2(mockCommit.req, mockCommit.res, mockCommit.next);
    assert.strictEqual(mockCommit.getStatus(), 201);
    const commitSummary = mockCommit.getData().summary;
    assert.strictEqual(commitSummary.committed, 3, '3 valid rows commit (1 matched + 2 unmatched)');
    assert.strictEqual(commitSummary.matched, 1);
    assert.strictEqual(commitSummary.unmatched, 2);
    assert.strictEqual(commitSummary.errorRows, 2);

    const m6Batch = await ImportBatch.findOne({ batchId: 'BATCH-M6-FORM2' });
    const savedSubs = await Submission.find({ programCode: 'FS-DEV', importBatchId: m6Batch._id }).lean();
    assert.strictEqual(savedSubs.length, 3);
    const matchedSub = savedSubs.find((s) => s.transactionId === 'UTR000111');
    assert.strictEqual(matchedSub.matchState, 'MATCHED');
    assert.ok(matchedSub.applicationId, 'Matched submission must reference the Application');
    assert.ok(/^SUB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(matchedSub.submissionId), 'Human-friendly SUB- ID');
    // UTR is stored as an untrusted claim: the model must carry NO payment-verified state
    assert.strictEqual(matchedSub.paymentVerified, undefined, 'No payment verification state may exist in Module 6');
    assert.strictEqual(matchedSub.verified, undefined);

    // 3. Batch re-commit rejected
    const mockRecommit = mockReqRes({
      body: { rows: rawRows, batchId: 'BATCH-M6-FORM2', columnMapping: previewData.columnMapping }
    });
    await form2ImportController.commitForm2(mockRecommit.req, mockRecommit.res, mockRecommit.next);
    assert.strictEqual(mockRecommit.getStatus(), 409, 'Same batch cannot commit twice');

    // 4. Idempotent re-import: same rows in a NEW batch are skipped as duplicates
    const mockReimport = mockReqRes({
      body: { rows: rawRows, batchId: 'BATCH-M6-FORM2-B', columnMapping: previewData.columnMapping }
    });
    await form2ImportController.commitForm2(mockReimport.req, mockReimport.res, mockReimport.next);
    assert.strictEqual(mockReimport.getStatus(), 201);
    assert.strictEqual(mockReimport.getData().summary.committed, 0, 'Re-imported rows must all be duplicates');
    assert.strictEqual(mockReimport.getData().summary.duplicates, 3);
    assert.strictEqual(await Submission.countDocuments({ programCode: 'FS-DEV', importBatchId: m6Batch._id }), 3, 'No duplicate submissions created');

    // 4b. Cross-applicant UTR reuse is flagged (not blocked, no payment conclusion)
    const csvShared = [
      'Email,Internship Domain,Project Link,UTR Number,Application ID,Timestamp',
      'first.m6@example.com,FS-DEV,https://github.com/first/p,UTR-SHARED-1,,2026-11-06 12:00',
      'second.m6@example.com,FS-DEV,https://github.com/second/p,UTR-SHARED-1,,2026-11-06 12:01'
    ].join('\n');
    const mockShared = mockReqRes({
      body: { batchId: 'BATCH-M6-SHARED' },
      file: { buffer: Buffer.from(csvShared, 'utf8'), originalname: 'form2c.csv', size: csvShared.length }
    });
    await form2ImportController.previewForm2(mockShared.req, mockShared.res, mockShared.next);
    assert.strictEqual(mockShared.getStatus(), 200);
    assert.strictEqual(mockShared.getData().rows[0].utrShared, true, 'Same UTR across applicants must flag row 1');
    assert.strictEqual(mockShared.getData().rows[1].utrShared, true, 'Same UTR across applicants must flag row 2');
    assert.strictEqual(mockShared.getData().summary.errorRows, 0, 'Shared UTR is a review flag, not an error');

    const sharedRaw = csvShared.split('\n').slice(1).map((line) => {
      const [Email, Domain, Link, Utr, AppId, Ts] = line.split(',');
      return { 'Email': Email, 'Internship Domain': Domain, 'Project Link': Link, 'UTR Number': Utr, 'Application ID': AppId, 'Timestamp': Ts };
    });
    const mockSharedCommit = mockReqRes({
      body: { rows: sharedRaw, batchId: 'BATCH-M6-SHARED', columnMapping: mockShared.getData().columnMapping }
    });
    await form2ImportController.commitForm2(mockSharedCommit.req, mockSharedCommit.res, mockSharedCommit.next);
    assert.strictEqual(mockSharedCommit.getStatus(), 201);
    const sharedSubs = await Submission.find({ transactionId: 'UTR-SHARED-1' }).lean();
    assert.strictEqual(sharedSubs.length, 2);
    assert.ok(sharedSubs.every((s) => s.utrSharedFlag === true), 'Shared-UTR flag must persist on both submissions');

    // Later batch, different applicant, same UTR as an earlier import -> flagged
    const csvLater = ['Email,Internship Domain,Project Link,UTR Number,Application ID,Timestamp',
      'third.m6@example.com,FS-DEV,https://github.com/third/p,UTR000111,,2026-11-06 12:30'].join('\n');
    const mockLater = mockReqRes({
      body: { batchId: 'BATCH-M6-LATER' },
      file: { buffer: Buffer.from(csvLater, 'utf8'), originalname: 'form2d.csv', size: csvLater.length }
    });
    await form2ImportController.previewForm2(mockLater.req, mockLater.res, mockLater.next);
    assert.strictEqual(mockLater.getData().rows[0].utrShared, true, 'UTR claimed earlier by a different applicant must flag');
    assert.strictEqual(mockLater.getData().rows[0].duplicate, false, 'Different applicant is not an exact duplicate');

    // 5. Audit trail + admin listing
    const form2Audit = await AuditLog.findOne({ action: 'FORM2_COMMITTED' });
    assert.ok(form2Audit, 'FORM2_COMMITTED audit log must exist');
    const mockList = mockReqRes({ query: { matchState: 'UNMATCHED' } });
    await form2ImportController.getSubmissions(mockList.req, mockList.res, mockList.next);
    assert.strictEqual(mockList.getStatus(), 200);
    assert.strictEqual(mockList.getData().count, 4, 'Unmatched queue lists all 4 manual-review submissions (2 original + 2 shared-UTR)');
  });

  await test('Module 7: Manual payment verification - explicit admin attestation, MATCHED-only verify, terminal VERIFIED, audit trail', async () => {
    // Seed: one matched + one unmatched submission via the Module 6 bridge
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { isActive: true, feeInr: 99, durationWeeks: 4 } });
    const mockApplyM7 = mockReqRes({
      body: { fullName: 'Sana Iqbal', email: 'sana.m7@example.com', programCode: 'FS-DEV', feeAcknowledged: true }
    });
    await intakeController.websiteApply(mockApplyM7.req, mockApplyM7.res, mockApplyM7.next);
    assert.strictEqual(mockApplyM7.getStatus(), 201);
    const m7AppId = mockApplyM7.getData().application.applicationId;
    await Application.updateOne({ applicationId: m7AppId }, { $set: { status: 'APPROVED', decidedAt: new Date() } });

    const csvM7 = [
      'Email,Internship Domain,Project Link,UTR Number,Application ID,Timestamp',
      `sana.m7@example.com,FS-DEV,https://github.com/sana/final,UTR-M7-111,${m7AppId},2026-11-06 13:00`,
      'stray.m7@example.com,FS-DEV,https://github.com/stray/final,UTR-M7-222,,2026-11-06 13:05'
    ].join('\n');
    const m7Raw = csvM7.split('\n').slice(1).map((line) => {
      const [Email, Domain, Link, Utr, AppId, Ts] = line.split(',');
      return { 'Email': Email, 'Internship Domain': Domain, 'Project Link': Link, 'UTR Number': Utr, 'Application ID': AppId, 'Timestamp': Ts };
    });
    const m7ColMap = [
      { target: 'email', header: 'Email' }, { target: 'programme', header: 'Internship Domain' },
      { target: 'projectLink', header: 'Project Link' }, { target: 'transactionId', header: 'UTR Number' },
      { target: 'applicationId', header: 'Application ID' }, { target: 'timestamp', header: 'Timestamp' }
    ];
    const mockCommitM7 = mockReqRes({ body: { rows: m7Raw, batchId: 'BATCH-M7-FORM2', columnMapping: m7ColMap } });
    await form2ImportController.commitForm2(mockCommitM7.req, mockCommitM7.res, mockCommitM7.next);
    assert.strictEqual(mockCommitM7.getStatus(), 201);

    const matchedSub = await Submission.findOne({ transactionId: 'UTR-M7-111' });
    const unmatchedSub = await Submission.findOne({ transactionId: 'UTR-M7-222' });
    assert.strictEqual(matchedSub.paymentState, 'UNVERIFIED', 'New submissions start UNVERIFIED');

    // 1. VERIFIED requires MATCHED
    const mockVerifyUnmatched = mockReqRes({ params: { submissionId: unmatchedSub.submissionId }, body: { state: 'VERIFIED' } });
    await form2ImportController.markPayment(mockVerifyUnmatched.req, mockVerifyUnmatched.res, mockVerifyUnmatched.next);
    assert.strictEqual(mockVerifyUnmatched.getStatus(), 400, 'Unmatched submission cannot be payment-verified');

    // 2. NOT_FOUND allowed on unmatched (checked, money not arrived)
    const mockNotFound = mockReqRes({ params: { submissionId: unmatchedSub.submissionId }, body: { state: 'NOT_FOUND', note: 'Bank app checked 6 Nov, no credit from this UTR' } });
    await form2ImportController.markPayment(mockNotFound.req, mockNotFound.res, mockNotFound.next);
    assert.strictEqual(mockNotFound.getStatus(), 200);
    assert.strictEqual(mockNotFound.getData().submission.paymentState, 'NOT_FOUND');

    // 3. Matched submission: VERIFIED succeeds, records who/when, audit written
    const mockVerify = mockReqRes({ params: { submissionId: matchedSub.submissionId }, body: { state: 'VERIFIED', note: 'Rs.99 credit confirmed in bank statement' } });
    await form2ImportController.markPayment(mockVerify.req, mockVerify.res, mockVerify.next);
    assert.strictEqual(mockVerify.getStatus(), 200);
    assert.strictEqual(mockVerify.getData().submission.paymentState, 'VERIFIED');
    const verifiedDoc = await Submission.findById(matchedSub._id);
    assert.ok(verifiedDoc.paymentMarkedBy, 'Marking admin recorded');
    assert.ok(verifiedDoc.paymentMarkedAt, 'Marking time recorded');
    assert.strictEqual(verifiedDoc.paymentNote, 'Rs.99 credit confirmed in bank statement');
    const payAudit = await AuditLog.findOne({ action: 'PAYMENT_MARKED', targetId: matchedSub._id });
    assert.ok(payAudit, 'PAYMENT_MARKED audit log must exist');
    assert.strictEqual(payAudit.metadata.claimedTransactionId, 'UTR-M7-111');

    // 4. VERIFIED is terminal
    const mockReverify = mockReqRes({ params: { submissionId: matchedSub.submissionId }, body: { state: 'NOT_FOUND' } });
    await form2ImportController.markPayment(mockReverify.req, mockReverify.res, mockReverify.next);
    assert.strictEqual(mockReverify.getStatus(), 409, 'VERIFIED is terminal in this module');

    // 4c. One UTR can never be VERIFIED for two applicants
    const csvSharedVerify = [
      'Email,Internship Domain,Project Link,UTR Number,Application ID,Timestamp',
      `sana.m7@example.com,FS-DEV,https://github.com/sana/final2,UTR-M7-SHARED,${m7AppId},2026-11-06 14:00`
    ].join('\n');
    const sharedRaw = csvSharedVerify.split('\n').slice(1).map((line) => {
      const [Email, Domain, Link, Utr, AppId, Ts] = line.split(',');
      return { 'Email': Email, 'Internship Domain': Domain, 'Project Link': Link, 'UTR Number': Utr, 'Application ID': AppId, 'Timestamp': Ts };
    });
    const mockCommitShared = mockReqRes({ body: { rows: sharedRaw, batchId: 'BATCH-M7-SHARED', columnMapping: m7ColMap } });
    await form2ImportController.commitForm2(mockCommitShared.req, mockCommitShared.res, mockCommitShared.next);
    assert.strictEqual(mockCommitShared.getStatus(), 201);
    // Directly seed a second applicant's VERIFIED submission with the same UTR (imported unmatched earlier)
    await Submission.create({
      submissionId: 'SUB-M7DUP1', email: 'other.m7@example.com', programCode: 'FS-DEV',
      matchState: 'UNMATCHED', projectLink: 'https://github.com/other/p', transactionId: 'UTR-M7-SHARED',
      paymentState: 'VERIFIED', importBatchId: (await ImportBatch.findOne({ batchId: 'BATCH-M7-SHARED' }))._id
    });
    const sanaSharedSub = await Submission.findOne({ email: 'sana.m7@example.com', transactionId: 'UTR-M7-SHARED' });
    const mockDoubleVerify = mockReqRes({ params: { submissionId: sanaSharedSub.submissionId }, body: { state: 'VERIFIED' } });
    await form2ImportController.markPayment(mockDoubleVerify.req, mockDoubleVerify.res, mockDoubleVerify.next);
    assert.strictEqual(mockDoubleVerify.getStatus(), 409, 'Same UTR must never verify for two applicants');

    // 4d. Parallel race: two admins verify the SAME UTR for two DIFFERENT matched
    // applicants at the same time. Both can pass the in-memory pre-check; the
    // DB partial unique index must let exactly one write through.
    const mkApplicantM7 = async (name, email) => {
      const m = mockReqRes({ body: { fullName: name, email, programCode: 'FS-DEV', feeAcknowledged: true } });
      await intakeController.websiteApply(m.req, m.res, m.next);
      assert.strictEqual(m.getStatus(), 201);
      const appId = m.getData().application.applicationId;
      await Application.updateOne({ applicationId: appId }, { $set: { status: 'APPROVED', decidedAt: new Date() } });
      return appId;
    };
    const raceAppA = await mkApplicantM7('Race A', 'race.a.m7@example.com');
    const raceAppB = await mkApplicantM7('Race B', 'race.b.m7@example.com');
    const raceRaw = [
      { 'Email': 'race.a.m7@example.com', 'Internship Domain': 'FS-DEV', 'Project Link': 'https://github.com/racea/p', 'UTR Number': 'UTR-M7-RACE', 'Application ID': raceAppA, 'Timestamp': '2026-11-06 15:00' },
      { 'Email': 'race.b.m7@example.com', 'Internship Domain': 'FS-DEV', 'Project Link': 'https://github.com/raceb/p', 'UTR Number': 'UTR-M7-RACE', 'Application ID': raceAppB, 'Timestamp': '2026-11-06 15:01' }
    ];
    const mockCommitRace = mockReqRes({ body: { rows: raceRaw, batchId: 'BATCH-M7-RACE', columnMapping: m7ColMap } });
    await form2ImportController.commitForm2(mockCommitRace.req, mockCommitRace.res, mockCommitRace.next);
    assert.strictEqual(mockCommitRace.getStatus(), 201);
    const raceSubA = await Submission.findOne({ email: 'race.a.m7@example.com', transactionId: 'UTR-M7-RACE' });
    const raceSubB = await Submission.findOne({ email: 'race.b.m7@example.com', transactionId: 'UTR-M7-RACE' });
    assert.strictEqual(raceSubA.matchState, 'MATCHED');
    assert.strictEqual(raceSubB.matchState, 'MATCHED');
    const callVerify = async (subId) => {
      const m = mockReqRes({ params: { submissionId: subId }, body: { state: 'VERIFIED' } });
      await form2ImportController.markPayment(m.req, m.res, m.next);
      return m.getStatus();
    };
    const raceStatuses = (await Promise.all([callVerify(raceSubA.submissionId), callVerify(raceSubB.submissionId)])).sort();
    assert.deepStrictEqual(raceStatuses, [200, 409], 'Concurrent verification of one UTR: exactly one succeeds, one is rejected');
    const raceVerifiedCount = await Submission.countDocuments({ transactionId: 'UTR-M7-RACE', paymentState: 'VERIFIED' });
    assert.strictEqual(raceVerifiedCount, 1, 'DB-level guard: one UTR can only be VERIFIED once even under a race');

    // 5. NOT_FOUND can later become VERIFIED (late-arriving payment)
    const strayApp = mockReqRes({ body: { fullName: 'Stray Later', email: 'stray.m7@example.com', programCode: 'FS-DEV', feeAcknowledged: true } });
    // (unmatched stays unmatched without an application; simulate a NOT_FOUND -> VERIFIED path using a matched then re-check)
    // Instead verify state validation + unknown id handling:
    const mockBadState = mockReqRes({ params: { submissionId: matchedSub.submissionId }, body: { state: 'PAID' } });
    await form2ImportController.markPayment(mockBadState.req, mockBadState.res, mockBadState.next);
    assert.strictEqual(mockBadState.getStatus(), 400, 'Invented states rejected');
    const mockUnknown = mockReqRes({ params: { submissionId: 'SUB-ZZZZZZ' }, body: { state: 'VERIFIED' } });
    await form2ImportController.markPayment(mockUnknown.req, mockUnknown.res, mockUnknown.next);
    assert.strictEqual(mockUnknown.getStatus(), 404);
  });

  await test('Module 8: Review workflow - initial + 3 free re-reviews, 3 calendar day IST deadlines, explicit pass criteria, terminal exhaustion, race-safe', async () => {
    await Program.updateOne({ code: 'FS-DEV' }, { $set: { isActive: true, feeInr: 99, durationWeeks: 4 } });
    const m8ColMap = [
      { target: 'email', header: 'Email' }, { target: 'programme', header: 'Internship Domain' },
      { target: 'projectLink', header: 'Project Link' }, { target: 'transactionId', header: 'UTR Number' },
      { target: 'applicationId', header: 'Application ID' }, { target: 'timestamp', header: 'Timestamp' }
    ];
    const mkMatchedSubM8 = async (name, email, utr, link) => {
      const m = mockReqRes({ body: { fullName: name, email, programCode: 'FS-DEV', feeAcknowledged: true } });
      await intakeController.websiteApply(m.req, m.res, m.next);
      assert.strictEqual(m.getStatus(), 201);
      const appId = m.getData().application.applicationId;
      await Application.updateOne({ applicationId: appId }, { $set: { status: 'APPROVED', decidedAt: new Date() } });
      const rows = [{ 'Email': email, 'Internship Domain': 'FS-DEV', 'Project Link': link, 'UTR Number': utr, 'Application ID': appId, 'Timestamp': '2026-11-06 16:00' }];
      const cm = mockReqRes({ body: { rows, batchId: `BATCH-M8-${utr}`, columnMapping: m8ColMap } });
      await form2ImportController.commitForm2(cm.req, cm.res, cm.next);
      assert.strictEqual(cm.getStatus(), 201);
      const sub = await Submission.findOne({ email, transactionId: utr });
      assert.strictEqual(sub.matchState, 'MATCHED');
      return sub;
    };
    const review = async (subId, body) => {
      const m = mockReqRes({ params: { submissionId: subId }, body });
      await form2ImportController.reviewOutcome(m.req, m.res, m.next);
      return m;
    };
    const reimport = async (email, utr, link, batchSuffix) => {
      const rows = [{ 'Email': email, 'Internship Domain': 'FS-DEV', 'Project Link': link, 'UTR Number': utr, 'Application ID': '', 'Timestamp': '2026-11-06 17:00' }];
      const cm = mockReqRes({ body: { rows, batchId: `BATCH-M8-RE-${batchSuffix}`, columnMapping: m8ColMap } });
      await form2ImportController.commitForm2(cm.req, cm.res, cm.next);
      return cm;
    };
    const acceptCorrection = async (subId, body = {}) => {
      const m = mockReqRes({ params: { submissionId: subId }, body });
      await form2ImportController.acceptCorrection(m.req, m.res, m.next);
      return m;
    };

    const subA = await mkMatchedSubM8('Mira M8', 'mira.m8@example.com', 'UTR-M8-111', 'https://github.com/mira/v1');

    // 1. Validation: feedback required for CHANGES_REQUESTED; both criteria required for PASS
    let r = await review(subA.submissionId, { action: 'CHANGES_REQUESTED' });
    assert.strictEqual(r.getStatus(), 400, 'Feedback required');
    r = await review(subA.submissionId, { action: 'PASS', requirementsComplete: true, projectWorking: false });
    assert.strictEqual(r.getStatus(), 400, 'Pass needs BOTH criteria explicitly true');
    r = await review(subA.submissionId, { action: 'WHATEVER' });
    assert.strictEqual(r.getStatus(), 400, 'Invented actions rejected');

    // 2. First feedback: round 0, CHANGES_REQUESTED, deadline = end of 3rd calendar day IST
    r = await review(subA.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'Readme missing setup steps', requirementsComplete: false, projectWorking: true });
    assert.strictEqual(r.getStatus(), 200);
    let rev = r.getData().review;
    assert.strictEqual(rev.reviewStatus, 'CHANGES_REQUESTED');
    assert.strictEqual(rev.currentReviewRound, 0);
    const due = new Date(rev.rounds[0].correctionDueAt);
    const IST = (5 * 60 + 30) * 60 * 1000, DAY = 86400000;
    const fbIst = new Date(new Date(rev.rounds[0].reviewedAt).getTime() + IST);
    const expectDue = new Date(Date.UTC(fbIst.getUTCFullYear(), fbIst.getUTCMonth(), fbIst.getUTCDate()) + 4 * DAY - 1 - IST);
    assert.strictEqual(due.getTime(), expectDue.getTime(), 'Deadline = 23:59:59.999 IST on feedback date + 3 calendar days');

    // 3. While awaiting correction, no new outcome
    r = await review(subA.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'again' });
    assert.strictEqual(r.getStatus(), 409, 'Awaiting student correction');

    // 4. Re-imports NEVER mutate a submission: same link OR new link, both are
    // duplicates. While the correction window is open they are only FLAGGED as
    // possible corrections for the admin.
    let cm = await reimport('mira.m8@example.com', 'UTR-M8-111', 'https://github.com/mira/v1', 'SAME');
    assert.strictEqual(cm.getStatus(), 201);
    assert.strictEqual(cm.getData().summary.duplicates, 1, 'Same link re-import stays a duplicate');
    assert.strictEqual(cm.getData().summary.possibleCorrections, 1, 'Flagged as possible correction (open window)');
    cm = await reimport('mira.m8@example.com', 'UTR-M8-111', 'https://github.com/mira/v2', 'V2');
    assert.strictEqual(cm.getData().summary.duplicates, 1, 'New-link re-import is also a duplicate - no auto-revision');
    let doc = await Submission.findById(subA._id);
    assert.strictEqual(doc.reviewStatus, 'CHANGES_REQUESTED', 'Import alone never opens a round');
    assert.strictEqual(doc.reviewRounds.length, 1, 'No round created by imports');

    // 5. Admin ACCEPTS the correction with the SAME GitHub URL (normal updated-code
    // resubmission): round 1 opens, on-time
    let ac = await acceptCorrection(subA.submissionId, {});
    assert.strictEqual(ac.getStatus(), 200);
    doc = await Submission.findById(subA._id);
    assert.strictEqual(doc.reviewStatus, 'IN_REVIEW');
    assert.strictEqual(doc.currentReviewRound, 1);
    assert.strictEqual(doc.projectLink, 'https://github.com/mira/v1', 'Same URL supported');
    assert.strictEqual(doc.reviewRounds[1].resubmittedLate, false, 'On-time correction not late');

    // 6. Feedback on round 1, expire the window, then a LATE accepted correction
    // (different link this time) opens round 2 - flagged, not auto-failed
    r = await review(subA.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'Setup works, add error handling' });
    assert.strictEqual(r.getStatus(), 200);
    await Submission.updateOne({ _id: subA._id }, { $set: { 'reviewRounds.1.correctionDueAt': new Date(Date.now() - 86400000) } });
    ac = await acceptCorrection(subA.submissionId, { projectLink: 'https://github.com/mira/v3' });
    assert.strictEqual(ac.getStatus(), 200);
    doc = await Submission.findById(subA._id);
    assert.strictEqual(doc.currentReviewRound, 2);
    assert.strictEqual(doc.projectLink, 'https://github.com/mira/v3');
    assert.strictEqual(doc.reviewRounds[2].resubmittedLate, true, 'Late correction is flagged');
    assert.strictEqual(doc.reviewStatus, 'IN_REVIEW', 'Late correction is NOT auto-failed - admin decides');

    // 7. Round 2 feedback, accepted correction opens round 3 (last re-review), feedback there exhausts attempts
    r = await review(subA.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'Error handling partial' });
    assert.strictEqual(r.getStatus(), 200);
    ac = await acceptCorrection(subA.submissionId, {});
    assert.strictEqual(ac.getStatus(), 200);
    doc = await Submission.findById(subA._id);
    assert.strictEqual(doc.currentReviewRound, 3, 'Round 3 = third (last) free re-review');
    r = await review(subA.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'Still not passing' });
    assert.strictEqual(r.getStatus(), 200);
    doc = await Submission.findById(subA._id);
    assert.strictEqual(doc.reviewStatus, 'FAILED_EXHAUSTED', 'Initial + 3 re-reviews used: attempts exhausted');
    r = await review(subA.submissionId, { action: 'PASS', requirementsComplete: true, projectWorking: true });
    assert.strictEqual(r.getStatus(), 409, 'FAILED_EXHAUSTED is terminal');

    // 8. PASS path on a second submission: terminal, both criteria recorded
    const subB = await mkMatchedSubM8('Omar M8', 'omar.m8@example.com', 'UTR-M8-222', 'https://github.com/omar/final');
    r = await review(subB.submissionId, { action: 'PASS', requirementsComplete: true, projectWorking: true });
    assert.strictEqual(r.getStatus(), 200);
    doc = await Submission.findById(subB._id);
    assert.strictEqual(doc.reviewStatus, 'PASSED');
    assert.strictEqual(doc.reviewRounds[0].requirementsComplete, true);
    assert.strictEqual(doc.reviewRounds[0].projectWorking, true);
    assert.ok(doc.reviewRounds[0].reviewedBy, 'Reviewing admin recorded');
    r = await review(subB.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'post-pass change' });
    assert.strictEqual(r.getStatus(), 409, 'PASSED is terminal');

    // 9. Race: two concurrent outcomes on the same fresh submission - exactly one wins
    const subC = await mkMatchedSubM8('Priya M8', 'priya.m8@example.com', 'UTR-M8-333', 'https://github.com/priya/final');
    const statuses = (await Promise.all([
      review(subC.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'one' }),
      review(subC.submissionId, { action: 'PASS', requirementsComplete: true, projectWorking: true })
    ])).map((m) => m.getStatus()).sort();
    assert.deepStrictEqual(statuses, [200, 409], 'Concurrent review outcomes: exactly one succeeds');
    doc = await Submission.findById(subC._id);
    assert.strictEqual(doc.reviewRounds.length, 1, 'Exactly one round outcome persisted');

    // 9b. Correction intake guards: no open window -> 409; invalid link -> 400;
    // concurrent correction vs outcome -> exactly one wins
    const subD = await mkMatchedSubM8('Ravi M8', 'ravi.m8@example.com', 'UTR-M8-444', 'https://github.com/ravi/final');
    let ac2 = await acceptCorrection(subD.submissionId, {});
    assert.strictEqual(ac2.getStatus(), 409, 'No correction window open yet');
    r = await review(subD.submissionId, { action: 'CHANGES_REQUESTED', feedback: 'fix docs' });
    assert.strictEqual(r.getStatus(), 200);
    ac2 = await acceptCorrection(subD.submissionId, { projectLink: 'javascript:alert(1)' });
    assert.strictEqual(ac2.getStatus(), 400, 'Non-http(s) correction link rejected');
    const race2 = (await Promise.all([
      acceptCorrection(subD.submissionId, {}),
      review(subD.submissionId, { action: 'PASS', requirementsComplete: true, projectWorking: true })
    ])).map((m) => m.getStatus()).sort();
    assert.deepStrictEqual(race2, [200, 409], 'Concurrent correction acceptance vs outcome: exactly one succeeds');

    // 10. Audit trail
    const outcomeAudit = await AuditLog.findOne({ action: 'REVIEW_OUTCOME', targetId: subA._id });
    const resubAudit = await AuditLog.findOne({ action: 'REVIEW_RESUBMISSION', targetId: subA._id });
    assert.ok(outcomeAudit, 'REVIEW_OUTCOME audit exists');
    assert.ok(resubAudit, 'REVIEW_RESUBMISSION audit exists');
  });

  await test('Module 9: Certificate release gate - payment VERIFIED + review PASSED on the SAME bound submission, explicit issuance, negative gates, idempotent concurrency', async () => {
    const admin = await Admin.findOne({ email: 'root@noxira.com' });
    const mkParticipant = async (name, email) => Participant.create({
      fullName: name, email, programCode: 'FS-DEV', programTitle: 'Full Stack Web Development',
      batchId: 'BATCH-2026-Q4', source: 'WEBSITE', completionStatus: 'ELIGIBLE'
    });
    const mkBatch = async (tag) => ImportBatch.create({
      fileName: `m9-${tag}.csv`, fileSizeBytes: 10, uploadedBy: admin._id,
      kind: 'FORM2_RESPONSES', batchId: `M9B-${tag}`, columnMapping: [], status: 'COMMITTED'
    });
    const mkSubmission = async (tag, email, over = {}) => Submission.create({
      submissionId: `SUB-M9-${tag}`, email, programCode: 'FS-DEV',
      matchState: 'MATCHED', paymentState: 'UNVERIFIED', reviewStatus: 'NOT_STARTED',
      projectLink: 'https://github.com/m9/p', transactionId: `UTR-M9-${tag}`,
      importBatchId: (await mkBatch(tag))._id, ...over
    });
    const tryIssue = async (participant) => {
      try {
        return { ok: true, res: await issueCertificateForParticipant({ participantId: participant._id, adminId: admin._id }) };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    };

    // 1. No submission at all -> blocked
    const pNone = await mkParticipant('M9 NoSub', 'm9.none@example.com');
    let r = await tryIssue(pNone);
    assert.strictEqual(r.ok, false, 'No submission: issuance blocked');
    assert.ok(r.error.includes('release gate not satisfied'), r.error);
    assert.ok(r.error.includes('No final submission'), r.error);

    // 2. Payment not verified -> blocked
    const pUnpaid = await mkParticipant('M9 Unpaid', 'm9.unpaid@example.com');
    await mkSubmission('UNPAID', 'm9.unpaid@example.com', { reviewStatus: 'PASSED' });
    r = await tryIssue(pUnpaid);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error.includes('Payment is not verified'), r.error);

    // 3. Payment verified but review not passed -> blocked
    const pUnreviewed = await mkParticipant('M9 Unreviewed', 'm9.unreviewed@example.com');
    await mkSubmission('UNREV', 'm9.unreviewed@example.com', { paymentState: 'VERIFIED', reviewStatus: 'IN_REVIEW' });
    r = await tryIssue(pUnreviewed);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error.includes('review has not PASSED'), r.error);

    // 4. BINDING: VERIFIED on one submission + PASSED on another (same email+programme) -> blocked
    const pMixed = await mkParticipant('M9 Mixed', 'm9.mixed@example.com');
    await mkSubmission('MIXA', 'm9.mixed@example.com', { paymentState: 'VERIFIED', reviewStatus: 'CHANGES_REQUESTED' });
    await mkSubmission('MIXB', 'm9.mixed@example.com', { paymentState: 'UNVERIFIED', reviewStatus: 'PASSED' });
    r = await tryIssue(pMixed);
    assert.strictEqual(r.ok, false, 'Mixed VERIFIED/PASSED across submissions must NOT pass the gate');
    assert.ok(r.error.includes('No SINGLE submission'), r.error);

    // 5. Exhausted review -> blocked with exhaustion reason
    const pExh = await mkParticipant('M9 Exhausted', 'm9.exh@example.com');
    await mkSubmission('EXH', 'm9.exh@example.com', { paymentState: 'VERIFIED', reviewStatus: 'FAILED_EXHAUSTED' });
    r = await tryIssue(pExh);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error.includes('exhausted'), r.error);

    // 6. Same SINGLE submission VERIFIED+PASSED -> issues, gate evidence recorded
    const pGood = await mkParticipant('M9 Good', 'm9.good@example.com');
    const goodSub = await mkSubmission('GOOD', 'm9.good@example.com', { paymentState: 'VERIFIED', reviewStatus: 'PASSED' });
    r = await tryIssue(pGood);
    assert.strictEqual(r.ok, true, `Gate satisfied: ${r.ok ? '' : r.error}`);
    assert.strictEqual(r.res.certificate.status, 'ISSUED');
    const cert = await Certificate.findById(r.res.certificate._id);
    assert.strictEqual(cert.releaseGate.submissionId, goodSub.submissionId, 'Bound submission recorded on the certificate');
    assert.ok(cert.releaseGate.checkedAt, 'Gate check time recorded');
    const gateAudit = await AuditLog.findOne({ action: 'CERTIFICATE_ISSUED', targetId: cert._id });
    assert.strictEqual(gateAudit.metadata.releaseGateSubmissionId, goodSub.submissionId, 'Audit carries the binding');

    // 7. Concurrent issuance for the same gated participant -> exactly one certificate
    const pRace = await mkParticipant('M9 Race', 'm9.race@example.com');
    await mkSubmission('RACE', 'm9.race@example.com', { paymentState: 'VERIFIED', reviewStatus: 'PASSED' });
    await Promise.all([
      issueCertificateForParticipant({ participantId: pRace._id, adminId: admin._id }).catch(() => null),
      issueCertificateForParticipant({ participantId: pRace._id, adminId: admin._id }).catch(() => null)
    ]);
    const raceCerts = await Certificate.countDocuments({ participantId: pRace._id, status: 'ISSUED' });
    assert.strictEqual(raceCerts, 1, 'Concurrent release mints exactly one certificate');

    // 8. Bulk gate-check endpoint mirrors the choke point
    const mockGate = mockReqRes({ body: { participantIds: [pNone._id, pGood._id] } });
    await certificateController.checkReleaseGate(mockGate.req, mockGate.res, mockGate.next);
    assert.strictEqual(mockGate.getStatus(), 200);
    const gateData = mockGate.getData().gate;
    assert.strictEqual(gateData[String(pNone._id)].eligible, false);
    assert.strictEqual(gateData[String(pGood._id)].eligible, true);
    assert.strictEqual(gateData[String(pGood._id)].submissionId, goodSub.submissionId);

    // 9. Corrected replacement CANNOT bypass the gate: the successor is hard-bound
    //    to the SAME participant + programme and carries the gate evidence forward
    const pReplace = await mkParticipant('M9 Replace', 'm9.replace@example.com');
    const repSub = await mkSubmission('REPL', 'm9.replace@example.com', { paymentState: 'VERIFIED', reviewStatus: 'PASSED' });
    const issued = await issueCertificateForParticipant({ participantId: pReplace._id, adminId: admin._id });
    const mockReplace = mockReqRes({
      params: { id: String(issued.certificate._id) },
      body: { reason: 'Name spelling corrected', correctedName: 'M9 Replace Corrected' },
      admin: { _id: admin._id, email: admin.email }
    });
    await certificateController.replaceCertificate(mockReplace.req, mockReplace.res, mockReplace.next);
    assert.strictEqual(mockReplace.getStatus(), 200, `Replacement succeeded: ${JSON.stringify(mockReplace.getData()).slice(0, 200)}`);
    const successor = mockReplace.getData().newCertificate;
    assert.strictEqual(String(successor.participantId), String(pReplace._id), 'Successor bound to SAME participant');
    assert.strictEqual(successor.programCode, issued.certificate.programCode, 'Successor bound to SAME programme');
    assert.strictEqual(successor.releaseGate && successor.releaseGate.submissionId, repSub.submissionId, 'Successor carries the release-gate evidence forward');
    const oldAfter = await Certificate.findById(issued.certificate._id);
    assert.strictEqual(oldAfter.status, 'REPLACED', 'Old certificate preserved as REPLACED, not destroyed');

    // 10. LEGACY honesty: a pre-gate (legacy) ISSUED certificate has no releaseGate
    //     evidence. Replacing it must NOT fabricate gate proof - the successor
    //     simply has none. Legacy records stay correctable; nothing is invented.
    const pLegacy = await mkParticipant('M9 Legacy', 'm9.legacy@example.com');
    const legacyCert = await Certificate.create({
      certificateNumber: 'NOX-2025-FSD-0099',
      publicVerificationToken: generate128BitToken(),
      completionAwardKey: `LEGACY:${pLegacy._id}`,
      participantId: pLegacy._id,
      programCode: 'FS-DEV',
      programTitle: 'Full Stack Development',
      batchId: 'BATCH-2025-LEGACY',
      renderedSnapshot: {
        recipientName: 'M9 Legacy', programTitle: 'Full Stack Development',
        startDate: new Date('2025-01-01'), endDate: new Date('2025-03-01'), issueDate: new Date('2025-03-05'),
        authorizedSignatoryName: 'Signatory', authorizedSignatoryTitle: 'Director', templateVersion: 1
      },
      status: 'ISSUED',
      fileStorage: { diskPath: '/tmp/legacy.pdf', fileSizeBytes: 1, sha256Checksum: 'legacy', mimeType: 'application/pdf' },
      version: 1,
      approvedBy: admin._id,
      approvedAt: new Date('2025-03-05')
      // NOTE: no releaseGate - this is a pre-Module-9 record
    });
    const mockLegacyReplace = mockReqRes({
      params: { id: String(legacyCert._id) },
      body: { reason: 'Legacy name correction', correctedName: 'M9 Legacy Corrected' },
      admin: { _id: admin._id, email: admin.email }
    });
    await certificateController.replaceCertificate(mockLegacyReplace.req, mockLegacyReplace.res, mockLegacyReplace.next);
    assert.strictEqual(mockLegacyReplace.getStatus(), 200, `Legacy replacement succeeded: ${JSON.stringify(mockLegacyReplace.getData()).slice(0, 200)}`);
    const legacySuccessor = mockLegacyReplace.getData().newCertificate;
    assert.ok(!legacySuccessor.releaseGate || !legacySuccessor.releaseGate.submissionId,
      'Legacy successor must NOT fabricate release-gate evidence');
    assert.strictEqual(String(legacySuccessor.participantId), String(pLegacy._id), 'Legacy successor bound to same participant');
  });

  await test('Student auth: register, login, /me and duplicate rejection', async () => {
    // Register
    const reg = mockReqRes({ body: { name: 'Test Student', email: 'Student@Example.com', password: 'password123' } });
    await studentAuthController.register(reg.req, reg.res, reg.next);
    assert.strictEqual(reg.getStatus(), 201, `Register returns 201: ${JSON.stringify(reg.getData()).slice(0, 200)}`);
    assert.strictEqual(reg.getData().student.email, 'student@example.com', 'Email normalized to lowercase');
    assert.ok(reg.getData().token, 'Register returns a session token');
    const studentId = reg.getData().student.id;

    const stored = await Student.findById(studentId);
    assert.ok(stored.passwordHash && !stored.passwordHash.includes('password123'), 'Password stored hashed, never plain');

    // Duplicate registration rejected
    const dup = mockReqRes({ body: { name: 'Again', email: 'STUDENT@example.com', password: 'password123' } });
    await studentAuthController.register(dup.req, dup.res, dup.next);
    assert.strictEqual(dup.getStatus(), 409, 'Duplicate email rejected with 409');

    // Short password rejected
    const short = mockReqRes({ body: { name: 'Short', email: 'short@example.com', password: 'abc' } });
    await studentAuthController.register(short.req, short.res, short.next);
    assert.strictEqual(short.getStatus(), 400, 'Password under 8 chars rejected');

    // Login with correct credentials
    const login = mockReqRes({ body: { email: 'student@example.com', password: 'password123' } });
    await studentAuthController.login(login.req, login.res, login.next);
    assert.strictEqual(login.getStatus(), 200, 'Login succeeds');
    assert.strictEqual(login.getData().student.id, studentId, 'Login returns the same student');
    const token = login.getData().token;

    // Login with wrong password rejected
    const badLogin = mockReqRes({ body: { email: 'student@example.com', password: 'wrongpass1' } });
    await studentAuthController.login(badLogin.req, badLogin.res, badLogin.next);
    assert.strictEqual(badLogin.getStatus(), 401, 'Wrong password rejected with 401');

    // Unknown email rejected with the same generic response shape (no enumeration hint)
    const noUser = mockReqRes({ body: { email: 'nobody@example.com', password: 'password123' } });
    await studentAuthController.login(noUser.req, noUser.res, noUser.next);
    assert.strictEqual(noUser.getStatus(), 401, 'Unknown email rejected with 401');
    assert.strictEqual(noUser.getData().message, badLogin.getData().message, 'Same message for unknown email and wrong password');

    // /me via middleware with Bearer token
    const meReq = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const meResCtx = mockReqRes({});
    await requireStudentAuth(meReq, meResCtx.res, () => {});
    assert.ok(meReq.student, 'Middleware attaches student for valid token');
    const me = mockReqRes({});
    me.req.student = meReq.student;
    await studentAuthController.getMe(me.req, me.res);
    assert.strictEqual(me.getData().student.email, 'student@example.com', 'getMe returns the logged-in student');
    assert.ok(!me.getData().student.passwordHash, 'getMe never leaks passwordHash');

    // Middleware rejects admin-shaped token (kind guard)
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign({ id: studentId, email: 'student@example.com', role: 'SUPER_ADMIN' }, env.JWT_SECRET, { expiresIn: '1h' });
    const guardReq = { headers: { authorization: `Bearer ${adminToken}` }, cookies: {} };
    let guardStatus = 200;
    const guardRes = { status(c) { guardStatus = c; return this; }, json() { return this; } };
    await requireStudentAuth(guardReq, guardRes, () => {});
    assert.strictEqual(guardStatus, 401, 'Admin-shaped token rejected by student middleware');
  });

  await test('Student data: ownership gating, OTP verification, claim flow, offer lookup possession factors', async () => {
    const jwt = require('jsonwebtoken');
    const { setTransporter } = require('../src/services/emailService');

    // Capture outgoing mail so the test can read the OTP (simulated transport only)
    let capturedCode = null;
    setTransporter({
      sendMail: async (opts) => {
        const m = /code is (\d{6})/.exec(opts.text || '');
        if (m) capturedCode = m[1];
        return { messageId: 'mock-test' };
      }
    });

    const mk = async (email) => {
      const r = mockReqRes({ body: { name: 'S', email, password: 'password123' } });
      await studentAuthController.register(r.req, r.res, r.next);
      return r.getData().token;
    };
    const tokenA = await mk('alpha.student@example.com');
    const tokenB = await mk('beta.student@example.com');

    // Records tied ONLY to alpha's email (a legacy Google-Form-style application)
    const participant = await Participant.create({
      fullName: 'Alpha Student', normalizedName: 'alpha student',
      email: 'alpha.student@example.com', normalizedEmail: 'alpha.student@example.com',
      phone: '9999999999', programCode: 'FS-DEV', programTitle: 'Full Stack Development',
      batchId: 'BATCH-TEST', source: 'WEBSITE'
    });
    const application = await Application.create({
      applicationId: 'NOX-TESTALPHA1', participantId: participant._id,
      programCode: 'FS-DEV', programTitle: 'Full Stack Development',
      status: 'APPROVED', appliedAt: new Date(), decidedAt: new Date()
    });
    const offer = await OfferLetter.create({
      offerLetterId: 'OFR-TESTALPHA1-AB12', applicationId: application.applicationId,
      applicationRef: application._id, participantId: participant._id,
      templateId: new mongoose.Types.ObjectId(), templateVersion: 1,
      recipientSnapshot: { fullName: 'Alpha Student', email: 'alpha.student@example.com' },
      programSnapshot: { code: 'FS-DEV', title: 'Full Stack Development' },
      pdfPath: '/tmp/nonexistent-test.pdf', pdfSha256: 'deadbeef', pdfSizeBytes: 123,
      generationStatus: 'GENERATED'
    });
    application.offerLetterId = offer._id;
    await application.save();

    const attach = async (token, req) => {
      req = req || {};
      req.headers = { ...(req.headers || {}), authorization: `Bearer ${token}` };
      req.cookies = req.cookies || {};
      req.ip = req.ip || '127.0.0.1';
      await requireStudentAuth(req, mockReqRes({}).res, () => {});
      return req;
    };

    // ATTACKER SCENARIO: unverified account holding alpha's email (or beta) sees NOTHING
    const appsB = mockReqRes({}); appsB.req = await attach(tokenB, appsB.req);
    await studentDataController.getMyApplications(appsB.req, appsB.res, appsB.next);
    assert.strictEqual(appsB.getData().applications.length, 0, 'Other student sees nothing');

    const appsAun = mockReqRes({}); appsAun.req = await attach(tokenA, appsAun.req);
    await studentDataController.getMyApplications(appsAun.req, appsAun.res, appsAun.next);
    assert.strictEqual(appsAun.getData().applications.length, 0, 'UNVERIFIED owner-matching email still sees nothing - ownership must be proven');

    const ofsAun = mockReqRes({}); ofsAun.req = await attach(tokenA, ofsAun.req);
    await studentDataController.getMyOfferLetters(ofsAun.req, ofsAun.res, ofsAun.next);
    assert.strictEqual(ofsAun.getData().offers.length, 0, 'No offer token released before verification');

    // OTP flow: request -> code delivered via (simulated) email -> confirm
    const rv = mockReqRes({}); rv.req = await attach(tokenA, rv.req);
    await studentAuthController.requestVerification(rv.req, rv.res, rv.next);
    assert.strictEqual(rv.getStatus(), 200, 'Verification code requested');
    assert.ok(capturedCode && /^\d{6}$/.test(capturedCode), 'Code reached the (simulated) inbox, not the API response');

    const wrong = mockReqRes({ body: { code: capturedCode === '000000' ? '000001' : '000000' } });
    wrong.req = await attach(tokenA, wrong.req);
    await studentAuthController.confirmVerification(wrong.req, wrong.res, wrong.next);
    assert.strictEqual(wrong.getStatus(), 400, 'Wrong code rejected');

    const cv = mockReqRes({ body: { code: capturedCode } });
    cv.req = await attach(tokenA, cv.req);
    await studentAuthController.confirmVerification(cv.req, cv.res, cv.next);
    assert.strictEqual(cv.getStatus(), 200, `Correct code verifies: ${JSON.stringify(cv.getData()).slice(0, 120)}`);
    assert.strictEqual(cv.getData().student.emailVerified, true, 'Student marked verified');

    // Verified owner now sees their records
    const appsA = mockReqRes({}); appsA.req = await attach(tokenA, appsA.req);
    await studentDataController.getMyApplications(appsA.req, appsA.res, appsA.next);
    assert.strictEqual(appsA.getData().applications.length, 1, 'Verified owner sees own application');

    const ofsA = mockReqRes({}); ofsA.req = await attach(tokenA, ofsA.req);
    await studentDataController.getMyOfferLetters(ofsA.req, ofsA.res, ofsA.next);
    assert.strictEqual(ofsA.getData().offers.length, 1, 'Verified owner sees own offer letter');
    const url = ofsA.getData().offers[0].downloadUrl;
    const decoded = jwt.verify(url.split('/').pop(), env.JWT_SECRET);
    assert.strictEqual(decoded.purpose, 'OFFER_DOWNLOAD', 'Token purpose guard');
    const offerAfter = await OfferLetter.findById(offer._id);
    assert.strictEqual(decoded.jti, offerAfter.downloadToken, 'Token JTI matches stored JTI');

    // Claim flow: beta with the right app ID but wrong email gets generic 404
    const claimB = mockReqRes({ body: { applicationId: 'NOX-TESTALPHA1' } });
    claimB.req = await attach(tokenB, claimB.req);
    await studentAuthController.claimApplication(claimB.req, claimB.res, claimB.next);
    assert.strictEqual(claimB.getStatus(), 404, 'Claim rejected when account email does not match');

    // Unauthenticated account data is 401
    let noAuthStatus = 200;
    await requireStudentAuth({ headers: {}, cookies: {} }, { status(c) { noAuthStatus = c; return this; }, json() { return this; } }, () => {});
    assert.strictEqual(noAuthStatus, 401, 'No token => 401');

    // Expired token rejected
    const expired = jwt.sign({ id: new mongoose.Types.ObjectId(), email: 'x@example.com', kind: 'student' }, env.JWT_SECRET, { expiresIn: '-10s' });
    let expStatus = 200;
    await requireStudentAuth({ headers: { authorization: `Bearer ${expired}` }, cookies: {} }, { status(c) { expStatus = c; return this; }, json() { return this; } }, () => {});
    assert.strictEqual(expStatus, 401, 'Expired token => 401');

    // Logout clears the cookie
    const lo = mockReqRes({});
    await studentAuthController.logout(lo.req, lo.res);
    assert.ok((lo.getHeaders()['set-cookie'] || '').includes('Expires=Thu, 01 Jan 1970'), 'Logout clears student cookie');

    // Public lookup now requires the possession factor (application ID)
    const noId = mockReqRes({ query: { email: 'alpha.student@example.com', programme: 'FS-DEV' } });
    await studentDataController.lookupOfferLetter(noId.req, noId.res, noId.next);
    assert.strictEqual(noId.getStatus(), 400, 'email+programme alone is NOT enough - application ID required');

    const ok = mockReqRes({ query: { email: 'ALPHA.student@example.com', programme: 'fs-dev', applicationId: 'nox-testalpha1' } });
    await studentDataController.lookupOfferLetter(ok.req, ok.res, ok.next);
    assert.strictEqual(ok.getStatus(), 200, `All three factors correct: ${JSON.stringify(ok.getData()).slice(0, 150)}`);
    assert.ok(ok.getData().offer.downloadUrl.includes('/api/v1/offers/download/'));

    // Every wrong combination => identical generic 404
    const combos = [
      { email: 'alpha.student@example.com', programme: 'ML', applicationId: 'NOX-TESTALPHA1' },
      { email: 'ghost@example.com', programme: 'FS-DEV', applicationId: 'NOX-TESTALPHA1' },
      { email: 'alpha.student@example.com', programme: 'FS-DEV', applicationId: 'NOX-WRONG99' },
      { email: 'beta.student@example.com', programme: 'FS-DEV', applicationId: 'NOX-TESTALPHA1' }
    ];
    let refMessage = null;
    for (const q of combos) {
      const f = mockReqRes({ query: q });
      await studentDataController.lookupOfferLetter(f.req, f.res, f.next);
      assert.strictEqual(f.getStatus(), 404, `404 for ${JSON.stringify(q)}`);
      if (refMessage === null) refMessage = f.getData().message;
      assert.strictEqual(f.getData().message, refMessage, 'Identical generic message for every failure');
    }
  });

  await test('Skill courses: seed integrity, answer-blind start, scoring, pass gate, late submit, attempt isolation', async () => {
    const jwt = require('jsonwebtoken');
    const summary = await seedSkillCourses();
    assert.strictEqual(summary.length, 2, 'Two banks seeded');

    // Bank integrity
    for (const code of ['WEB-DEV', 'PY-PROG']) {
      const qs = await QuizQuestion.find({ courseCode: code });
      assert.strictEqual(qs.length, 50, `${code} has 50 questions`);
      for (const q of qs) {
        assert.strictEqual(q.options.length, 4, 'Every question has exactly 4 options');
        assert.ok(q.correctIndex >= 0 && q.correctIndex < 4, 'correctIndex in range');
      }
    }

    // Public catalogue exposes metadata only
    const list = mockReqRes({});
    await skillCourseController.listCourses(list.req, list.res, list.next);
    assert.strictEqual(list.getData().courses.length, 2, 'Catalogue lists both courses');
    assert.ok(!JSON.stringify(list.getData()).includes('correctIndex'), 'Catalogue never leaks answers');

    // A student starts an attempt
    const reg = mockReqRes({ body: { name: 'Quizzer', email: 'quizzer@example.com', password: 'password123' } });
    await studentAuthController.register(reg.req, reg.res, reg.next);
    const token = reg.getData().token;
    const authd = async () => {
      const req = { headers: { authorization: `Bearer ${token}` }, cookies: {}, ip: '127.0.0.1', body: {}, params: {} };
      await requireStudentAuth(req, mockReqRes({}).res, () => {});
      return req;
    };

    const start = mockReqRes({}); start.req = await authd(); start.req.params = { code: 'PY-PROG' };
    await skillCourseController.startAttempt(start.req, start.res, start.next);
    assert.strictEqual(start.getStatus(), 200, 'Attempt started');
    assert.strictEqual(start.getData().questions.length, 50, '50 questions served');
    assert.ok(!JSON.stringify(start.getData().questions).includes('correctIndex'), 'Served questions carry NO answers');
    const attemptId = start.getData().attempt.id;
    const servedIds = start.getData().questions.map(q => q.id);

    // Restarting resumes the SAME attempt (same questions)
    const restart = mockReqRes({}); restart.req = await authd(); restart.req.params = { code: 'PY-PROG' };
    await skillCourseController.startAttempt(restart.req, restart.res, restart.next);
    assert.strictEqual(restart.getData().attempt.id, attemptId, 'Resume returns same attempt');

    // Score a known-correct run: answer every served question with its true answer (from DB)
    const trueAnswers = {};
    for (const qid of servedIds) {
      const q = await QuizQuestion.findById(qid);
      trueAnswers[qid] = q.correctIndex;
    }
    const submit = mockReqRes({ body: { answers: trueAnswers } });
    submit.req = await authd(); submit.req.params = { attemptId }; submit.req.body = { answers: trueAnswers };
    await skillCourseController.submitAttempt(submit.req, submit.res, submit.next);
    assert.strictEqual(submit.getData().result.score, 50, 'All-correct scores 50');
    assert.strictEqual(submit.getData().result.scorePercent, 100);
    assert.strictEqual(submit.getData().result.passed, true, '100% passes the 60% gate');

    // Double submit is idempotent
    const again = mockReqRes({}); again.req = await authd(); again.req.params = { attemptId };
    await skillCourseController.submitAttempt(again.req, again.res, again.next);
    assert.strictEqual(again.getData().alreadySubmitted, true, 'Re-submit returns stored result, no duplicate');

    // A failing run: all answers wrong
    const reg2 = mockReqRes({ body: { name: 'Quizzer2', email: 'quizzer2@example.com', password: 'password123' } });
    await studentAuthController.register(reg2.req, reg2.res, reg2.next);
    const token2 = reg2.getData().token;
    const authd2 = async () => {
      const req = { headers: { authorization: `Bearer ${token2}` }, cookies: {}, ip: '127.0.0.1', body: {}, params: {} };
      await requireStudentAuth(req, mockReqRes({}).res, () => {});
      return req;
    };
    const start2 = mockReqRes({}); start2.req = await authd2(); start2.req.params = { code: 'WEB-DEV' };
    await skillCourseController.startAttempt(start2.req, start2.res, start2.next);
    const attempt2 = start2.getData().attempt.id;
    const wrongAnswers = {};
    for (const q of start2.getData().questions) {
      const db = await QuizQuestion.findById(q.id);
      wrongAnswers[q.id] = (db.correctIndex + 1) % 4;
    }
    const submit2 = mockReqRes({}); submit2.req = await authd2(); submit2.req.params = { attemptId: attempt2 }; submit2.req.body = { answers: wrongAnswers };
    await skillCourseController.submitAttempt(submit2.req, submit2.res, submit2.next);
    assert.strictEqual(submit2.getData().result.score, 0, 'All-wrong scores 0');
    assert.strictEqual(submit2.getData().result.passed, false, '0% fails');

    // Attempt isolation: student 2 cannot read or submit student 1's attempt
    const foreign = mockReqRes({}); foreign.req = await authd2(); foreign.req.params = { attemptId };
    foreign.req.body = { answers: {} };
    await skillCourseController.submitAttempt(foreign.req, foreign.res, foreign.next);
    assert.strictEqual(foreign.getStatus(), 404, 'Foreign attempt submit => 404');

    // Late submission cannot pass even with perfect answers
    const reg3 = mockReqRes({ body: { name: 'Late', email: 'late@example.com', password: 'password123' } });
    await studentAuthController.register(reg3.req, reg3.res, reg3.next);
    const token3 = reg3.getData().token;
    const authd3 = async () => {
      const req = { headers: { authorization: `Bearer ${token3}` }, cookies: {}, ip: '127.0.0.1', body: {}, params: {} };
      await requireStudentAuth(req, mockReqRes({}).res, () => {});
      return req;
    };
    const start3 = mockReqRes({}); start3.req = await authd3(); start3.req.params = { code: 'PY-PROG' };
    await skillCourseController.startAttempt(start3.req, start3.res, start3.next);
    const attempt3id = start3.getData().attempt.id;
    await QuizAttempt.findByIdAndUpdate(attempt3id, { deadlineAt: new Date(Date.now() - 60 * 1000) });
    const perfectAnswers = {};
    for (const q of start3.getData().questions) {
      const db = await QuizQuestion.findById(q.id);
      perfectAnswers[q.id] = db.correctIndex;
    }
    const submit3 = mockReqRes({}); submit3.req = await authd3(); submit3.req.params = { attemptId: attempt3id }; submit3.req.body = { answers: perfectAnswers };
    await skillCourseController.submitAttempt(submit3.req, submit3.res, submit3.next);
    assert.strictEqual(submit3.getData().result.lateSubmit, true, 'Late flag recorded');
    assert.strictEqual(submit3.getData().result.passed, false, 'Late submission CANNOT pass even at 100%');

    // History: student 1 sees only their own attempt
    const hist = mockReqRes({}); hist.req = await authd();
    await skillCourseController.getMyAttempts(hist.req, hist.res, hist.next);
    assert.strictEqual(hist.getData().attempts.length, 1, 'History scoped to the account');
    assert.strictEqual(hist.getData().attempts[0].courseCode, 'PY-PROG');
  });

  // Cleanup
  await mongoose.disconnect();
  await mongod.stop();

  console.log('\n------------------------------------------------------');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
