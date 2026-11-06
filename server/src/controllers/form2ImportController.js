const csv = require('csv-parser');
const { Readable } = require('stream');
const Program = require('../models/Program');
const Application = require('../models/Application');
const Submission = require('../models/Submission');
const { generateSubmissionId } = require('../models/Submission');
const ImportBatch = require('../models/ImportBatch');
const AuditLog = require('../models/AuditLog');

/**
 * Module 6: Google Form 2 (final submission) CSV import bridge.
 *
 * The owner creates Google Form 2 himself (project link + UTR/transaction
 * ID). This bridge only imports the exported responses into Submission
 * records. It never creates forms, never generates payment QRs and never
 * treats the student-provided UTR as proof of payment.
 */

const TARGET_DEFINITIONS = [
  { target: 'email', required: true, regex: /email|mail/i },
  { target: 'programme', required: true, regex: /programme|program|domain|internship|track|course/i },
  { target: 'projectLink', required: true, regex: /project.*(link|url)|link.*project|github|drive.*link|project\s*submission/i, fallbackRegex: /link|url/i },
  { target: 'transactionId', required: true, regex: /utr|transaction|txn|payment.*(id|ref)|reference.*(id|number)/i },
  { target: 'applicationId', required: false, regex: /application.*id|nox[-\s]?id|reg(istration)?.*id/i },
  { target: 'timestamp', required: false, regex: /timestamp|submission.*time|date/i }
];

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    if (!buffer || buffer.length === 0) {
      return reject(new Error('CSV file is empty'));
    }
    const rawRows = [];
    let detectedHeaders = null;
    let headerError = null;

    const stream = Readable.from(buffer);
    const parser = csv({
      trim: true,
      mapHeaders: ({ header, index }) => (index === 0 ? header.replace(/^﻿/, '') : header).trim()
    });

    parser.on('headers', (headers) => {
      detectedHeaders = headers;
      const seen = new Set();
      const duplicates = [];
      for (const h of headers) {
        if (seen.has(h)) duplicates.push(h);
        else seen.add(h);
      }
      if (duplicates.length > 0) {
        headerError = new Error(`CSV file contains duplicate column header(s): ${duplicates.map((d) => `"${d}"`).join(', ')}. Please rename duplicate columns in the sheet and re-export.`);
      }
    });
    parser.on('data', (row) => { if (!headerError) rawRows.push(row); });
    parser.on('end', () => {
      if (headerError) return reject(headerError);
      if (!detectedHeaders || detectedHeaders.length === 0 || rawRows.length === 0) {
        return reject(new Error('CSV file is empty'));
      }
      resolve({ headers: detectedHeaders, rows: rawRows });
    });
    parser.on('error', reject);
    stream.pipe(parser);
  });
}

