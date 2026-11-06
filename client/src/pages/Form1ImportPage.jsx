import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  RefreshCw,
  Download,
  AlertCircle,
  Users,
  Layers,
  HelpCircle
} from 'lucide-react';

/**
 * RFC 4180 and formula-safe CSV generator for client-side download.
 * Columns: fullName, email, programCode, programTitle, applicationId, batchId
 */
export function generateApplicationsCsv(applications) {
  const headers = ['fullName', 'email', 'programCode', 'programTitle', 'applicationId', 'batchId'];

  function sanitizeCell(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);

    // Formula injection safety: prefix with single quote if starts with =, +, -, @, \t, \r
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // RFC 4180 quoting: quote if contains comma, quote, \n, \r
    if (/[",\n\r]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const lines = [
    headers.join(','),
    ...applications.map((app) => headers.map((h) => sanitizeCell(app[h])).join(','))
  ];

  return lines.join('\r\n');
}

export default function Form1ImportPage({ onNavigateToApplications }) {
  // Wizard steps: 'UPLOAD' -> 'COLUMN_MAPPING' -> 'DOMAIN_MAPPING' -> 'PREVIEW' -> 'RESULT'
  const [step, setStep] = useState('UPLOAD');

  // Input states
  const [file, setFile] = useState(null);
  const [batchId, setBatchId] = useState('');
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState([]); // [{ target, header, required }]
  const [distinctDomains, setDistinctDomains] = useState([]);
  const [domainMapping, setDomainMapping] = useState([]); // [{ value, programCode }]
  const [programs, setPrograms] = useState([]);

  // Preview & Commit states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);

  // Target definitions for column mapping
  const TARGET_FIELDS = [
    { key: 'email', label: 'Email Address', required: true, desc: 'Candidate email address' },
    { key: 'fullName', label: 'Full Name', required: true, desc: 'Candidate legal full name' },
    { key: 'domain', label: 'Internship Domain', required: true, desc: 'Chosen technical domain/track' },
    { key: 'phone', label: 'Phone / Contact Number', required: false, desc: 'WhatsApp or mobile number' },
    { key: 'gender', label: 'Gender', required: false, desc: 'Self-reported gender' },
    { key: 'country', label: 'Country', required: false, desc: 'Country of residence' },
    { key: 'college', label: 'College / University', required: false, desc: 'Educational institution' },
    { key: 'qualification', label: 'Qualification / Degree', required: false, desc: 'Degree or branch' },
    { key: 'currentYear', label: 'Current Year of Study', required: false, desc: 'Academic year' },
    { key: 'referralSource', label: 'Referral Source', required: false, desc: 'How they heard about NOXIRA' },
    { key: 'linkedinFollow', label: 'LinkedIn Follow Confirmation', required: false, desc: 'LinkedIn verification check' },
    { key: 'whatsappJoin', label: 'WhatsApp Group Confirmation', required: false, desc: 'WhatsApp group join status' },
    { key: 'timestamp', label: 'Submission Timestamp', required: false, desc: 'Form submission date/time' }
  ];

  // Fetch active programs for domain mapping
  useEffect(() => {
    api.adminGetPrograms().then((res) => {
      if (res && res.programs) {
        setPrograms(res.programs.filter((p) => p.isActive));
      }
    }).catch(() => {});
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setPreviewData(null);
      setCommitResult(null);
    }
  };

  // Step 1 -> Step 2: Upload CSV and detect columns
  const handleProceedToColumnMapping = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to import.');
      return;
    }
    const cleanBatch = batchId.trim().toUpperCase();
    if (!cleanBatch) {
      setError('Batch ID is required. Please type an explicit batch identifier (e.g. BATCH-2026-Q4).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('batchId', cleanBatch);

      const res = await api.previewForm1(formData);
      setHeaders(res.headers || []);

      // Initialize column mapping from suggestions
      const initialColMap = (res.columnSuggestions || []).map((s) => ({
        target: s.target,
        header: s.header || '',
        required: s.required
      }));

      // Ensure all targets are represented
      for (const t of TARGET_FIELDS) {
        if (!initialColMap.some((m) => m.target === t.key)) {
          initialColMap.push({ target: t.key, header: '', required: t.required });
        }
      }

      setColumnMapping(initialColMap);
      setStep('COLUMN_MAPPING');
    } catch (err) {
      setError(err.message || 'Failed to parse CSV file.');
    } finally {
      setLoading(false);
    }
  };

  // Change mapping for a target field
  const handleColumnChange = (targetKey, newHeader) => {
    setColumnMapping((prev) =>
      prev.map((item) => (item.target === targetKey ? { ...item, header: newHeader } : item))
    );
  };

  // Validate column mapping: required targets mapped, no duplicate column assigned
  const getColumnMappingErrors = () => {
    const errors = [];
    const assignedHeaders = new Map();

    for (const item of columnMapping) {
      if (item.required && !item.header) {
        const def = TARGET_FIELDS.find((t) => t.key === item.target);
        errors.push(`Target "${def?.label || item.target}" is required but not mapped.`);
      }
      if (item.header) {
        if (assignedHeaders.has(item.header)) {
          errors.push(`Column "${item.header}" cannot be assigned to both "${assignedHeaders.get(item.header)}" and "${item.target}".`);
        } else {
          assignedHeaders.set(item.header, item.target);
        }
      }
    }
    return errors;
  };

  // Step 2 -> Step 3: Proceed to Domain Mapping
  const handleProceedToDomainMapping = async () => {
    const colErrors = getColumnMappingErrors();
    if (colErrors.length > 0) {
      setError(colErrors[0]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanBatch = batchId.trim().toUpperCase();
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('batchId', cleanBatch);
      formData.append('columnMapping', JSON.stringify(columnMapping.filter((m) => m.header)));

      const res = await api.previewForm1(formData);
      setDistinctDomains(res.distinctDomains || []);

      // Initialize domain mappings
      const initialDomMap = (res.domainSuggestions || []).map((ds) => ({
        value: ds.value,
        programCode: ds.programCode || '__UNMAPPED__'
      }));
      setDomainMapping(initialDomMap);
      setStep('DOMAIN_MAPPING');
    } catch (err) {
      setError(err.message || 'Failed to inspect domain values.');
    } finally {
      setLoading(false);
    }
  };

  // Change programme for a domain value
  const handleDomainChange = (domainValue, newProgramCode) => {
    setDomainMapping((prev) =>
      prev.map((item) => (item.value === domainValue ? { ...item, programCode: newProgramCode } : item))
    );
  };

  // Step 3 -> Step 4: Proceed to Preview
  const handleProceedToPreview = async () => {
    const unmapped = domainMapping.filter((dm) => !dm.programCode || dm.programCode === '__UNMAPPED__');
    if (unmapped.length > 0) {
      setError(`Please map or skip all domain values. Unmapped: "${unmapped.map((u) => u.value).join(', ')}"`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanBatch = batchId.trim().toUpperCase();
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('batchId', cleanBatch);
      formData.append('columnMapping', JSON.stringify(columnMapping.filter((m) => m.header)));
      formData.append('domainMapping', JSON.stringify(domainMapping));

      const res = await api.previewForm1(formData);
      setPreviewData(res);
      setStep('PREVIEW');
    } catch (err) {
      setError(err.message || 'Failed to generate import preview.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4 -> Step 5: Execute Commit
  const handleCommit = async () => {
    if (!previewData || !previewData.fullRows) return;

    setLoading(true);
    setError('');

    try {
      const cleanBatch = batchId.trim().toUpperCase();
      const payload = {
        rows: previewData.fullRows,
        batchId: cleanBatch,
        columnMapping: columnMapping.filter((m) => m.header),
        domainMapping,
        fileName: file.name,
        fileSizeBytes: file.size
      };

      const res = await api.commitForm1(payload);
      setCommitResult(res);
      setStep('RESULT');
    } catch (err) {
      setError(err.message || 'Failed to commit Form 1 import.');
    } finally {
      setLoading(false);
    }
  };

  // Download client-side CSV of created/linked applications
  const handleDownloadCsv = () => {
    if (!commitResult || !commitResult.createdApplications || commitResult.createdApplications.length === 0) {
      return;
    }

    const csvContent = generateApplicationsCsv(commitResult.createdApplications);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `noxira_form1_applications_${batchId.trim().toUpperCase() || 'batch'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset to initial state
  const handleReset = () => {
    setStep('UPLOAD');
    setFile(null);
    setBatchId('');
    setHeaders([]);
    setColumnMapping([]);
    setDistinctDomains([]);
    setDomainMapping([]);
    setPreviewData(null);
    setCommitResult(null);
    setError('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            Google Form 1 Responses Import
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Import candidate intake responses from Google Form 1 CSV export into official NOXIRA applications with auto-generated NOX- IDs.
          </p>
        </div>

        {/* Wizard Step Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className={`px-2 py-0.5 rounded ${step === 'UPLOAD' ? 'bg-amber-100 text-amber-800 font-bold' : ''}`}>1. Upload</span>
          <span>&rarr;</span>
          <span className={`px-2 py-0.5 rounded ${step === 'COLUMN_MAPPING' ? 'bg-amber-100 text-amber-800 font-bold' : ''}`}>2. Columns</span>
          <span>&rarr;</span>
          <span className={`px-2 py-0.5 rounded ${step === 'DOMAIN_MAPPING' ? 'bg-amber-100 text-amber-800 font-bold' : ''}`}>3. Domains</span>
          <span>&rarr;</span>
          <span className={`px-2 py-0.5 rounded ${step === 'PREVIEW' ? 'bg-amber-100 text-amber-800 font-bold' : ''}`}>4. Preview</span>
          <span>&rarr;</span>
          <span className={`px-2 py-0.5 rounded ${step === 'RESULT' ? 'bg-emerald-100 text-emerald-800 font-bold' : ''}`}>5. Done</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Import Warning:</span> {error}
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 font-bold">&times;</button>
        </div>
      )}

      {/* STEP 1: UPLOAD & BATCH ID */}
      {step === 'UPLOAD' && (
        <form onSubmit={handleProceedToColumnMapping} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900">Step 1: Select CSV File &amp; Batch Identifier</h2>
            <p className="text-xs text-slate-500">
              Download the response sheet from your Google Form as a CSV file (File &rarr; Download &rarr; Comma Separated Values).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Intake Batch Identifier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-2026-Q4 or NOX-COHORT-01"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value.toUpperCase())}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono uppercase"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Batch ID is mandatory. Never silently assigned. All imported candidates are registered under this cohort.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                CSV Export File <span className="text-rose-500">*</span>
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Up to 1,000 rows. UTF-8 encoded with standard comma separators.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !file || !batchId.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Parsing CSV Headers...
                </>
              ) : (
                <>
                  Inspect &amp; Map Columns <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 'COLUMN_MAPPING' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900">Step 2: Map CSV Columns to Target Fields</h2>
              <p className="text-xs text-slate-500">
                Confirm which column from your Google Form corresponds to each candidate field. One column cannot feed two targets.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
              Batch: {batchId.trim().toUpperCase()}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {TARGET_FIELDS.map((field) => {
              const currentMap = columnMapping.find((m) => m.target === field.key);
              const selectedHeader = currentMap?.header || '';

              return (
                <div key={field.key} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                  <div className="sm:max-w-md">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-900">{field.label}</span>
                      {field.required ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          Required
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{field.desc}</p>
                  </div>

                  <div className="sm:w-72">
                    <select
                      value={selectedHeader}
                      onChange={(e) => handleColumnChange(field.key, e.target.value)}
                      className={`w-full text-xs p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                        field.required && !selectedHeader
                          ? 'border-rose-300 bg-rose-50/30'
                          : 'border-slate-300'
                      }`}
                    >
                      <option value="">{field.required ? '-- Select CSV Column --' : '-- Not in CSV --'}</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep('UPLOAD')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Upload
            </button>

            <button
              type="button"
              disabled={loading || getColumnMappingErrors().length > 0}
              onClick={handleProceedToDomainMapping}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resolving Domains...
                </>
              ) : (
                <>
                  Configure Programme Domains <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DOMAIN -> PROGRAM MAPPING */}
      {step === 'DOMAIN_MAPPING' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900">Step 3: Map Internship Domains to NOXIRA Programmes</h2>
              <p className="text-xs text-slate-500">
                Map each distinct domain answer from your Google Form to an official NOXIRA programme. Program candidates will be enrolled in the mapped track.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
              Batch: {batchId.trim().toUpperCase()}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {distinctDomains.map((domainVal) => {
              const current = domainMapping.find((m) => m.value === domainVal);
              const selectedCode = current?.programCode || '__UNMAPPED__';
              const matchedProgram = programs.find((p) => p.code === selectedCode);
              const isCurrentOffering = matchedProgram ? (matchedProgram.durationWeeks === 4 && matchedProgram.feeInr === 99) : false;

              return (
                <div key={domainVal} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                  <div>
                    <span className="font-semibold text-xs text-slate-900 block font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                      &ldquo;{domainVal}&rdquo;
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">Form response value</span>
                  </div>

                  <div className="sm:w-80 space-y-1">
                    <select
                      value={selectedCode}
                      onChange={(e) => handleDomainChange(domainVal, e.target.value)}
                      className={`w-full text-xs p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                        selectedCode === '__UNMAPPED__'
                          ? 'border-amber-400 bg-amber-50/40 text-amber-900 font-semibold'
                          : selectedCode === '__SKIP__'
                          ? 'border-slate-300 text-slate-500'
                          : 'border-slate-300'
                      }`}
                    >
                      <option value="__UNMAPPED__">-- Choose Programme (Unmapped) --</option>
                      <option value="__SKIP__">Skip rows with this domain</option>
                      {programs.map((p) => {
                        const isNormalized = p.durationWeeks === 4 && p.feeInr === 99;
                        return (
                          <option key={p.code} value={p.code}>
                            {p.code} - {p.title} {isNormalized ? '(4w / ₹99)' : '(Needs Normalization)'}
                          </option>
                        );
                      })}
                    </select>

                    {selectedCode && selectedCode !== '__UNMAPPED__' && selectedCode !== '__SKIP__' && (
                      <div className="text-[10px]">
                        {isCurrentOffering ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Current offering (4 weeks · ₹99)
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Programme requires normalization in Programme Manager
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep('COLUMN_MAPPING')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Column Mapping
            </button>

            <button
              type="button"
              disabled={loading || domainMapping.some((m) => !m.programCode || m.programCode === '__UNMAPPED__')}
              onClick={handleProceedToPreview}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing Rows...
                </>
              ) : (
                <>
                  Generate Import Preview <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW TABLE */}
      {step === 'PREVIEW' && previewData && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 4: Review Import Preview &amp; Validation States</h2>
              <p className="text-xs text-slate-500">
                Verify per-row classification before committing. Only VALID and LINKABLE rows will receive NOX- applications.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
              Batch: {batchId.trim().toUpperCase()}
            </span>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total</span>
              <span className="text-base font-bold text-slate-900">{previewData.stats.totalRows}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Valid</span>
              <span className="text-base font-bold text-emerald-900">{previewData.stats.validCount}</span>
            </div>
            <div className="bg-cyan-50 border border-cyan-200 p-2.5 rounded-xl">
              <span className="text-cyan-700 block text-[10px] uppercase font-bold">Linkable</span>
              <span className="text-base font-bold text-cyan-900">{previewData.stats.linkableCount}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
              <span className="text-amber-700 block text-[10px] uppercase font-bold">Dup In DB</span>
              <span className="text-base font-bold text-amber-900">{previewData.stats.duplicateInDbCount}</span>
            </div>
            <div className="bg-orange-50 border border-orange-200 p-2.5 rounded-xl">
              <span className="text-orange-700 block text-[10px] uppercase font-bold">Dup In File</span>
              <span className="text-base font-bold text-orange-900">{previewData.stats.duplicateInFileCount}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
              <span className="text-rose-700 block text-[10px] uppercase font-bold">Invalid</span>
              <span className="text-base font-bold text-rose-900">{previewData.stats.invalidCount}</span>
            </div>
            <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
              <span className="text-purple-700 block text-[10px] uppercase font-bold">Unmapped</span>
              <span className="text-base font-bold text-purple-900">{previewData.stats.needsProgramCount}</span>
            </div>
            <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Skipped</span>
              <span className="text-base font-bold text-slate-700">{previewData.stats.skippedCount || 0}</span>
            </div>
          </div>

          {/* Row Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12">#</th>
                    <th className="p-3">Candidate Name</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Form Domain</th>
                    <th className="p-3">Mapped Programme</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Validation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.previewRows.map((row) => {
                    let badge = null;
                    if (row.status === 'VALID') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">VALID</span>;
                    } else if (row.status === 'LINKABLE') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-100 text-cyan-800">LINKABLE</span>;
                    } else if (row.status === 'DUPLICATE_IN_DB') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">DUP IN DB</span>;
                    } else if (row.status === 'DUPLICATE_IN_FILE') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-800">DUP IN FILE</span>;
                    } else if (row.status === 'NEEDS_PROGRAM') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">NEEDS PROGRAM</span>;
                    } else if (row.status === 'NEEDS_NORMALIZATION') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">NEEDS NORM.</span>;
                    } else if (row.status === 'SKIPPED') {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">SKIPPED</span>;
                    } else {
                      badge = <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">INVALID</span>;
                    }

                    return (
                      <tr key={row.rowIndex} className="hover:bg-slate-50/60">
                        <td className="p-3 font-mono text-slate-400">{row.rowIndex}</td>
                        <td className="p-3 font-semibold text-slate-900">{row.fullName || '—'}</td>
                        <td className="p-3 font-mono text-slate-600">{row.email || '—'}</td>
                        <td className="p-3 text-slate-700">{row.domain || '—'}</td>
                        <td className="p-3">
                          {row.programCode ? (
                            <span className="font-semibold text-slate-800 font-mono">
                              {row.programCode}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3">{badge}</td>
                        <td className="p-3 text-[11px] text-slate-500">
                          {row.errors && row.errors.length > 0 ? (
                            <span className="text-rose-600">{row.errors.join(', ')}</span>
                          ) : row.status === 'LINKABLE' ? (
                            <span className="text-cyan-700 font-medium">Links existing participant without Application</span>
                          ) : row.status === 'SKIPPED' ? (
                            <span className="text-slate-500">Skipped by admin domain mapping</span>
                          ) : (
                            <span className="text-emerald-700">Ready to create application</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {previewData.stats.totalRows > 100 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                Displaying first 100 of {previewData.stats.totalRows} rows. All rows will be validated and processed on commit.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep('DOMAIN_MAPPING')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Domain Mapping
            </button>

            <button
              type="button"
              disabled={loading || !previewData.canCommit}
              onClick={handleCommit}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50 shadow-xs"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Committing Applications...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Commit Import ({previewData.stats.validCount + previewData.stats.linkableCount} Applications)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: RESULT SCREEN */}
      {step === 'RESULT' && commitResult && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-emerald-950">Form 1 Import Committed Successfully</h2>
              <p className="text-xs text-emerald-800">
                {commitResult.message}
              </p>
            </div>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Imported</span>
              <span className="text-xl font-bold text-emerald-950">{commitResult.counts.imported}</span>
            </div>
            <div className="bg-cyan-50 border border-cyan-200 p-3 rounded-xl">
              <span className="text-cyan-700 block text-[10px] uppercase font-bold">Linked</span>
              <span className="text-xl font-bold text-cyan-950">{commitResult.counts.linked}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <span className="text-amber-700 block text-[10px] uppercase font-bold">Duplicates Skipped</span>
              <span className="text-xl font-bold text-amber-950">{commitResult.counts.duplicatesSkipped}</span>
            </div>
            <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl">
              <span className="text-slate-600 block text-[10px] uppercase font-bold">Domain Skipped</span>
              <span className="text-xl font-bold text-slate-800">{commitResult.counts.needsProgramSkipped || 0}</span>
            </div>
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
              <span className="text-orange-700 block text-[10px] uppercase font-bold">Needs Normalization</span>
              <span className="text-xl font-bold text-orange-950">{commitResult.counts.needsNormalizationSkipped || 0}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
              <span className="text-rose-700 block text-[10px] uppercase font-bold">Invalid Rejected</span>
              <span className="text-xl font-bold text-rose-950">{commitResult.counts.invalidRejected}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
              <span className="text-rose-700 block text-[10px] uppercase font-bold">Errors</span>
              <span className="text-xl font-bold text-rose-950">{commitResult.counts.errors}</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="font-semibold text-xs text-slate-800 block">Candidate Tracking Roster</span>
              <p className="text-[11px] text-slate-500">
                Download a CSV of all newly created and linked applications with their NOX- IDs to notify candidates manually.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={!commitResult.createdApplications || commitResult.createdApplications.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Download Created Applications (CSV)
              </button>

              <button
                type="button"
                onClick={onNavigateToApplications}
                className="inline-flex items-center gap-1 px-4 py-2 bg-amber-500 text-slate-950 font-semibold rounded-lg text-xs hover:bg-amber-400 transition"
              >
                <Users className="w-3.5 h-3.5" /> View Applications &amp; Selection
              </button>
            </div>
          </div>

          {/* Details Lists (first 50) */}
          <div className="space-y-4 text-xs">
            {commitResult.details?.imported && commitResult.details.imported.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Newly Created Applications ({commitResult.details.imported.length})
                </h3>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {commitResult.details.imported.map((app) => (
                    <div key={app.applicationId} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{app.fullName}</span>
                        <span className="block text-[11px] text-slate-500 font-mono">{app.email}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-800 block">{app.applicationId}</span>
                        <span className="text-[10px] text-slate-400">{app.programCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {commitResult.details?.linked && commitResult.details.linked.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-cyan-800 text-[11px] uppercase tracking-wider">
                  Linked Existing Participants ({commitResult.details.linked.length})
                </h3>
                <div className="max-h-48 overflow-y-auto border border-cyan-200 rounded-xl divide-y divide-cyan-100 bg-cyan-50/30">
                  {commitResult.details.linked.map((app) => (
                    <div key={app.applicationId} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{app.fullName}</span>
                        <span className="block text-[11px] text-slate-500 font-mono">{app.email}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-cyan-900 block">{app.applicationId}</span>
                        <span className="text-[10px] text-slate-400">{app.programCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {commitResult.details?.needsNormalization && commitResult.details.needsNormalization.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-orange-800 text-[11px] uppercase tracking-wider">
                  Needs Programme Normalization ({commitResult.details.needsNormalization.length})
                </h3>
                <p className="text-[11px] text-orange-700">
                  These rows were not imported. Normalize the programme to 4 weeks / Rs.99 in the programme manager, then re-import the file.
                </p>
                <div className="max-h-48 overflow-y-auto border border-orange-200 rounded-xl divide-y divide-orange-100 bg-orange-50/30">
                  {commitResult.details.needsNormalization.map((row) => (
                    <div key={row.rowIndex} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">Row {row.rowIndex}</span>
                        <span className="block text-[11px] text-slate-500 font-mono">{row.email}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-orange-900 block">{row.programCode}</span>
                        <span className="text-[10px] text-slate-400">needs normalization</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-start">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Import Another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
