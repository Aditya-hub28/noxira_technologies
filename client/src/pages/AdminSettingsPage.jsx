import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  Sliders,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Trash2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { refetchSettings } = useSiteSettings();
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // In-app Confirmation Modal State: null | { action: 'save' | 'clear', url: string }
  const [confirmModal, setConfirmModal] = useState(null);

  const fetchCurrentSettings = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await api.adminGetGoogleForm1();
      const url = res?.googleForm1Url || '';
      setCurrentUrl(url);
      setInputUrl(url);
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch current settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentSettings();
  }, []);

  const validateUrl = (urlToValidate) => {
    const trimmed = urlToValidate.trim();
    if (!trimmed) {
      return { valid: false, message: 'URL cannot be empty. Use "Clear Link" to disable applications.' };
    }

    if (trimmed.includes('@')) {
      return { valid: false, message: "Invalid URL: Userinfo ('@') is not allowed." };
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (err) {
      return { valid: false, message: 'Invalid URL format. Please provide a full URL including https://.' };
    }

    if (parsed.protocol !== 'https:') {
      return { valid: false, message: 'URL must use secure HTTPS protocol (https://).' };
    }

    if (parsed.username || parsed.password) {
      return { valid: false, message: 'Userinfo is not allowed in Google Form URLs.' };
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== 'docs.google.com' && host !== 'forms.gle') {
      return { valid: false, message: 'Hostname must be exactly "docs.google.com" or "forms.gle".' };
    }

    if (host === 'docs.google.com' && !parsed.pathname.startsWith('/forms/')) {
      return { valid: false, message: 'docs.google.com URL path must start with "/forms/".' };
    }

    return { valid: true, url: trimmed };
  };

  const handleOpenSaveConfirm = (e) => {
    e.preventDefault();
    setInlineError('');
    setSuccessMessage('');

    const validation = validateUrl(inputUrl);
    if (!validation.valid) {
      setInlineError(validation.message);
      return;
    }

    setConfirmModal({
      action: 'save',
      url: validation.url
    });
  };

  const handleOpenClearConfirm = () => {
    setInlineError('');
    setSuccessMessage('');
    setConfirmModal({
      action: 'clear',
      url: ''
    });
  };

  const executeConfirmedAction = async () => {
    if (!confirmModal) return;
    const { action, url } = confirmModal;
    setSubmitting(true);
    setInlineError('');
    setSuccessMessage('');

    try {
      const res = await api.adminUpdateGoogleForm1(url);
      const updatedUrl = res?.googleForm1Url || '';
      setCurrentUrl(updatedUrl);
      setInputUrl(updatedUrl);
      setConfirmModal(null);
      if (action === 'save') {
        setSuccessMessage('Google Form 1 link updated successfully. All public Apply buttons are now active.');
      } else {
        setSuccessMessage('Google Form 1 link cleared successfully. All public Apply buttons are now disabled.');
      }
      // Re-synchronize public settings state in application context
      await refetchSettings();
    } catch (err) {
      setInlineError(err.message || 'Failed to update Google Form 1 link.');
      setConfirmModal(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-600" />
            Website &amp; Intake Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage the candidate intake application link (Google Form 1) across the entire public platform.
          </p>
        </div>

        <button
          onClick={fetchCurrentSettings}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          title="Refresh current settings"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Error loading settings</div>
            <div>{fetchError}</div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="font-medium">{successMessage}</div>
        </div>
      )}

      {/* Current Intake Link Status Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Form 1 Candidate Intake Link
            </span>
          </div>
          {currentUrl ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active &amp; Live
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Applications Disabled
            </span>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Current Configured Target URL
          </div>
          {currentUrl ? (
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs text-slate-900 break-all select-all font-semibold">
                {currentUrl}
              </span>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 transition bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200"
                title="Test opening link in a new tab"
              >
                Test Link <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              No application link is currently configured. All "Apply Now" buttons on the public website are disabled with "Application link is not available yet."
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            Configure Google Form 1 URL
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set or update the public Google Form URL for candidate applications. Only official Google Form URLs (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">docs.google.com/forms/*</code> or <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">forms.gle/*</code>) are permitted.
          </p>
        </div>

        {inlineError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{inlineError}</span>
          </div>
        )}

        <form onSubmit={handleOpenSaveConfirm} className="space-y-4">
          <div>
            <label className="block uppercase font-bold text-[10px] tracking-wider text-slate-500 mb-1">
              Google Form 1 URL
            </label>
            <input
              type="text"
              placeholder="https://docs.google.com/forms/d/e/... or https://forms.gle/..."
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setInlineError('');
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Must use secure HTTPS protocol. Userinfo (@) and unauthorized external hostnames are strictly rejected.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting || loading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              Save &amp; Publish Link
            </button>

            {currentUrl && (
              <button
                type="button"
                onClick={handleOpenClearConfirm}
                disabled={submitting || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Link (Disable Applications)
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                confirmModal.action === 'save'
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                {confirmModal.action === 'save' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {confirmModal.action === 'save' ? 'Confirm Link Update' : 'Confirm Link Clearance'}
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmModal.action === 'save' ? 'Publish candidate intake URL' : 'Disable candidate applications'}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              {confirmModal.action === 'save' ? (
                <>
                  <p>
                    Are you sure you want to update the public Google Form 1 link? All "Apply Now" buttons across the public website will immediately route candidates to:
                  </p>
                  <p className="font-mono font-bold text-slate-900 bg-slate-100 p-2.5 rounded-lg break-all text-[11px] border border-slate-200">
                    {confirmModal.url}
                  </p>
                </>
              ) : (
                <p>
                  Are you sure you want to clear the Google Form 1 link? All "Apply" buttons and application links on the public website will be immediately disabled with the notice:
                  <span className="block font-semibold text-slate-800 mt-1 italic">
                    "Application link is not available yet."
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                disabled={submitting}
                className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition ${
                  confirmModal.action === 'save'
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting ? 'Updating...' : confirmModal.action === 'save' ? 'Confirm & Publish' : 'Confirm & Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
