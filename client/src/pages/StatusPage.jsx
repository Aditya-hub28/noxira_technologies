import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Search, CheckCircle2, AlertCircle, Clock, RotateCcw, ArrowRight, ShieldCheck, FileText } from 'lucide-react';

const STATUS_LABELS = {
  APPLIED: {
    label: 'Application received',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500'
  },
  UNDER_REVIEW: {
    label: 'Under review',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500'
  },
  APPROVED: {
    label: 'Approved',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500'
  }
};

export default function StatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [applicationId, setApplicationId] = useState(searchParams.get('id') || '');

  const [loading, setLoading] = useState(false);
  const [application, setApplication] = useState(null);
  const [notFoundMessage, setNotFoundMessage] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [serverError, setServerError] = useState('');

  const lookupStatus = async (lookupEmail, lookupId) => {
    const cleanEmail = (lookupEmail || '').trim();
    const cleanId = (lookupId || '').trim().toUpperCase();

    if (!cleanEmail || !cleanId) return;

    setLoading(true);
    setApplication(null);
    setNotFoundMessage('');
    setRateLimited(false);
    setServerError('');

    try {
      const data = await api.getApplicationStatus(cleanEmail, cleanId);
      if (data && data.success && data.application) {
        setApplication(data.application);
      } else {
        setNotFoundMessage('No application found for the details provided.');
      }
    } catch (err) {
      if (err.status === 429) {
        setRateLimited(true);
      } else if (err.status === 404) {
        setNotFoundMessage(err.message || 'No application found for the details provided.');
      } else {
        setServerError(err.message || 'Unable to check application status. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-run lookup if both email and id are supplied in URL query parameters
  useEffect(() => {
    const queryEmail = searchParams.get('email');
    const queryId = searchParams.get('id');
    if (queryEmail && queryId) {
      setEmail(queryEmail);
      setApplicationId(queryId.toUpperCase());
      lookupStatus(queryEmail, queryId);
    }
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !applicationId.trim()) return;

    setSearchParams({
      email: email.trim(),
      id: applicationId.trim().toUpperCase()
    });
    lookupStatus(email, applicationId);
  };

  const statusMeta = application ? (STATUS_LABELS[application.status] || {
    label: application.status,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400'
  }) : null;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 font-sans">
      {/* Header Banner */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Application Tracking</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Check Application Status
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Enter your registered email address and Application ID to track the current administrative review status of your submission.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="statusEmail" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Official Registered Email *
              </label>
              <input
                id="statusEmail"
                type="email"
                required
                placeholder="aditya@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
            <div>
              <label htmlFor="statusAppId" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Application ID *
              </label>
              <input
                id="statusAppId"
                type="text"
                required
                placeholder="e.g. NOX-K7M2QP"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !applicationId.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Checking Status...</span>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Track Application</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* State: Rate Limited (429) */}
      {rateLimited && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3 mb-8">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-amber-950">Too Many Lookup Attempts</h2>
          <p className="text-xs text-amber-900 max-w-md mx-auto leading-relaxed">
            Too many status check requests have been made from this IP address. To safeguard candidate privacy, please wait 15 minutes before checking again.
          </p>
        </div>
      )}

      {/* State: Generic Not Found (404) */}
      {notFoundMessage && !rateLimited && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3 mb-8">
          <div className="w-10 h-10 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-rose-950">No Record Found</h2>
          <p className="text-xs text-rose-800 max-w-md mx-auto leading-relaxed">
            {notFoundMessage}
          </p>
          <p className="text-[11px] text-slate-500">
            Please verify that both your email address and Application ID are typed exactly as received upon submission.
          </p>
        </div>
      )}

      {/* State: Server Error with Retry */}
      {serverError && !rateLimited && !notFoundMessage && (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center space-y-3 mb-8">
          <p className="text-xs text-slate-700">{serverError}</p>
          <button
            type="button"
            onClick={() => lookupStatus(email, applicationId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry Lookup
          </button>
        </div>
      )}

      {/* State: Successful Result */}
      {application && !loading && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden mb-8">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
                  Application Reference
                </span>
                <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
                  {application.applicationId}
                </span>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusMeta?.badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${statusMeta?.dotClass}`}></span>
                  {statusMeta?.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-500 font-medium block">Programme</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {application.programTitle || 'Standard Track'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-500 font-medium block">Submission Date</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {application.appliedAt
                    ? new Date(application.appliedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'Recorded'}
                </span>
              </div>
            </div>

            {application.decidedAt && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">Decision Date</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {new Date(application.decidedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}

            {/* Fee Locked Disclosure (only rendered when feeLocked is a valid number, including 0) */}
            {typeof application.feeLocked === 'number' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                <span className="font-bold block text-slate-900">
                  Task Submission &amp; Review Fee (locked at your application): ₹{application.feeLocked}
                </span>
                <span className="text-slate-600 block">
                  Payable only at task submission, after your application is approved. No payment is required during initial review.
                </span>
              </div>
            )}

            <div className="pt-2 text-xs text-slate-500 leading-relaxed border-t border-slate-100">
              Applications are reviewed by the administration against cohort requirements. Technical evaluation and administrative verification are required before credential issuance.
            </div>
          </div>
        </div>
      )}

      {/* Helpful Quick Links */}
      <div className="text-center pt-2">
        <Link
          to="/apply"
          className="text-xs text-slate-500 hover:text-amber-600 inline-flex items-center gap-1 transition"
        >
          Need to submit a new application? Open Application Intake <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