function suggestColumnMapping(headers) {
  const assignedHeaders = new Set();
  const suggestions = [];
  for (const def of TARGET_DEFINITIONS) {
    let matchedHeader = null;
    for (const h of headers) {
      if (assignedHeaders.has(h)) continue;
      if (def.regex.test(h)) { matchedHeader = h; break; }
    }
    if (!matchedHeader && def.fallbackRegex) {
      for (const h of headers) {
        if (assignedHeaders.has(h)) continue;
        if (def.fallbackRegex.test(h)) { matchedHeader = h; break; }
      }
    }
    suggestions.push({ target: def.target, header: matchedHeader || '', required: def.required });
    if (matchedHeader) assignedHeaders.add(matchedHeader);
  }
  return suggestions;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_RE = /^https?:\/\/\S+$/i;

// Resolve a programme code from a free-text form value (exact code or exact title, case-insensitive)
function resolveProgramCode(rawValue, programs) {
  const val = (rawValue || '').trim();
  if (!val) return { code: '', error: 'Programme is required' };
  const upper = val.toUpperCase();
  const byCode = programs.find((p) => p.code === upper);
  if (byCode) return { code: byCode.code };
  const lower = val.toLowerCase();
  const byTitle = programs.find((p) => (p.title || '').trim().toLowerCase() === lower);
  if (byTitle) return { code: byTitle.code };
  return { code: '', error: `Unknown programme "${val}"` };
}

/**
 * Crosscheck a row against original Application records.
 * Crosschecks: claimed application ID (when provided) + email + programme.
 * Matching by email+programme is an identity CLAIM crosscheck, not proof.
 */
async function crosscheckRow({ email, programCode, claimedApplicationId }) {
  if (claimedApplicationId) {
    const application = await Application.findOne({ applicationId: claimedApplicationId }).populate('participantId');
    if (!application) {
      return { matchState: 'UNMATCHED', application: null, reason: `Application ID ${claimedApplicationId} not found` };
    }
    const appEmail = (application.participantId?.normalizedEmail || application.participantId?.email || '').toLowerCase().trim();
    if (appEmail !== email) {
      return { matchState: 'UNMATCHED', application: null, reason: `Application ID ${claimedApplicationId} belongs to a different email` };
    }
    if (application.programCode !== programCode) {
      return { matchState: 'UNMATCHED', application: null, reason: `Application ID ${claimedApplicationId} is for programme ${application.programCode}, not ${programCode}` };
    }
    return { matchState: 'MATCHED', application, reason: 'Matched by application ID + email + programme' };
  }

  const applications = await Application.find({ programCode }).populate('participantId');
  const emailMatches = applications.filter((a) => {
    const appEmail = (a.participantId?.normalizedEmail || a.participantId?.email || '').toLowerCase().trim();
    return appEmail === email;
  });
  if (emailMatches.length === 0) {
    return { matchState: 'UNMATCHED', application: null, reason: 'No application found for this email + programme combination' };
  }
  // Prefer an approved application, then the most recent
  emailMatches.sort((a, b) => {
    const aScore = (a.status === 'APPROVED' ? 1 : 0);
    const bScore = (b.status === 'APPROVED' ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0);
  });
  return { matchState: 'MATCHED', application: emailMatches[0], reason: 'Matched by email + programme (identity claim, not proof)' };
}

async function evaluateRows(rows, colMap, programs) {
  const headerFor = (target) => {
    const entry = colMap.find((m) => m.target === target);
    return entry && entry.header ? entry.header : null;
  };
  const hEmail = headerFor('email');
  const hProgramme = headerFor('programme');
  const hProject = headerFor('projectLink');
  const hTxn = headerFor('transactionId');
  const hAppId = headerFor('applicationId');
  const hTimestamp = headerFor('timestamp');

  // Same UTR appearing under different emails within this file
  const utrEmails = new Map();
  for (const r of rows) {
    const hTxn = colMap.find((m) => m.target === 'transactionId');
    const hEm = colMap.find((m) => m.target === 'email');
    if (!hTxn || !hTxn.header || !hEm || !hEm.header) break;
    const u = (r[hTxn.header] || '').trim();
    const em = (r[hEm.header] || '').trim().toLowerCase();
    if (!u || !em) continue;
    if (!utrEmails.has(u)) utrEmails.set(u, new Set());
    utrEmails.get(u).add(em);
  }

  const evaluated = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = (r[hEmail] || '').trim().toLowerCase();
    const programmeRaw = (r[hProgramme] || '').trim();
    const projectLink = (r[hProject] || '').trim();
    const transactionId = (r[hTxn] || '').trim();
    const claimedApplicationId = hAppId ? (r[hAppId] || '').trim().toUpperCase() : '';
    const tsRaw = hTimestamp ? (r[hTimestamp] || '').trim() : '';

    const errors = [];
    if (!email || !EMAIL_RE.test(email)) errors.push('Valid email is required');
    const prog = resolveProgramCode(programmeRaw, programs);
    if (prog.error) errors.push(prog.error);
    if (!projectLink || !HTTP_URL_RE.test(projectLink)) errors.push('Project link must be an http(s) URL');
    if (!transactionId) errors.push('Transaction ID (UTR) is required');
    if (claimedApplicationId && !/^NOX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(claimedApplicationId)) {
      errors.push('Application ID must be in NOX-XXXXXX format');
    }
    let formSubmittedAt = null;
    if (tsRaw) {
      const parsed = new Date(tsRaw);
      if (!isNaN(parsed.getTime())) formSubmittedAt = parsed;
    }

    let duplicate = false;
    let revision = false;
    let revisionOf = null;
    let matchState = null;
    let matchReason = null;
    let applicationDoc = null;
    let utrShared = false;

    if (errors.length === 0) {
      const existing = await Submission.findOne({ email, programCode: prog.code, transactionId });
      if (existing) {
        // Module 8: a re-imported response with the SAME email+programme+UTR but a
        // DIFFERENT project link, while a correction window is open, is the
        // student's correction for the open review round - not a duplicate.
        if (existing.reviewStatus === 'CHANGES_REQUESTED' && existing.projectLink !== projectLink) {
          revision = true;
          revisionOf = existing;
        } else {
          duplicate = true;
        }
      } else {
        // A UTR is a payment reference: the same UTR claimed by a DIFFERENT
        // applicant is suspicious. Flag it for manual review - it is still
        // not proof or disproof of any payment.
        const shared = await Submission.findOne({ transactionId, email: { $ne: email } }).select('email');
        if (shared) utrShared = true;
        const inFile = utrEmails.get(transactionId);
        if (inFile && (inFile.size > 1)) utrShared = true;
        const cc = await crosscheckRow({ email, programCode: prog.code, claimedApplicationId });
        matchState = cc.matchState;
        matchReason = cc.reason;
        applicationDoc = cc.application;
      }
    }

    evaluated.push({
      rowIndex: i,
      email,
      programCode: prog.code || programmeRaw,
      claimedApplicationId: claimedApplicationId || undefined,
      projectLink,
      transactionId,
      formSubmittedAt,
      duplicate,
      revision,
      _revisionOf: revisionOf,
      utrShared,
      errors,
      matchState,
      matchReason,
      matchedApplicationId: applicationDoc ? applicationDoc.applicationId : undefined,
      _applicationDoc: applicationDoc,
      _raw: r
    });
  }
  return evaluated;
}

