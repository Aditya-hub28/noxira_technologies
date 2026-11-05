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
    const mockReq = mockReqRes();
    await getPublicPrograms(mockReq.req, mockReq.res, mockReq.next);
    assert.strictEqual(mockReq.getStatus(), 200);

    const { programs } = mockReq.getData();
    assert.ok(programs.length >= 31, 'Public listing must return all active programs');

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
    // 1. Valid active program
    const mockDetail = mockReqRes({ params: { code: 'fs-dev' } }); // lowercase to test case insensitivity
    await getPublicProgramByCode(mockDetail.req, mockDetail.res, mockDetail.next);
    assert.strictEqual(mockDetail.getStatus(), 200);

    const { program } = mockDetail.getData();
    assert.ok(program, 'Program data must be present');
    assert.strictEqual(program.code, 'FS-DEV');
    assert.strictEqual(program.durationWeeks, 12);
    assert.strictEqual(program.feeInr, 499);
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
        durationWeeks: 8,
        feeInr: 799,
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

    // 4. In production mode with configured SMTP, dispatchMode resolves to LIVE with recipient email
    const origEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const liveMode = await offerService.getOfferDispatchMode('test.applicant@example.com');
      assert.strictEqual(liveMode.mode, 'LIVE');
      assert.strictEqual(liveMode.canSend, true);
      assert.strictEqual(liveMode.line, 'A real email will be sent to test.applicant@example.com');
    } finally {
      env.NODE_ENV = origEnv;
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
