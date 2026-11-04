import React, { useState } from 'react';
import { api } from '../services/api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Check } from 'lucide-react';

export default function CsvImportPage({ onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [programCode, setProgramCode] = useState('FS-DEV');
  const [batchId, setBatchId] = useState('BATCH-2026-Q4');
  
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setError('');
    }
  };

  const handlePreviewUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setPreviewLoading(true);
    setError('');
    setCommitSuccess(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('programCode', programCode);
      formData.append('batchId', batchId);

      const res = await api.previewCsv(formData);
      setPreviewData(res);
    } catch (err) {
      setError(err.message || 'Failed to parse and preview CSV');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || !previewData.fullRows) return;

    setCommitLoading(true);
    setError('');

    try {
      const res = await api.commitCsv({
        rows: previewData.fullRows,
        programCode,
        batchId,
        fileName: file.name
      });
      setCommitSuccess(res);
      setPreviewData(null);
      setFile(null);
    } catch (err) {
      setError(err.message || 'Failed to commit CSV rows');
    } finally {
      setCommitLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Google Form CSV Import Wizard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Map responses from Google Form exports, isolate row-level errors, and detect duplicates before approving intake.
        </p>
      </div>

      {commitSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-emerald-900 text-sm">CSV Import Committed Successfully</h3>
            <p className="text-xs text-emerald-800 mt-1">{commitSuccess.message}</p>
            <button
              onClick={onImportSuccess}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
            >
              View Participants in Review Pool <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handlePreviewUpload} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Target Program *
              </label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="FS-DEV">Full Stack Web Development (FS-DEV)</option>
                <option value="AI-ENG">Applied AI & LLM Engineering (AI-ENG)</option>
                <option value="CYBER-SEC">Cybersecurity Defense (CYBER-SEC)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Target Batch ID *
              </label>
              <input
                type="text"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-2xl p-8 text-center transition cursor-pointer relative bg-slate-50/50">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {file ? file.name : 'Select or drag Google Form CSV export here'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Maximum 5 MB or 1,000 rows per batch</p>
          </div>

          <button
            type="submit"
            disabled={previewLoading || !file}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {previewLoading ? 'Parsing & Scanning Duplicates...' : 'Preview & Validate CSV'}
          </button>
        </form>
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Validation & Conflict Report</h3>
              <p className="text-xs text-slate-500">
                Mapped headers: Name: <span className="font-mono text-slate-800">{previewData.detectedHeaders.nameHeader}</span>, Email: <span className="font-mono text-slate-800">{previewData.detectedHeaders.emailHeader}</span>
              </p>
            </div>
            <button
              onClick={handleCommit}
              disabled={commitLoading || previewData.stats.validCount === 0}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {commitLoading ? 'Committing...' : `Approve & Commit ${previewData.stats.validCount} Valid Records`}
            </button>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-lg font-black text-slate-800">{previewData.stats.totalRows}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Total Rows</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-lg font-black text-emerald-700">{previewData.stats.validCount}</div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase">Valid Ready</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-lg font-black text-amber-700">{previewData.stats.duplicateCount}</div>
              <div className="text-[10px] font-bold text-amber-600 uppercase">Duplicate Conflicts</div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <div className="text-lg font-black text-rose-700">{previewData.stats.errorCount}</div>
              <div className="text-[10px] font-bold text-rose-600 uppercase">Invalid Rows</div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Row #</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.previewRows.map((r, i) => (
                  <tr key={i} className={r.isDuplicate ? 'bg-amber-50/50' : r.errors.length ? 'bg-rose-50/50' : ''}>
                    <td className="py-2 px-3 font-mono text-slate-400">{r.rowIndex}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{r.fullName || '—'}</td>
                    <td className="py-2 px-3 text-slate-600">{r.email || '—'}</td>
                    <td className="py-2 px-3">
                      {r.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Duplicate Conflict (Will Skip)
                        </span>
                      ) : r.errors.length ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                          <XCircle className="w-3.5 h-3.5" /> {r.errors.join(', ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Intake
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
