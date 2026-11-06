import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Link2,
  ShieldAlert
} from 'lucide-react';

/**
 * Module 6: Google Form 2 (final submission) import wizard.
 * The owner creates Google Form 2 himself (project link + payment QR + UTR
 * field). This page only imports the exported responses CSV. Imported UTR
 * values are unverified student claims - payment verification is a manual
 * admin step handled separately.
 */
export default function Form2ImportPage() {
  const [step, setStep] = useState('UPLOAD'); // UPLOAD -> MAPPING -> PREVIEW -> RESULT
  const [file, setFile] = useState(null);
  const [batchId, setBatchId] = useState('');
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState([]);
  const [rawRows, setRawRows] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const TARGET_FIELDS = [
    { key: 'email', label: 'Email Address', required: true },
    { key: 'programme', label: 'Programme', required: true },
    { key: 'projectLink', label: 'Project Link', required: true },
    { key: 'transactionId', label: 'Transaction ID (UTR)', required: true },
    { key: 'applicationId', label: 'Application ID (NOX-)', required: false },
    { key: 'timestamp', label: 'Form Timestamp', required: false }
  ];

  const fetchSubmissions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const data = await api.adminGetSubmissions();
      setSubmissions(data.submissions || []);
    } catch (err) {
      // list failure is non-fatal for the wizard
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const runPreview = async (mappingOverride) => {
    if (!file) { setError('Please select a CSV file.'); return; }
    if (!batchId.trim()) { setError('Batch ID is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('csvFile', file);
      fd.append('batchId', batchId.trim().toUpperCase());
      const mapping = mappingOverride || columnMapping;
      if (mapping && mapping.length > 0) {
        fd.append('columnMapping', JSON.stringify(mapping));
      }
      const data = await api.previewForm2(fd);
      if (data.stage === 'MAPPING_REQUIRED') {
        setHeaders(data.headers || []);
        setColumnMapping(data.suggestions || []);
        setStep('MAPPING');
      } else {
        setPreviewData(data);
        setColumnMapping(data.columnMapping || mapping);
        // Reconstruct raw rows for commit from the file itself
        const text = await file.text();
        const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
        const hdrs = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const cells = line.split(',');
          const obj = {};
          hdrs.forEach((h, i) => { obj[h] = (cells[i] || '').trim(); });
          return obj;
        });
        setRawRows(rows);
        setStep('PREVIEW');
      }
    } catch (err) {
      setError(err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const runCommit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.commitForm2({
        rows: rawRows,
        batchId: batchId.trim().toUpperCase(),
        columnMapping,
        fileName: file.name,
        fileSizeBytes: file.size
      });
      setCommitResult(data);
      setStep('RESULT');
      fetchSubmissions();
    } catch (err) {
      setError(err.message || 'Commit failed');
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setStep('UPLOAD');
    setFile(null);
    setBatchId('');
    setPreviewData(null);
    setCommitResult(null);
    setError('');
  };

  const matchChip = (state) => state === 'MATCHED'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  const paymentChip = (state) => {
    if (state === 'VERIFIED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (state === 'NOT_FOUND') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const [paymentBusy, setPaymentBusy] = useState('');
  // Module 8: review workflow UI state
  const [reviewSub, setReviewSub] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reqComplete, setReqComplete] = useState(false);
  const [projWorking, setProjWorking] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const reviewChip = (st) => {
    if (st === 'PASSED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (st === 'FAILED_EXHAUSTED') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (st === 'CHANGES_REQUESTED') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (st === 'IN_REVIEW') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };
  const reviewLabel = (st) => ({
    NOT_STARTED: 'NOT STARTED', IN_REVIEW: 'IN REVIEW', CHANGES_REQUESTED: 'CHANGES REQUESTED',
    PASSED: 'PASSED', FAILED_EXHAUSTED: 'EXHAUSTED'
  }[st] || st || 'NOT STARTED');
  const fmtIst = (d) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';

  const openReview = (sub) => {
    setReviewSub(sub); setReviewFeedback(''); setReqComplete(false); setProjWorking(false); setReviewError('');
  };
  const handleReviewOutcome = async (action) => {
    const label = action === 'PASS'
      ? `PASS the review for ${reviewSub.submissionId} (confirm requirements complete AND project properly working)`
      : `request changes for ${reviewSub.submissionId} (student gets 3 calendar days to correct)`;
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    setReviewBusy(true); setReviewError('');
    try {
      const res = await api.adminReviewOutcome(reviewSub.submissionId, {
        action,
        feedback: reviewFeedback,
        requirementsComplete: reqComplete,
        projectWorking: projWorking
      });
      await fetchSubmissions();
      setReviewSub(res.review ? { ...reviewSub, reviewStatus: res.review.reviewStatus, currentReviewRound: res.review.currentReviewRound, reviewRounds: res.review.rounds } : null);
    } catch (err) {
      setReviewError(err.message || 'Review action failed');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleMarkPayment = async (s, state) => {
    const label = state === 'VERIFIED' ? `mark payment VERIFIED for ${s.submissionId} (confirm you checked the bank/UPI app)` : `mark payment NOT_FOUND for ${s.submissionId}`;
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    setPaymentBusy(s.submissionId);
    setError('');
    try {
      await api.adminMarkPayment(s.submissionId, { state });
      await fetchSubmissions();
    } catch (err) {
      setError(err.message || 'Payment update failed');
    } finally {
      setPaymentBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-amber-600" /> Form 2 Import - Final Submissions
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Import Google Form 2 responses (project link + transaction ID). The transaction ID is an
          unverified student claim, not proof of payment.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          UTR / transaction IDs imported here are student-provided claims. Payment is confirmed only by
          manually checking the bank/UPI app. Unmatched submissions land in the manual review queue.
        </span>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* STEP: UPLOAD */}
      {step === 'UPLOAD' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">Batch ID *</label>
            <input
              type="text"
              placeholder="e.g. FORM2-2026-N1"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">Select CSV File *</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-950 file:font-bold hover:file:bg-amber-600"
            />
          </div>
          <button
            onClick={() => runPreview()}
            disabled={loading || !file || !batchId.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload &amp; Preview
          </button>
        </div>
      )}

      {/* STEP: MAPPING */}
      {step === 'MAPPING' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Map CSV Columns</h3>
          <p className="text-xs text-slate-500">Match each required field to a column from your Form 2 export.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TARGET_FIELDS.map((t) => {
              const current = columnMapping.find((m) => m.target === t.key);
              return (
                <div key={t.key}>
                  <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
                    {t.label} {t.required ? '*' : '(optional)'}
                  </label>
                  <select
                    value={current ? current.header : ''}
                    onChange={(e) => {
                      setColumnMapping((prev) => {
                        const next = prev.filter((m) => m.target !== t.key);
                        return [...next, { target: t.key, header: e.target.value, required: t.required }];
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  >
                    <option value="">-- Not mapped --</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => runPreview(columnMapping)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Preview Import
          </button>
        </div>
      )}

      {/* STEP: PREVIEW */}
      {step === 'PREVIEW' && previewData && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Review Import Preview</h3>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">{previewData.summary.totalRows} rows</span>
            <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">{previewData.summary.matchedRows} matched</span>
            <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">{previewData.summary.unmatchedRows} unmatched</span>
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-500">{previewData.summary.duplicateRows} duplicates</span>
            <span className="px-2 py-1 rounded bg-rose-50 text-rose-700">{previewData.summary.errorRows} errors</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Programme</th>
                  <th className="px-3 py-2 text-left">Project Link</th>
                  <th className="px-3 py-2 text-left">UTR (unverified)</th>
                  <th className="px-3 py-2 text-left">Crosscheck</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.rows.map((r) => (
                  <tr key={r.rowIndex} className={r.errors.length > 0 ? 'bg-rose-50/40' : r.duplicate ? 'bg-slate-50/60' : ''}>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.email || '-'}</td>
                    <td className="px-3 py-2">{r.programCode}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">
                      {r.projectLink ? (
                        <span className="inline-flex items-center gap-1 text-slate-600"><Link2 className="w-3 h-3" />{r.projectLink}</span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.transactionId || '-'}</td>
                    <td className="px-3 py-2">
                      {r.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-700"><XCircle className="w-3 h-3" />{r.errors.join('; ')}</span>
                      ) : r.duplicate ? (
                        <span className="text-slate-500">Already imported - skipped</span>
                      ) : (
                        <span className="space-x-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${matchChip(r.matchState)}`} title={r.matchReason || ''}>
                            {r.matchState === 'MATCHED' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {r.matchState}{r.matchedApplicationId ? ` (${r.matchedApplicationId})` : ''}
                          </span>
                          {r.utrShared && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold bg-orange-50 text-orange-700 border-orange-200" title="This UTR was also claimed by a different applicant - review flag only, not a payment conclusion">
                              <AlertTriangle className="w-3 h-3" /> Shared UTR
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runCommit}
              disabled={loading || previewData.summary.validRows === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Commit Import ({previewData.summary.validRows})
            </button>
            <button onClick={resetWizard} className="text-xs text-slate-500 hover:text-slate-800 font-semibold">Discard</button>
          </div>
        </div>
      )}

      {/* STEP: RESULT */}
      {step === 'RESULT' && commitResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-3">
          <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Import Committed
          </h3>
          <p className="text-xs text-emerald-900">{commitResult.message}</p>
          <button onClick={resetWizard} className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline">Import another batch</button>
        </div>
      )}

      {/* Submissions list */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Imported Final Submissions</h3>
          <button onClick={fetchSubmissions} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${subsLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {submissions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No final submissions imported yet.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Submission</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Programme</th>
                  <th className="px-3 py-2 text-left">Project Link</th>
                  <th className="px-3 py-2 text-left">UTR (unverified)</th>
                  <th className="px-3 py-2 text-left">Crosscheck</th>
                  <th className="px-3 py-2 text-left">Payment (manual check)</th>
                  <th className="px-3 py-2 text-left">Review (initial + 3 re-reviews)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((s) => (
                  <tr key={s.submissionId}>
                    <td className="px-3 py-2 font-mono font-bold text-amber-700">{s.submissionId}</td>
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2">{s.programCode}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">
                      <a href={s.projectLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> Open
                      </a>
                    </td>
                    <td className="px-3 py-2 font-mono">{s.transactionId}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${matchChip(s.matchState)}`}>
                        {s.matchState === 'MATCHED' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {s.matchState}{s.applicationId && s.applicationId.applicationId ? ` (${s.applicationId.applicationId})` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${paymentChip(s.paymentState)}`}>
                          {s.paymentState || 'UNVERIFIED'}
                        </span>
                        {s.paymentState !== 'VERIFIED' && s.matchState === 'MATCHED' && (
                          <button
                            onClick={() => handleMarkPayment(s, 'VERIFIED')}
                            disabled={paymentBusy === s.submissionId}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline disabled:opacity-50"
                          >
                            Mark verified
                          </button>
                        )}
                        {s.paymentState === 'UNVERIFIED' && (
                          <button
                            onClick={() => handleMarkPayment(s, 'NOT_FOUND')}
                            disabled={paymentBusy === s.submissionId}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline disabled:opacity-50"
                          >
                            Not received
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${reviewChip(s.reviewStatus)}`}>
                          {reviewLabel(s.reviewStatus)}
                        </span>
                        <button
                          onClick={() => openReview(s)}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 underline"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Module 8: review modal */}
      {reviewSub && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setReviewSub(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Review - {reviewSub.submissionId}</h3>
                <p className="text-[11px] text-slate-500">{reviewSub.email} - round {Math.min((reviewSub.currentReviewRound || 0) + 1, 4)} of 4 (initial + 3 free re-reviews)</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${reviewChip(reviewSub.reviewStatus)}`}>
                {reviewLabel(reviewSub.reviewStatus)}
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Pass means you explicitly confirm BOTH: requirements complete AND project properly working.
              After every change request the student has 3 calendar days (IST) to correct and resubmit via Form 2.
            </p>

            {(reviewSub.reviewRounds || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Round history</h4>
                {reviewSub.reviewRounds.map((r) => (
                  <div key={r.round} className="border border-slate-200 rounded-xl p-3 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{r.round === 0 ? 'Initial review' : `Re-review ${r.round}`}</span>
                      {r.outcome && (
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${r.outcome === 'PASSED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {r.outcome}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500">
                      Link: <a href={r.projectLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">open</a>
                      {r.resubmittedAt && <> - resubmitted {fmtIst(r.resubmittedAt)}{r.resubmittedLate && <span className="ml-1 px-1 rounded bg-rose-50 text-rose-700 font-bold">LATE</span>}</>}
                    </div>
                    {r.feedback && <div className="text-slate-700">Feedback: {r.feedback}</div>}
                    {r.reviewedAt && <div className="text-slate-400">Reviewed {fmtIst(r.reviewedAt)}{r.correctionDueAt && <> - correction due {fmtIst(r.correctionDueAt)} IST</>}</div>}
                  </div>
                ))}
              </div>
            )}

            {reviewSub.reviewStatus === 'PASSED' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 font-bold">Review PASSED. Certificate release remains a separate gated step.</div>
            )}
            {reviewSub.reviewStatus === 'FAILED_EXHAUSTED' && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 font-bold">All review attempts exhausted - no certificate eligibility for this submission.</div>
            )}
            {reviewSub.reviewStatus === 'CHANGES_REQUESTED' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
                Awaiting the student's correction. It opens the next round automatically when a new Form 2 response arrives with a different project link.
              </div>
            )}

            {(reviewSub.reviewStatus === 'NOT_STARTED' || reviewSub.reviewStatus === 'IN_REVIEW') && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-[11px] text-slate-700">
                  <input type="checkbox" checked={reqComplete} onChange={(e) => setReqComplete(e.target.checked)} />
                  Requirements complete
                </label>
                <label className="flex items-center gap-2 text-[11px] text-slate-700">
                  <input type="checkbox" checked={projWorking} onChange={(e) => setProjWorking(e.target.checked)} />
                  Project properly working
                </label>
                <textarea
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Feedback for the student (required when requesting changes)"
                  maxLength={2000}
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs h-20"
                />
                {reviewError && <div className="text-[11px] text-rose-700 font-bold">{reviewError}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReviewOutcome('CHANGES_REQUESTED')}
                    disabled={reviewBusy}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    onClick={() => handleReviewOutcome('PASS')}
                    disabled={reviewBusy}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Pass review
                  </button>
                  <button onClick={() => setReviewSub(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-bold">Close</button>
                </div>
              </div>
            )}
            {(reviewSub.reviewStatus === 'PASSED' || reviewSub.reviewStatus === 'FAILED_EXHAUSTED' || reviewSub.reviewStatus === 'CHANGES_REQUESTED') && (
              <div className="flex justify-end">
                <button onClick={() => setReviewSub(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-bold">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
