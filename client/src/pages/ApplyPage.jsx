import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle2, AlertCircle, Award, Send, ArrowRight, RotateCcw } from 'lucide-react';

export default function ApplyPage({ onNavigateToVerify }) {
  const [searchParams] = useSearchParams();
  const urlProgram = (searchParams.get('program') || '').toUpperCase().trim();

  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programLoadError, setProgramLoadError] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    programCode: 'FS-DEV',
    batchId: 'BATCH-2026-Q4'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Fetch active programs from server
  const loadPrograms = async () => {
    setLoadingPrograms(true);
    setProgramLoadError(false);
    try {
      const data = await api.getPrograms();
      const fetched = data.programs || [];
      setPrograms(fetched);

      // Check URL query param prefill
      if (urlProgram && fetched.some(p => p.code === urlProgram)) {
        setFormData(prev => ({ ...prev, programCode: urlProgram }));
      } else if (fetched.length > 0) {
        // Keep existing if valid, or default to first active program
        setFormData(prev => ({
          ...prev,
          programCode: fetched.some(p => p.code === prev.programCode) ? prev.programCode : fetched[0].code
        }));
      }
    } catch (err) {
      console.warn('Failed to load active programs:', err);
      setProgramLoadError(true);
    } finally {
      setLoadingPrograms(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, [urlProgram]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.submitApplication(formData);
      setResult(res);
      setFormData(prev => ({
        fullName: '',
        email: '',
        phone: '',
        programCode: prev.programCode,
        batchId: 'BATCH-2026-Q4'
      }));
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Certification Program *
              </label>
              {loadingPrograms ? (
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse"></div>
              ) : programLoadError ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600">Failed to load programs.</span>
                  <button
                    type="button"
                    onClick={loadPrograms}
                    className="text-xs text-slate-700 underline font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : (
                <select
                  value={formData.programCode}
                  onChange={(e) => setFormData({ ...formData, programCode: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition bg-white"
                >
                  {programs.map(p => (
                    <option key={p.code} value={p.code}>{p.title} ({p.code})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Assigned Batch Cohort
              </label>
              <input
                type="text"
                value={formData.batchId}
                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || loadingPrograms || programLoadError}
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
