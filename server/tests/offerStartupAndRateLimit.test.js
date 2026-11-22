process.env.NODE_ENV = 'test';
/**
 * Regression tests for the two known offer-letter bugs (PR #14 follow-up):
 *
 * Bug 1 - Startup template restore:
 *   a. A template the admin selected stayed active across restart only if the
 *      approved template row existed; otherwise startup deactivated the admin's
 *      selection and force-activated its own restore. Fixed: the approved
 *      template is restored as an inactive draft whenever another template is
 *      active, and auto-activated only when nothing is active.
 *   b. The on-disk manifest was trusted without verifying its contents. Fixed:
 *      the repo asset (hash-verified) is authoritative; the manifest is used
 *      only when its claimed SHA-256 matches the approved hash AND the bytes on
 *      disk hash to it.
 *
 * Bug 2 - Public offer lookup/preview/download shared the 10-requests/15-min
 *   status limiter, and pdf.js byte-range requests counted against it, so the
 *   third candidate saw 429s rendered as "No offer letter found". Fixed:
 *   dedicated 60/15-min limiters; byte-range fetches of the PDF are not
 *   counted; the client shows a rate-limit message instead of the 404 text.
 *
 * Isolated in-memory database only. Dummy data. No external email.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, autoSeedIfEmpty } = require('../src/index');
const config = require('../src/config/approvedOfferTemplate');
const offerPdfService = require('../src/services/offerPdfService');
const Admin = require('../src/models/Admin');
const Program = require('../src/models/Program');
const Participant = require('../src/models/Participant');
const Application = require('../src/models/Application');
const OfferLetter = require('../src/models/OfferLetter');
const OfferLetterTemplate = require('../src/models/OfferLetterTemplate');

const APPROVED_SHA = config.APPROVED_OFFER_SHA256;
const MANIFEST_PATH = path.resolve(__dirname, '../storage/certificates/offer_templates/approved_template_manifest.json');
const BOGUS_PDF_PATH = path.resolve(__dirname, '../storage/certificates/offer_templates/test_only_stale_template.pdf');

async function clearDb() {
  await Promise.all([
    OfferLetterTemplate.deleteMany({}),
    OfferLetter.deleteMany({}),
    Application.deleteMany({}),
    Participant.deleteMany({}),
    Program.deleteMany({})
  ]);
}

async function ensureAdmin() {
  const existing = await Admin.findOne({ email: 'admin@noxira.com' });
  if (existing) return existing;
  return Admin.create({
    name: 'Test Admin',
    email: 'admin@noxira.com',
    passwordHash: 'not-a-live-login',
    role: 'SUPER_ADMIN',
    isActive: true
  });
}

function cleanupManifestArtifacts() {
  for (const p of [MANIFEST_PATH, BOGUS_PDF_PATH]) {
    try { fs.unlinkSync(p); } catch (_) {}
  }
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      Admin.init(), Program.init(), Participant.init(),
      Application.init(), OfferLetter.init(), OfferLetterTemplate.init()
    ]);
    cleanupManifestArtifacts();

    // ---- Bug 1a: admin-selected active template must survive startup restore ----
    await clearDb();
    await ensureAdmin();
    const custom = await OfferLetterTemplate.create({
      name: 'Admin Chosen Custom Template',
      version: 7,
      isSample: false,
      isActive: true,
      pdfStoragePath: '/tmp/test-only-custom-template.pdf',
      pdfSizeBytes: 1234,
      pdfSha256: 'a'.repeat(64),
      pageCount: 1,
      pageDimensions: [{ pageNumber: 1, width: 595.28, height: 841.89 }],
      fields: offerPdfService.DEFAULT_SAMPLE_FIELDS
    });
    await autoSeedIfEmpty();
    const customAfter = await OfferLetterTemplate.findById(custom._id);
    assert.strictEqual(customAfter.isActive, true, 'Admin-selected template must stay active across startup');
    const restoredDraft = await OfferLetterTemplate.findOne({ pdfSha256: APPROVED_SHA });
    assert(restoredDraft, 'Approved template should be restored when missing');
    assert.strictEqual(restoredDraft.isActive, false, 'Restored approved template must not displace the active selection');
    assert.notStrictEqual(restoredDraft.version, 7, 'Restored template must not reuse an existing version number');
    console.log('PASS 1a: startup restore keeps the admin-selected active template; approved template returns as inactive draft');

    // ---- Bug 1a (fresh DB): nothing active -> approved template restores activated ----
    await clearDb();
    await autoSeedIfEmpty();
    const freshRestored = await OfferLetterTemplate.findOne({ pdfSha256: APPROVED_SHA });
    assert(freshRestored, 'Approved template should restore on a fresh database');
    assert.strictEqual(freshRestored.isActive, true, 'With nothing else active, the restored approved template activates');
    const activeCount = await OfferLetterTemplate.countDocuments({ isActive: true });
    assert.strictEqual(activeCount, 1, 'Exactly one template may be active');
    console.log('PASS 1b: fresh database restores and activates the approved template exactly once');

    // ---- Bug 1b: stale/tampered manifest is never trusted ----
    await clearDb();
    await ensureAdmin();
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    // Stale manifest: claims a different (old) hash and points at different bytes.
    fs.writeFileSync(BOGUS_PDF_PATH, '%PDF-1.4\n% stale test-only stand-in, not the approved asset\n');
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
      name: 'STALE TEST-ONLY MANIFEST',
      version: 99,
      pdfSha256: 'b'.repeat(64),
      pdfStoragePath: BOGUS_PDF_PATH,
      pageCount: 1,
      fields: []
    }, null, 2));
    await autoSeedIfEmpty();
    const afterStale = await OfferLetterTemplate.findOne({ isActive: true });
    assert(afterStale, 'An active template should exist after restore');
    assert.strictEqual(afterStale.pdfSha256, APPROVED_SHA, 'Stale manifest must not resurrect an old template');
    assert.notStrictEqual(afterStale.pdfStoragePath, BOGUS_PDF_PATH, 'Stale manifest path must not be used');
    assert.strictEqual(afterStale.name, config.APPROVED_OFFER_NAME);

    // Manifest that claims the right hash but whose file bytes do not match.
    await clearDb();
    await ensureAdmin();
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
      name: 'TAMPERED TEST-ONLY MANIFEST',
      version: 100,
      pdfSha256: APPROVED_SHA,
      pdfStoragePath: BOGUS_PDF_PATH,
      pageCount: 1,
      fields: []
    }, null, 2));
    await autoSeedIfEmpty();
    const afterTamper = await OfferLetterTemplate.findOne({ isActive: true });
    assert(afterTamper, 'An active template should exist after restore');
    assert.strictEqual(afterTamper.pdfSha256, APPROVED_SHA);
    assert.notStrictEqual(afterTamper.pdfStoragePath, BOGUS_PDF_PATH, 'Byte-verification must reject a manifest whose file was swapped');
    console.log('PASS 1c: stale and byte-swapped manifests are rejected; only hash-verified bytes are restored');
    cleanupManifestArtifacts();

    // ---- Bug 2: public offer lookup/preview/download under repeated use ----
    await clearDb();
    await ensureAdmin();
    await Program.create({
      code: 'FS-DEV',
      title: 'Full Stack Web Development',
      durationWeeks: 4,
      startDate: new Date('2026-12-10T12:00:00+05:30'),
      isActive: true
    });
    await autoSeedIfEmpty(); // seeds demo application NOX-2026-FSD-1001 and generates its offer
    const demoApp = await Application.findOne({ applicationId: 'NOX-2026-FSD-1001' });
    assert(demoApp, 'Demo application should be seeded');
    const demoOffer = await OfferLetter.findOne({ applicationRef: demoApp._id, generationStatus: 'GENERATED' });
    assert(demoOffer, 'Demo offer letter should be generated');
    const activeTemplate = await OfferLetterTemplate.findOne({ isActive: true });
    assert.strictEqual(activeTemplate.pdfSha256, APPROVED_SHA, 'Demo offer should use the restored approved template');

    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/intake`;
    const qs = `email=${encodeURIComponent('aarav.sharma@example.com')}&id=NOX-2026-FSD-1001`;
    const get = (suffix, headers) => fetch(base + suffix, { headers });

    // Twelve full candidate flows: lookup + full PDF fetch + a byte-range fetch.
    // Under the old shared 10-requests/15-min limiter this failed partway through
    // the third candidate; every request here must now succeed.
    for (let i = 0; i < 12; i += 1) {
      const lookup = await get(`/offer-letter?${qs}`);
      assert.strictEqual(lookup.status, 200, `lookup #${i + 1} should succeed`);
      const full = await get(`/offer-letter/pdf?${qs}`);
      assert.strictEqual(full.status, 200, `full PDF fetch #${i + 1} should succeed`);
      await full.arrayBuffer();
      const ranged = await get(`/offer-letter/pdf?${qs}`, { range: 'bytes=0-1023' });
      assert.strictEqual(ranged.status, 206, `range fetch #${i + 1} should be a partial response`);
      await ranged.arrayBuffer();
    }
    console.log('PASS 2a: 12 full lookup/preview/download flows succeed (old limiter failed during the third)');

    // Byte-range fetches (how pdf.js streams a preview) must not consume budget.
    for (let i = 0; i < 50; i += 1) {
      const ranged = await get(`/offer-letter/pdf?${qs}`, { range: `bytes=${1024 * (i + 1)}-${1024 * (i + 2) - 1}` });
      assert.strictEqual(ranged.status, 206, `range fetch ${i + 1} should not be rate limited`);
      await ranged.arrayBuffer();
    }
    const stillOk = await get(`/offer-letter?${qs}`);
    assert.strictEqual(stillOk.status, 200, 'range-heavy previewing must not consume the lookup budget');
    console.log('PASS 2b: 50 byte-range fetches are not counted against the budget');

    // The limiter still bites on genuinely excessive non-range traffic.
    let saw429 = false;
    let okCount = 0;
    for (let i = 0; i < 80; i += 1) {
      const res = await get(`/offer-letter?${qs}`);
      if (res.status === 429) {
        saw429 = true;
        const body = await res.json();
        assert.match(body.message, /Too many offer letter requests/, '429 must carry the offer-letter message');
        break;
      }
      assert.strictEqual(res.status, 200);
      okCount += 1;
    }
    assert(saw429, 'lookup limiter must still engage under excessive traffic');
    assert(okCount >= 40, `limiter should allow a realistic number of lookups first (got ${okCount})`);
    console.log(`PASS 2c: limiter still engages after ${okCount} further lookups (60/15min budget)`);

    console.log('ALL OFFER STARTUP + RATE LIMIT CHECKS PASSED. Isolated database only. Dummy data. No external emails.');
  } finally {
    cleanupManifestArtifacts();
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
