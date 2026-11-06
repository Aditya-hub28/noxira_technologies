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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