function stripInternal(ev) {
  return ev.map((e) => {
    const { _applicationDoc, _revisionOf, _raw, ...pub } = e;
    return pub;
  });
}

exports.previewForm2 = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }
    const { batchId, columnMapping } = req.body;
    const cleanBatch = typeof batchId === 'string' ? batchId.trim().toUpperCase() : '';
    if (!cleanBatch) {
      return res.status(400).json({ success: false, message: 'Batch ID is required. Please specify a non-empty batch ID.' });
    }

    let parsed;
    try {
      parsed = await parseCsvBuffer(req.file.buffer);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: parseErr.message });
    }
    const { headers, rows: rawRows } = parsed;
    if (rawRows.length > 1000) {
      return res.status(400).json({ success: false, message: 'CSV exceeds limit of 1,000 rows per batch' });
    }

    let parsedColMap = null;
    if (columnMapping) {
      try { parsedColMap = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping; } catch (e) { parsedColMap = null; }
    }
    const suggestions = suggestColumnMapping(headers);
    const effectiveColMap = Array.isArray(parsedColMap) && parsedColMap.length > 0 ? parsedColMap : suggestions;

    const hasRequired = ['email', 'programme', 'projectLink', 'transactionId']
      .every((t) => effectiveColMap.some((m) => m.target === t && m.header));
    if (!hasRequired) {
      return res.json({
        success: true,
        stage: 'MAPPING_REQUIRED',
        headers,
        totalRows: rawRows.length,
        suggestions: effectiveColMap
      });
    }

    const programs = await Program.find({}).select('code title').lean();
    const evaluated = await evaluateRows(rawRows, effectiveColMap, programs);

    const validRows = evaluated.filter((e) => e.errors.length === 0 && !e.duplicate);
    const summary = {
      totalRows: evaluated.length,
      validRows: validRows.length,
      matchedRows: validRows.filter((e) => e.matchState === 'MATCHED').length,
      unmatchedRows: validRows.filter((e) => e.matchState === 'UNMATCHED').length,
      duplicateRows: evaluated.filter((e) => e.duplicate).length,
      errorRows: evaluated.filter((e) => e.errors.length > 0).length
    };

    return res.json({
      success: true,
      stage: 'PREVIEW',
      headers,
      columnMapping: effectiveColMap,
      summary,
      rows: stripInternal(evaluated)
    });
  } catch (error) {
    next(error);
  }
};

