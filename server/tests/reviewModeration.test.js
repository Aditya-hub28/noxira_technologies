process.env.NODE_ENV = 'test';
const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const env = require('../src/config/env');
const { app } = require('../src/index');
const Admin = require('../src/models/Admin');
const Review = require('../src/models/Review');
const AuditLog = require('../src/models/AuditLog');

/**
 * Student-review moderation acceptance test.
 * Fully isolated: in-memory MongoDB, throwaway HTTP server, synthetic admin.
 * Covers the pending -> admin approval -> public display flow, rejection,
 * validation, honeypot drop, access control, and audit logging.
 */
(async () => {
  const mongod = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongod.getUri());
    await Promise.all([Admin.init(), Review.init(), AuditLog.init()]);
    const admin = await Admin.create({
      name: 'Review Test Admin',
      email: 'review-admin@example.invalid',
      passwordHash: 'not-a-live-login',
      role: 'SUPER_ADMIN',
      isActive: true
    });
    const token = jwt.sign({ id: admin.id }, env.JWT_SECRET);
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const authed = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const publicRequest = async (path, options = {}) => {
      const res = await fetch(base + path, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
      return { status: res.status, data: await res.json() };
    };
    const adminRequest = async (path, options = {}) => {
      const res = await fetch(base + path, { ...options, headers: { ...authed, ...options.headers } });
      return { status: res.status, data: await res.json() };
    };

    const validA = { name: 'Aarav Sharma', role: 'Full Stack Development Intern', text: 'The mentor sessions were practical and the projects helped me build a real portfolio.', rating: 5 };
    const validB = { name: 'Priya Verma', role: 'Data Science Intern', text: 'Great structure and supportive reviews on every weekly task submission.', rating: 4 };

    // 1. Valid submissions land as PENDING.
    const postA = await publicRequest('/reviews', { method: 'POST', body: JSON.stringify(validA) });
    assert.strictEqual(postA.status, 201);
    assert.ok(postA.data.reviewId, 'reviewId returned');
    const postB = await publicRequest('/reviews', { method: 'POST', body: JSON.stringify(validB) });
    assert.strictEqual(postB.status, 201);

    // 2. Honeypot-filled submissions get a fake success and are never stored.
    const honeypotPost = await publicRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({ ...validA, name: 'Bot McBotface', website: 'http://spam.example' })
    });
    assert.strictEqual(honeypotPost.status, 201);
    assert.strictEqual(await Review.countDocuments({ name: 'Bot McBotface' }), 0, 'honeypot submission must not be stored');
    console.log('PASS: valid submissions accepted; honeypot dropped silently');

    // 3. Validation failures.
    const shortName = await publicRequest('/reviews', { method: 'POST', body: JSON.stringify({ ...validA, name: 'A' }) });
    assert.strictEqual(shortName.status, 400);
    const badRating = await publicRequest('/reviews', { method: 'POST', body: JSON.stringify({ ...validA, rating: 7 }) });
    assert.strictEqual(badRating.status, 400);
    console.log('PASS: short name and out-of-range rating rejected with 400');

    // 4. Submission rate limiter kicks in (limit is 5 per 15 min; this is request 6).
    const limited = await publicRequest('/reviews', { method: 'POST', body: JSON.stringify(validA) });
    assert.strictEqual(limited.status, 429, '6th submission within window must be rate limited');
    console.log('PASS: submission rate limiter returns 429 past the limit');

    // 5. Nothing is public before approval.
    let publicList = await publicRequest('/reviews');
    assert.strictEqual(publicList.status, 200);
    assert.strictEqual(publicList.data.count, 0, 'PENDING reviews must never be public');
    console.log('PASS: pending reviews invisible on the public list');

    // 6. Admin routes reject unauthenticated callers.
    const noAuth = await publicRequest('/admin/reviews');
    assert.strictEqual(noAuth.status, 401);
    const noAuthApprove = await publicRequest(`/admin/reviews/${postA.data.reviewId}/approve`, { method: 'PATCH' });
    assert.strictEqual(noAuthApprove.status, 401);
    console.log('PASS: admin review routes require authentication');

    // 7. Admin sees both pending reviews with counts.
    const pendingList = await adminRequest('/admin/reviews?status=PENDING');
    assert.strictEqual(pendingList.status, 200);
    assert.strictEqual(pendingList.data.count, 2);
    assert.strictEqual(pendingList.data.counts.PENDING, 2);
    console.log('PASS: admin pending queue lists submissions with counts');

    // 8. Approve review A -> appears publicly with public fields only.
    const approve = await adminRequest(`/admin/reviews/${postA.data.reviewId}/approve`, { method: 'PATCH' });
    assert.strictEqual(approve.status, 200);
    assert.strictEqual(approve.data.review.status, 'APPROVED');
    publicList = await publicRequest('/reviews');
    assert.strictEqual(publicList.data.count, 1);
    const publicReview = publicList.data.reviews[0];
    assert.strictEqual(publicReview.name, validA.name);
    assert.deepStrictEqual(
      Object.keys(publicReview).sort(),
      ['_id', 'createdAt', 'name', 'rating', 'role', 'text'].sort(),
      'public list must expose public fields only'
    );
    assert.strictEqual(publicReview.status, undefined, 'moderation status must not leak');
    console.log('PASS: approved review becomes public with public fields only');

    // 9. Reject review B -> stays private; appears in REJECTED queue.
    const reject = await adminRequest(`/admin/reviews/${postB.data.reviewId}/reject`, { method: 'PATCH' });
    assert.strictEqual(reject.status, 200);
    publicList = await publicRequest('/reviews');
    assert.strictEqual(publicList.data.count, 1, 'rejected review must never be public');
    const rejectedList = await adminRequest('/admin/reviews?status=REJECTED');
    assert.strictEqual(rejectedList.data.count, 1);
    assert.strictEqual(rejectedList.data.reviews[0].name, validB.name);
    console.log('PASS: rejected review hidden from public, listed in rejected queue');

    // 10. Audit trail recorded moderation decisions.
    const auditActions = (await AuditLog.find({ targetEntity: 'REVIEW' }).lean()).map((l) => l.action).sort();
    assert.deepStrictEqual(auditActions, ['REVIEW_APPROVED', 'REVIEW_REJECTED']);
    console.log('PASS: approve/reject decisions written to audit log');

    // 11. Admin delete removes permanently.
    const del = await adminRequest(`/admin/reviews/${postA.data.reviewId}`, { method: 'DELETE' });
    assert.strictEqual(del.status, 200);
    publicList = await publicRequest('/reviews');
    assert.strictEqual(publicList.data.count, 0);
    const missingApprove = await adminRequest(`/admin/reviews/${postA.data.reviewId}/approve`, { method: 'PATCH' });
    assert.strictEqual(missingApprove.status, 404);
    console.log('PASS: admin delete removes review; moderation on missing review 404s');

    console.log('ALL REVIEW MODERATION CHECKS PASSED. Isolated database only.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
