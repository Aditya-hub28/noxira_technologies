import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle2, AlertCircle, Award, Send, ArrowRight, RotateCcw, AlertTriangle, Copy, Check } from 'lucide-react';

export default function ApplyPage() {
  const [searchParams] = useSearchParams();

  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programLoadError, setProgramLoadError] = useState(false);

  // Accessible visible warnings for invalid/unknown query parameter or disappearing program
  const [queryWarning, setQueryWarning] = useState('');
  const [programDisappearedNotice, setProgramDisappearedNotice] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    programCode: ''
  });
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Track latest request sequence to prevent stale query race conditions
  const activeRequestIdRef = useRef(0);

  const fetchAndResolvePrograms = async () => {
    const currentRequestId = ++activeRequestIdRef.current;
    setLoadingPrograms(true);
    setProgramLoadError(false);

    try {
      const data = await api.getPrograms();
      if (currentRequestId !== activeRequestIdRef.current) return;

      const fetched = data.programs || [];
      setPrograms(fetched);

      // Check URL query param presence explicitly
      const hasProgramParam = searchParams.has('program');
      const rawQuery = hasProgramParam ? searchParams.get('program') : null;

      if (hasProgramParam) {
        if (!rawQuery || !rawQuery.trim()) {
          // Supplied empty or whitespace-only ?program=
          setQueryWarning('A program parameter was supplied in the link, but no program code was specified. Please select an active program below.');
          setFormData(prev => ({ ...prev, programCode: '' }));
        } else {
          const queryCode = rawQuery.trim().toUpperCase();
          const matched = fetched.find(p => p.code === queryCode);

          if (matched) {
            // Valid active program: preselect exactly that program and clear warning
            setQueryWarning('');
            setFormData(prev => ({ ...prev, programCode: matched.code }));
          } else {
            // Unknown, inactive, or malformed code: DO NOT silently substitute
            setQueryWarning(`The requested program code "${queryCode}" is not available or inactive. Please choose an active program from the list below.`);
            setFormData(prev => ({ ...prev, programCode: '' }));
          }
        }
      } else {
        // No program parameter supplied: preserve deliberate valid choice if still active, otherwise empty
        setQueryWarning('');
        setFormData(prev => {
          if (prev.programCode) {
            const stillActive = fetched.some(p => p.code === prev.programCode);
            if (!stillActive) {
              setProgramDisappearedNotice('Your previously selected program is no longer available. Please select another program.');
              return { ...prev, programCode: '' };
            }
            return prev;
          }
          return { ...prev, programCode: '' };
        });
      }
    } catch (err) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      console.warn('Failed to load active programs:', err);
      setProgramLoadError(true);
      // Ensure stale submission cannot proceed on fetch failure
      setFormData(prev => ({ ...prev, programCode: '' }));
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setLoadingPrograms(false);
      }
    }
  };

  useEffect(() => {
    fetchAndResolvePrograms();
  }, [searchParams]);

  // Recovery: user deliberately selects an active program from dropdown
  const handleProgramChange = (e) => {
    const selectedCode = e.target.value;
    setFormData(prev => ({ ...prev, programCode: selectedCode }));
    if (selectedCode) {
      // Clear URL warning and disappearance notice on explicit valid selection
      setQueryWarning('');
      setProgramDisappearedNotice('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // Validate active program membership before submission
    if (!formData.programCode || !programs.some(p => p.code === formData.programCode)) {
      setError('Please select an active certification program from the official list.');
      return;
    }

    // Validate fee disclosure acknowledgment
    if (!feeAcknowledged) {
      setError('You must acknowledge the fee disclosure and application rules before submitting.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        programCode: formData.programCode,
        feeAcknowledged: true
      };

      const res = await api.submitApplication(payload);
      setResult(res);
      // Reset form on success, keeping programCode unselected
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        programCode: ''
      });
      setFeeAcknowledged(false);
      setQueryWarning('');
      setProgramDisappearedNotice('');
    } catch (err) {
      if (err.data?.code === 'FEE_NOT_SET' || (err.message && err.message.includes('FEE_NOT_SET'))) {
        setError('Applications for this programme are not open yet. NOXIRA has not published its Task Submission & Review Fee.');
      } else {
        setError(err.message || 'Failed to submit application');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedProgram = programs.find(p => p.code === formData.programCode);
  const isFeeSet = selectedProgram && selectedProgram.feeInr !== undefined && selectedProgram.feeInr !== null;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-amber-50 rounded-2xl mb-3 border border-amber-200">
          <Award className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          NOXIRA Certification Intake
        </h1>
        <p className="mt-2 text-slate-600 text-sm max-w-lg mx-auto">
          Submit your official candidate details. Registrations enter the reviewed participant pool.
          <span className="block font-medium text-amber-700 mt-1">
            ⚠️ Notice: Registration alone never automatically grants or issues a certificate.
          </span>
        </p>
      </div>

      {result && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-start gap-4 shadow-xs">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-3 flex-1">
            <div>
              <h3 className="text-base font-bold text-emerald-950">Application Received</h3>
              <p className="text-emerald-900 text-xs sm:text-sm mt-0.5">{result.message}</p>
            </div>

            {result.application?.applicationId && (
              <div className="bg-white border border-emerald-300/80 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                      Official Application ID
                    </div>
                    <div className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider mt-0.5">
                      {result.application.applicationId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(result.application.applicationId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy ID
                        </>
                      )}
                    </button>
                    <Link
                      to={`/status?email=${encodeURIComponent(result.participant?.email || formData.email || '')}&id=${encodeURIComponent(result.application.applicationId)}`}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs"
                    >
                      Check Status <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    </Link>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Please save this Application ID. You will need it together with your registered email to track review progress on the public status page.
                </p>
              </div>
            )}

            <p className="text-xs text-emerald-800 leading-relaxed">
              ⚠️ Notice: Registration alone never automatically grants or issues a certificate. Candidate eligibility and task evaluation must be recorded by administration before any credential issuance.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-rose-800 text-sm">{error}</p>
        </div>
      )}

      {/* Visible Query Parameter Warning Banner */}
      {queryWarning && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-semibold block mb-0.5">Program Selection Notice</span>
            {queryWarning}
          </div>
        </div>
      )}

      {/* Selected Program Disappeared Banner */}
      {programDisappearedNotice && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-semibold block mb-0.5">Program Updated</span>
            {programDisappearedNotice}
          </div>
        </div>
      )}

      {/* Intake Form */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Legal Name (as required on Certificate) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Aditya Narayan Jha"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Official Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="aditya@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Contact Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="programSelect" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Certification Program *
            </label>
            {loadingPrograms ? (
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse"></div>
            ) : programLoadError ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-600">Failed to load programs.</span>
                <button
                  type="button"
                  onClick={fetchAndResolvePrograms}
                  className="text-xs text-slate-700 underline font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
              </div>
            ) : (
              <select
                id="programSelect"
                required
                value={formData.programCode}
                onChange={handleProgramChange}
                disabled={loading || programs.length === 0}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition bg-white"
              >
                <option value="">-- Select an official program --</option>
                {Object.entries(
                  programs.reduce((acc, p) => {
                    const cat = p.category || 'Other';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(p);
                    return acc;
                  }, {})
                ).map(([catName, progs]) => (
                  <optgroup key={catName} label={catName}>
                    {progs.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.title} ({p.code})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            {!loadingPrograms && !programLoadError && programs.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">
                No active programs are currently published.
              </p>
            )}
          </div>

          {/* Fee Disclosure Box & Mandatory Acknowledgment */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="text-xs text-slate-700 leading-relaxed">
              {!formData.programCode ? (
                <span className="text-slate-500">
                  Please select a programme above to review its Task Submission &amp; Review Fee and application rules.
                </span>
              ) : !isFeeSet ? (
                <span className="font-medium text-amber-900">
                  Applications for this programme are not open yet. NOXIRA has not published its Task Submission &amp; Review Fee.
                </span>
              ) : selectedProgram.feeInr === 0 ? (
                <span>
                  Task Submission &amp; Review Fee: ₹0 (free programme). No payment is required.
                </span>
              ) : (
                <span>
                  Task Submission &amp; Review Fee: ₹{selectedProgram.feeInr} - payable only at task submission, after your application is approved. Your fee is locked at the amount shown when you apply.
                </span>
              )}
            </div>

            <label className={`flex items-start gap-2.5 pt-2 border-t border-slate-200 ${!isFeeSet ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                required
                disabled={!isFeeSet || loading}
                checked={feeAcknowledged && isFeeSet}
                onChange={(e) => setFeeAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs font-medium text-slate-800">
                I have read and understood the fee disclosure and application rules.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || loadingPrograms || programLoadError || !formData.programCode || !isFeeSet || !feeAcknowledged || programs.length === 0}
            className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Submitting Application...' : (
              <>
                Submit Application For Review
                <Send className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/verify"
          className="text-xs text-slate-500 hover:text-amber-600 inline-flex items-center gap-1 transition"
        >
          Have a certificate to verify? Open Public Verification Portal <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
