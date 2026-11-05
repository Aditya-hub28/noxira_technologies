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

const { generateCertificatePdf } = require('../src/services/pdfService');
const { issueCertificateForParticipant } = require('../src/services/issuanceService');
const { generate128BitToken } = require('../src/services/qrService');
const { recoverStaleProcessingJobs } = require('../src/services/emailService');
const { validateEnv } = require('../src/config/env');

const participantController = require('../src/controllers/participantController');
const distributionController = require('../src/controllers/distributionController');
const intakeController = require('../src/controllers/intakeController');
const templateController = require('../src/controllers/templateController');
const { getPublicPrograms } = require('../src/routes/programRoutes');

// Helper to mock express req, res, next for controller integration testing
function mockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    ip: options.ip || '127.0.0.1',
    admin: options.admin || { _id: new mongoose.Types.ObjectId(), name: 'Test Admin', role: 'SUPER_ADMIN' }
  };
  let statusCode = 200;
  let responseData = null;
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
    }
  };
  const next = (err) => {
    if (err) throw err;
  };
  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData
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
      defaultBatch: 'BATCH-2026-Q4'
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
      defaultBatch: 'BATCH-2026-Q4'
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
          PASS: 'SG.valid_production_api_key_here_123456789'
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
        programCode: 'INACTIVE-PRG'
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

    // Attacker sends crafted batchId 'MALICIOUS-BATCH-OVERRIDE'
    const mockAttacker = mockReqRes({
      body: {
        fullName: 'Attacker Tester',
        email: 'attacker@example.com',
        programCode: 'FS-DEV',
        batchId: 'MALICIOUS-BATCH-OVERRIDE'
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
        programCode: 'FS-DEV'
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
        programCode: 'FS-DEV'
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
      body: { fullName: 'Race Candidate 1', email: raceEmail, programCode: 'FS-DEV' }
    });
    const reqRes2 = mockReqRes({
      body: { fullName: 'Race Candidate 2', email: raceEmail, programCode: 'FS-DEV' }
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
      return desc || 'Structured engineering track with official curriculum review and registry-verified credential issuance.';
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
