import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Search, CheckCircle2, AlertCircle, Clock, RotateCcw, ArrowRight, ShieldCheck, FileText, ExternalLink, ClipboardList, BookOpen } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { APPLICATION_UNAVAILABLE_MESSAGE, APPLICATION_NEUTRAL_MESSAGE } from '../config/siteConfig';

const STATUS_LABELS = {
  APPLIED: {
    label: 'Application received',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500'
  },
  UNDER_REVIEW: {
    label: 'Under review',
    badgeClass: 'bg-amber-50 text-cyan-700 border-amber-200',
    dotClass: 'bg-cyan-500'
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
  const { googleForm1Url, isFormConfigured, loading: settingsLoading, error: settingsError } = useSiteSettings();
  const noteMessage = (settingsLoading || settingsError) ? APPLICATION_NEUTRAL_MESSAGE : APPLICATION_UNAVAILABLE_MESSAGE;

  // Offer letter lookup (email + programme)
  const [offerEmail, setOfferEmail] = useState('');
  const [offerProgramme, setOfferProgramme] = useState('');
  const [offerAppId, setOfferAppId] = useState('');
  const [programmes, setProgrammes] = useState([]);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerResult, setOfferResult] = useState(null);
  const [offerError, setOfferError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.getPrograms()
      .then(data => { if (mounted) setProgrammes(data.programs || []); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleOfferLookup = async (event) => {
    event.preventDefault();
    setOfferError('');
    setOfferResult(null);
    setOfferLoading(true);
    try {
      const data = await api.lookupOfferLetter(offerEmail, offerProgramme, offerAppId);
      setOfferResult(data.offer);
    } catch (err) {
      setOfferError(err.status === 429
        ? 'Too many attempts. Please wait a few minutes and try again.'
        : (err.message || 'No offer letter found for the details provided.'));
    } finally {
      setOfferLoading(false);
    }
  };

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
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
          <Clock className="w-3.5 h-3.5 text-cyan-600" />
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
      <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl shadow-xs p-6 sm:p-8 mb-8">
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
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
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
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm font-mono uppercase focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !applicationId.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-ink-950 hover:bg-ink-800 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink-950 text-white rounded-lg text-xs font-semibold hover:bg-ink-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry Lookup
          </button>
        </div>
      )}

      {/* State: Successful Result */}
      {application && !loading && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl shadow-xs overflow-hidden mb-8">
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

            {/* Rejection Notice & Student-Facing Feedback */}
            {application.status === 'REJECTED' && application.rejectionReason && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-1">
                <span className="font-bold block text-rose-950">Review Decision Note</span>
                <p className="text-rose-800 leading-relaxed">{application.rejectionReason}</p>
              </div>
            )}

            {/* Approval & Offer Letter Notification */}
            {application.status === 'APPROVED' && application.offerStatus && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-1">
                <span className="font-bold block text-emerald-950">Offer Letter Status</span>
                <p className="text-emerald-800 leading-relaxed">{application.offerStatus}</p>
              </div>
            )}

            {/* Module 5: Programme tasks & learning material (approved students) */}
            {application.status === 'APPROVED' && ((Array.isArray(application.tasks) && application.tasks.length > 0) || (Array.isArray(application.learningMaterials) && application.learningMaterials.length > 0)) && (
              <div className="space-y-3">
                {Array.isArray(application.tasks) && application.tasks.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs space-y-2">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5" /> Your Programme Tasks
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-blue-900 leading-relaxed">
                      {application.tasks.map((task, idx) => (
                        <li key={idx}>{task}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {Array.isArray(application.learningMaterials) && application.learningMaterials.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs space-y-2">
                    <span className="font-bold text-violet-950 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Learning Material
                    </span>
                    <ul className="space-y-1 text-violet-900 leading-relaxed">
                      {application.learningMaterials.map((item, idx) => {
                        const isLink = /^https?:\/\//i.test(item);
                        return (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="mt-0.5">•</span>
                            {isLink ? (
                              <a href={item} target="_blank" rel="noopener noreferrer" className="underline hover:text-violet-700 break-all inline-flex items-center gap-1">
                                {item} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            ) : (
                              <span>{item}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Fee Locked Disclosure (only rendered when feeLocked is a valid number, including 0) */}
            {typeof application.feeLocked === 'number' && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-xs text-slate-600 space-y-1">
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
        {/* Offer Letter Lookup: email + programme, privacy-protected */}
        <div className="bg-white/65 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl shadow-xs p-6 sm:p-8 mb-8">
          <div className="flex items-center gap-2.5 mb-1.5">
            <FileText className="w-4.5 h-4.5 text-cyan-700" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Download Offer Letter</h2>
          </div>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            Enter the email you applied with, your programme, and the application ID you received when you applied. A download link appears only when all three match an issued offer letter - so knowing someone's email alone is never enough.
          </p>
          <form onSubmit={handleOfferLookup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="offer-email" className="block text-xs font-semibold text-slate-600 mb-1.5">Registered email</label>
                <input
                  id="offer-email"
                  type="email"
                  required
                  value={offerEmail}
                  onChange={e => setOfferEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="offer-appid" className="block text-xs font-semibold text-slate-600 mb-1.5">Application ID</label>
                <input
                  id="offer-appid"
                  type="text"
                  required
                  value={offerAppId}
                  onChange={e => setOfferAppId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
                  placeholder="e.g. NOX-K7M2QP"
                />
              </div>
              <div>
                <label htmlFor="offer-programme" className="block text-xs font-semibold text-slate-600 mb-1.5">Programme</label>
                <select
                  id="offer-programme"
                  required
                  value={offerProgramme}
                  onChange={e => setOfferProgramme(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
                >
                  <option value="">Select programme</option>
                  {programmes.map(prg => (
                    <option key={prg.code} value={prg.code}>{prg.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {offerError && (
              <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{offerError}</span>
              </div>
            )}

            {offerResult && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2 text-emerald-800 flex-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Offer letter found for <strong>{offerResult.programTitle}</strong> ({offerResult.offerLetterId}). The link is valid for a limited time.</span>
                </div>
                <a
                  href={offerResult.downloadUrl}
                  className="inline-flex items-center justify-center gap-1.5 bg-ink-950 text-white text-xs font-bold rounded-full px-4 py-2 hover:bg-ink-900 transition shrink-0"
                >
                  Download PDF <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={offerLoading}
              className="w-full sm:w-auto px-6 py-2.5 bg-ink-950 text-white text-xs font-bold rounded-full hover:bg-ink-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {offerLoading ? 'Checking...' : 'Find my offer letter'}
            </button>
          </form>
        </div>

        {isFormConfigured ? (
          <a
            href={googleForm1Url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-cyan-600 inline-flex items-center gap-1 transition"
          >
            Need to submit a new application? Open Application Form <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span
            className="text-xs text-slate-400 inline-flex items-center gap-1 cursor-not-allowed"
            title={noteMessage}
          >
            Need to submit a new application? {noteMessage}
          </span>
        )}
      </div>
    </div>
  );
}
