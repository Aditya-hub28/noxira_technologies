import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle2, AlertCircle, Award, Send, ArrowRight, RotateCcw, AlertTriangle } from 'lucide-react';

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

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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

    setLoading(true);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        programCode: formData.programCode
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
      setQueryWarning('');
      setProgramDisappearedNotice('');
    } catch (err) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-emerald-900">Application Received</h3>
            <p className="text-emerald-800 text-sm mt-1">{result.message}</p>
            <p className="text-xs text-emerald-700 mt-2">
              Candidate status is currently <span className="font-bold underline">PENDING</span>. Our administration reviews technical completion before issuing verified credentials.
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
                {programs.map(p => (
                  <option key={p.code} value={p.code}>
                    {p.title} ({p.code})
                  </option>
                ))}
              </select>
            )}
            {!loadingPrograms && !programLoadError && programs.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">
                No active programs are currently published.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || loadingPrograms || programLoadError || !formData.programCode || programs.length === 0}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg shadow-sm transition disabled:opacity-50"
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
