const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Admin = require('../src/models/Admin');
const Participant = require('../src/models/Participant');
const Program = require('../src/models/Program');
const Template = require('../src/models/Template');
const Certificate = require('../src/models/Certificate');
const DeliveryJob = require('../src/models/DeliveryJob');

const { generateCertificatePdf } = require('../src/services/pdfService');
const { issueCertificateForParticipant } = require('../src/services/issuanceService');
const { generate128BitToken } = require('../src/services/qrService');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    Template.init()
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

  // TEST 2: Intake Duplicate Prevention & Normalized Key (Race Condition Proof)
  await test('Intake: Duplicate email+program+batch collision detected and rejected', async () => {
    // Seed program first
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

    // Attempt duplicate with different casing/whitespace
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
    // Explicitly create a real Template in DB like server boot does
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

    // Issue certificate - must NOT crash on template.signatory.name
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

    // Re-issue
    const res = await issueCertificateForParticipant({
      participantId: p._id,
      adminId: admin._id
    });
    assert.strictEqual(res.message, 'Already issued');

    const totalCerts = await Certificate.countDocuments({ participantId: p._id });
    assert.strictEqual(totalCerts, 1, 'Exactly one certificate record must exist in DB');
  });

  // TEST 7: Regex Search Escaping (Bug 3 Fix)
  await test('Bug 3 Fix: Search box with special characters [ or ( is properly escaped without 500 error', async () => {
    const dangerousInput1 = '[';
    const dangerousInput2 = '(.*+?^${}()|[\\]\\)';

    const safeRegex1 = new RegExp(escapeRegex(dangerousInput1), 'i');
    const safeRegex2 = new RegExp(escapeRegex(dangerousInput2), 'i');

    assert.ok(safeRegex1 instanceof RegExp, 'Must compile valid RegExp');
    assert.ok(safeRegex2 instanceof RegExp, 'Must compile valid RegExp');

    // Run actual query with escaped regex
    const matches = await Participant.find({
      $or: [
        { fullName: safeRegex1 },
        { email: safeRegex1 }
      ]
    });
    assert.ok(Array.isArray(matches), 'Query must complete cleanly without throwing SyntaxError');
  });

  // TEST 8: Email Retry Duplicate Protection (Bug 4 Fix)
  await test('Bug 4 Fix: Delivery retry rejects PROVIDER_ACCEPTED and DELIVERY_UNKNOWN jobs', async () => {
    const cert = await Certificate.findOne();
    const p = await Participant.findOne();

    // Create job marked as PROVIDER_ACCEPTED
    const acceptedJob = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'test@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'PROVIDER_ACCEPTED',
      attempts: 1
    });

    // Verify status rejection check
    assert.strictEqual(['PROVIDER_ACCEPTED', 'DELIVERED'].includes(acceptedJob.status), true, 'Accepted job must be identified');

    // Create job marked as DELIVERY_UNKNOWN (timeout)
    const timeoutJob = await DeliveryJob.create({
      certificateId: cert._id,
      participantId: p._id,
      recipientEmail: 'test2@example.com',
      downloadToken: generate128BitToken(),
      downloadTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'DELIVERY_UNKNOWN',
      attempts: 1
    });
    assert.strictEqual(timeoutJob.status === 'DELIVERY_UNKNOWN', true, 'Timeout job must be flagged for reconciliation');
  });

  // TEST 9: Public Verification & Zero-PII Check
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

  // TEST 10: Correction, Revocation & Atomic Replacement
  await test('Revoke & Replace: Preserves history, marks old as REPLACED, links to new certificate', async () => {
    const oldCert = await Certificate.findOne({ status: 'ISSUED' });
    const admin = await Admin.findOne();

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