exports.commitForm2 = async (req, res, next) => {
  try {
    const { rows, batchId, columnMapping, fileName, fileSizeBytes } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided to commit' });
    }
    if (rows.length > 1000) {
      return res.status(400).json({ success: false, message: 'CSV exceeds limit of 1,000 rows per batch' });
    }
    const cleanBatch = typeof batchId === 'string' ? batchId.trim().toUpperCase() : '';
    if (!cleanBatch) {
      return res.status(400).json({ success: false, message: 'Batch ID is required. Please specify a non-empty batch ID.' });
    }

    let confirmedColMap = columnMapping;
    if (typeof confirmedColMap === 'string') {
      try { confirmedColMap = JSON.parse(confirmedColMap); } catch (e) { confirmedColMap = []; }
    }
    if (!Array.isArray(confirmedColMap)) {
      return res.status(400).json({ success: false, message: 'Invalid column mapping format' });
    }
    const hasRequired = ['email', 'programme', 'projectLink', 'transactionId']
      .every((t) => confirmedColMap.some((m) => m.target === t && m.header));
    if (!hasRequired) {
      return res.status(400).json({
        success: false,
        message: 'Required column mappings (Email, Programme, Project link, Transaction ID) must be mapped'
      });
    }

    // Server-side re-validation: never trust client-evaluated preview results
    const programs = await Program.find({}).select('code title').lean();
    const evaluated = await evaluateRows(rows, confirmedColMap, programs);

    const existingBatch = await ImportBatch.findOne({ batchId: cleanBatch, kind: 'FORM2_RESPONSES', status: 'COMMITTED' });
    if (existingBatch) {
      return res.status(409).json({ success: false, message: `Batch ${cleanBatch} has already been committed.` });
    }

    const importBatch = new ImportBatch({
      fileName: fileName || 'form2-responses.csv',
      fileSizeBytes: fileSizeBytes || 0,
      uploadedBy: req.admin._id,
      kind: 'FORM2_RESPONSES',
      batchId: cleanBatch,
      columnMapping: confirmedColMap,
      status: 'PREVIEW'
    });

    let committed = 0;
    let matched = 0;
    let unmatched = 0;
    let duplicates = 0;
    let errorRows = 0;
    let revisions = 0;

    for (const e of evaluated) {
      if (e.errors.length > 0) { errorRows++; continue; }
      if (e.duplicate) { duplicates++; continue; }
      if (e.revision && e._revisionOf) {
        // Apply the correction to the EXISTING submission: open the next review
        // round with the new link. Optimistic concurrency (__v) rejects a race
        // with a concurrent admin review action.
        const sub = e._revisionOf;
        const now = new Date();
        const prevRoundNo = sub.currentReviewRound;
        const prevRound = sub.reviewRounds[prevRoundNo];
        const late = Boolean(prevRound && prevRound.correctionDueAt && now > prevRound.correctionDueAt);
        // Atomic transition: only while THIS correction window is still open.
        // A concurrent admin outcome or another racing revision makes the
        // filter match nothing and the row becomes an error, never a half-write.
        const upd = await Submission.findOneAndUpdate(
          { _id: sub._id, reviewStatus: 'CHANGES_REQUESTED', currentReviewRound: prevRoundNo },
          {
            $push: { reviewRounds: { round: prevRoundNo + 1, projectLink: e.projectLink, openedAt: now, resubmittedAt: now, resubmittedLate: late } },
            $inc: { currentReviewRound: 1 },
            $set: { reviewStatus: 'IN_REVIEW', projectLink: e.projectLink, ...(e.formSubmittedAt ? { formSubmittedAt: e.formSubmittedAt } : {}) }
          },
          { new: true }
        );
        if (!upd) { errorRows++; continue; }
        revisions++;
        await AuditLog.create({
          actorType: 'ADMIN',
          actorId: req.admin._id,
          action: 'REVIEW_RESUBMISSION',
          targetEntity: 'SUBMISSION',
          targetId: sub._id,
          summary: `Correction received for ${sub.submissionId}: review round ${upd.currentReviewRound} opened${late ? ' (late - after the 3 calendar day window; admin decides any extension)' : ''}`,
          ipAddress: req.ip || '127.0.0.1',
          metadata: {
            submissionId: sub.submissionId,
            round: upd.currentReviewRound,
            resubmittedLate: late
          }
        });
        continue;
      }
      const submission = new Submission({
        submissionId: generateSubmissionId(),
        email: e.email,
        programCode: e.programCode,
        claimedApplicationId: e.claimedApplicationId || undefined,
        applicationId: e._applicationDoc ? e._applicationDoc._id : null,
        matchState: e.matchState,
        utrSharedFlag: e.utrShared || false,
        projectLink: e.projectLink,
        transactionId: e.transactionId,
        formSubmittedAt: e.formSubmittedAt || undefined,
        importBatchId: importBatch._id,
        rawRow: e._raw
      });
      await submission.save();
      committed++;
      if (e.matchState === 'MATCHED') matched++; else unmatched++;
    }

    importBatch.totalRows = evaluated.length;
    importBatch.validRows = committed;
    importBatch.duplicateRows = duplicates;
    importBatch.revisionRows = revisions;
    importBatch.errorRows = errorRows;
    importBatch.status = 'COMMITTED';
    await importBatch.save();

    await AuditLog.create({
      actorType: 'ADMIN',
      actorId: req.admin._id,
      action: 'FORM2_COMMITTED',
      targetEntity: 'SUBMISSION',
      targetId: importBatch._id,
      summary: `Form 2 batch ${cleanBatch}: ${committed} submissions committed (${matched} matched, ${unmatched} unmatched), ${duplicates} duplicates, ${errorRows} errors`,
      ipAddress: req.ip || '127.0.0.1',
      metadata: {
        batchId: cleanBatch,
        totalRows: evaluated.length,
        committed,
        matched,
        unmatched,
        duplicates,
        errorRows
      }
    });

    return res.status(201).json({
      success: true,
      message: `Committed ${committed} submission(s): ${matched} matched to applications, ${unmatched} unmatched (manual review), ${duplicates} duplicate(s) skipped, ${revisions} correction(s) applied to open review rounds, ${errorRows} error row(s) skipped.`,
      summary: { totalRows: evaluated.length, committed, matched, unmatched, duplicates, revisions, errorRows }
    });
  } catch (error) {
    next(error);
  }
};

