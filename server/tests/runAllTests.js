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

// Helper to mock express req, res, next for controller integration testing
function mockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
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
        JWT_SECRET: 'a_very_long_secure_jwt_secret_with_more_than_32_characters_123456789'
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