// Admin listing of imported submissions (review queues live in later modules)
exports.getSubmissions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.matchState === 'MATCHED' || req.query.matchState === 'UNMATCHED') {
      filter.matchState = req.query.matchState;
    }
    const submissions = await Submission.find(filter)
      .populate('applicationId', 'applicationId status programTitle')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 7: Manual payment verification.
 *
 * The admin checks the bank/UPI app OUTSIDE this system, then explicitly
 * marks the outcome here. This endpoint records that human attestation -
 * it never contacts any payment provider and never treats the UTR as proof.
 *
 * Rules:
 * - VERIFIED requires a MATCHED submission (identity crosscheck resolved).
 * - VERIFIED is terminal: no un-verify in this module.
 * - NOT_FOUND (checked, money not arrived) may later become VERIFIED.
 */
exports.markPayment = async (req, res, next) => {
  try {
    const cleanId = (req.params.submissionId || '').trim().toUpperCase();
    const { state, note } = req.body || {};

    if (!['VERIFIED', 'NOT_FOUND'].includes(state)) {
      return res.status(400).json({ success: false, message: 'State must be VERIFIED or NOT_FOUND.' });
    }
    if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
      return res.status(400).json({ success: false, message: 'Note must be text up to 500 characters.' });
    }

    const submission = await Submission.findOne({ submissionId: cleanId });
    if (!submission) {
      return res.status(404).json({ success: false, message: `Submission ${cleanId} not found.` });
    }
    if (submission.paymentState === 'VERIFIED') {
      return res.status(409).json({ success: false, message: `Submission ${cleanId} is already marked VERIFIED.` });
    }
    // One payment (UTR) can never be VERIFIED for two different applicants.
    // The same UTR shared across submissions is already review-flagged at import.
    if (state === 'VERIFIED') {
      const otherVerified = await Submission.findOne({
        transactionId: submission.transactionId,
        _id: { $ne: submission._id },
        paymentState: 'VERIFIED'
      }).select('submissionId email');
      if (otherVerified) {
        return res.status(409).json({
          success: false,
          message: `UTR ${submission.transactionId} is already marked VERIFIED for submission ${otherVerified.submissionId} (${otherVerified.email}). One payment cannot be verified for two applicants; resolve manually.`
        });
      }
    }
    if (state === 'VERIFIED' && submission.matchState !== 'MATCHED') {
      return res.status(400).json({
        success: false,
        message: 'Payment can only be marked VERIFIED on submissions matched to an application. Resolve the identity crosscheck first.'
      });
    }

    submission.paymentState = state;
    submission.paymentMarkedBy = req.admin._id;
    submission.paymentMarkedAt = new Date();
    if (note !== undefined && note.trim()) submission.paymentNote = note.trim();
    try {
      await submission.save();
    } catch (saveErr) {
      // DB-level race guard: a concurrent admin action verified this UTR for
      // another submission between our pre-check and this save. The partial
      // unique index on (transactionId where paymentState=VERIFIED) rejected
      // the write - surface the same 409 as the pre-check path.
      if (saveErr && saveErr.code === 11000) {
        const concurrent = await Submission.findOne({
          transactionId: submission.transactionId,
          _id: { $ne: submission._id },
          paymentState: 'VERIFIED'
        }).select('submissionId email');
        return res.status(409).json({
          success: false,
          message: `UTR ${submission.transactionId} is already marked VERIFIED for submission ${concurrent ? concurrent.submissionId : 'another submission'}${concurrent ? ` (${concurrent.email})` : ''}. One payment cannot be verified for two applicants; resolve manually.`
        });
      }
      throw saveErr;
    }

    await AuditLog.create({
      actorType: 'ADMIN',
      actorId: req.admin._id,
      action: 'PAYMENT_MARKED',
      targetEntity: 'SUBMISSION',
      targetId: submission._id,
      summary: `Manual payment attestation for ${submission.submissionId}: marked ${state} by admin on their own bank/UPI app check (the system performs no payment check itself)`,
      ipAddress: req.ip || '127.0.0.1',
      metadata: {
        submissionId: submission.submissionId,
        state,
        claimedTransactionId: submission.transactionId
      }
    });

    return res.json({
      success: true,
      message: state === 'VERIFIED'
        ? `Payment for ${submission.submissionId} marked VERIFIED (manual bank/UPI check recorded).`
        : `Payment for ${submission.submissionId} marked NOT_FOUND (checked, money not received).`,
      submission: {
        submissionId: submission.submissionId,
        paymentState: submission.paymentState,
        paymentMarkedAt: submission.paymentMarkedAt
      }
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Module 8: review workflow. Policy (from the approved plan, no invented rules):
 * - Initial review + 3 free re-reviews: rounds 0..3.
 * - After every CHANGES_REQUESTED the student gets 3 calendar days
 *   (Asia/Kolkata; due at 23:59:59.999 IST on the 3rd day) to correct.
 * - Pass requires the admin to explicitly confirm BOTH requirements complete
 *   AND project properly working.
 * - Feedback after round 3 exhausts the attempts: FAILED_EXHAUSTED means no
 *   certificate eligibility. Nothing here releases or blocks a certificate by
 *   itself (Module 9 gate) and nothing auto-rejects a late correction.
 */

// 3 calendar days in Asia/Kolkata (fixed +05:30, no DST), end of the 3rd day.
function correctionDeadlineIst(fromDate) {
  const IST_MS = (5 * 60 + 30) * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const istNow = new Date(fromDate.getTime() + IST_MS);
  const istDayStartUtc = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
  const dueIstEndUtc = istDayStartUtc + 4 * DAY_MS - 1; // end of (feedback date + 3 days), IST
  return new Date(dueIstEndUtc - IST_MS);
}

exports.reviewOutcome = async (req, res, next) => {
  try {
    const cleanId = (req.params.submissionId || '').trim().toUpperCase();
    const { action, feedback, requirementsComplete, projectWorking } = req.body || {};

    if (!['CHANGES_REQUESTED', 'PASS'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be CHANGES_REQUESTED or PASS.' });
    }
    if (action === 'CHANGES_REQUESTED' && (typeof feedback !== 'string' || !feedback.trim() || feedback.length > 2000)) {
      return res.status(400).json({ success: false, message: 'Feedback is required (up to 2000 characters) when requesting changes.' });
    }
    if (action === 'PASS' && (requirementsComplete !== true || projectWorking !== true)) {
      return res.status(400).json({
        success: false,
        message: 'Pass requires the admin to explicitly confirm BOTH: requirements complete AND project properly working.'
      });
    }

    const submission = await Submission.findOne({ submissionId: cleanId });
    if (!submission) {
      return res.status(404).json({ success: false, message: `Submission ${cleanId} not found.` });
    }
    if (submission.reviewStatus === 'PASSED' || submission.reviewStatus === 'FAILED_EXHAUSTED') {
      return res.status(409).json({ success: false, message: `Review for ${cleanId} is already ${submission.reviewStatus}; the outcome is terminal.` });
    }
    if (submission.reviewStatus === 'CHANGES_REQUESTED') {
      return res.status(409).json({ success: false, message: `Submission ${cleanId} is awaiting the student's correction; review the resubmitted link when it arrives.` });
    }

    const now = new Date();
    const isFirst = submission.reviewStatus === 'NOT_STARTED';
    const roundNo = submission.currentReviewRound;
    const newStatus = action === 'PASS'
      ? 'PASSED'
      : (roundNo >= 3 ? 'FAILED_EXHAUSTED' : 'CHANGES_REQUESTED');
    const dueAt = (action === 'CHANGES_REQUESTED' && newStatus === 'CHANGES_REQUESTED') ? correctionDeadlineIst(now) : undefined;
    const roundFields = {
      outcome: action === 'PASS' ? 'PASSED' : 'CHANGES_REQUESTED',
      reviewedBy: req.admin._id,
      reviewedAt: now,
      ...(action === 'PASS'
        ? { requirementsComplete: true, projectWorking: true }
        : {
            feedback: feedback.trim(),
            requirementsComplete: requirementsComplete === true,
            projectWorking: projectWorking === true,
            ...(dueAt ? { correctionDueAt: dueAt } : {})
          })
    };

    // Atomic transition guarded by the CURRENT state and round: two concurrent
    // outcomes cannot both apply - the loser's filter matches nothing and it
    // gets a 409, never a double round or a double terminal write.
    let updated;
    if (isFirst) {
      updated = await Submission.findOneAndUpdate(
        { submissionId: cleanId, reviewStatus: 'NOT_STARTED' },
        {
          $push: { reviewRounds: { round: 0, projectLink: submission.projectLink, openedAt: now, ...roundFields } },
          $set: { reviewStatus: newStatus, currentReviewRound: 0 }
        },
        { new: true }
      );
    } else {
      const setPaths = { reviewStatus: newStatus };
      for (const [k, v] of Object.entries(roundFields)) setPaths[`reviewRounds.${roundNo}.${k}`] = v;
      updated = await Submission.findOneAndUpdate(
        { submissionId: cleanId, reviewStatus: 'IN_REVIEW', currentReviewRound: roundNo },
        { $set: setPaths },
        { new: true }
      );
    }
    if (!updated) {
      const current = await Submission.findOne({ submissionId: cleanId }).select('reviewStatus');
      return res.status(409).json({
        success: false,
        message: `Review state changed concurrently (now ${current ? current.reviewStatus : 'unknown'}); refresh and retry.`
      });
    }
    const round = updated.reviewRounds[updated.currentReviewRound];

    await AuditLog.create({
      actorType: 'ADMIN',
      actorId: req.admin._id,
      action: 'REVIEW_OUTCOME',
      targetEntity: 'SUBMISSION',
      targetId: submission._id,
      summary: `Review round ${round.round} for ${updated.submissionId}: ${action}` +
        (action === 'CHANGES_REQUESTED' && updated.reviewStatus === 'CHANGES_REQUESTED'
          ? ` (correction due ${round.correctionDueAt.toISOString()}, 3 calendar days IST)`
          : '') +
        (updated.reviewStatus === 'FAILED_EXHAUSTED' ? ' - attempts exhausted, no certificate eligibility' : ''),
      ipAddress: req.ip || '127.0.0.1',
      metadata: {
        submissionId: updated.submissionId,
        round: round.round,
        action,
        reviewStatus: updated.reviewStatus,
        correctionDueAt: round.correctionDueAt || undefined
      }
    });

    return res.json({
      success: true,
      message: updated.reviewStatus === 'PASSED'
        ? `Review PASSED for ${updated.submissionId} (requirements complete + project properly working, confirmed by admin).`
        : updated.reviewStatus === 'FAILED_EXHAUSTED'
          ? `Feedback recorded for ${updated.submissionId}; all review attempts are exhausted - no certificate eligibility.`
          : `Feedback recorded for ${updated.submissionId}; student has 3 calendar days (until ${round.correctionDueAt.toISOString()}) to correct and resubmit.`,
      review: {
        submissionId: updated.submissionId,
        reviewStatus: updated.reviewStatus,
        currentReviewRound: updated.currentReviewRound,
        rounds: updated.reviewRounds
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.correctionDeadlineIst = correctionDeadlineIst;
