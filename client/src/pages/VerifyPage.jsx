import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Search, ArrowRight, Lock } from 'lucide-react';

export default function VerifyPage({ initialToken }) {
  const [tokenInput, setTokenInput] = useState(initialToken || '');
  const [loading, setLoading] = useState(false);
  const [cert, setCert] = useState(null);
  const [error, setError] = useState('');

  const handleVerify = async (queryToken) => {
    const q = queryToken || tokenInput;
    if (!q || !q.trim()) return;

    setLoading(true);
    setError('');
    setCert(null);

    try {
      const data = await api.verifyToken(q.trim());
      setCert(data);
    } catch (err) {
      setError(err.message || 'Credential not found or invalid token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      handleVerify(initialToken);
    }
  }, [initialToken]);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-slate-900 rounded-2xl mb-3 shadow-md">
          <ShieldCheck className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Public Credential Verification
        </h1>
        <p className="mt-2 text-slate-600 text-sm max-w-lg mx-auto">
          Cryptographically verify the authentic issuance and validity status of any NOXIRA credential.
        </p>
      </div>

      {/* Verification Lookup Input */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 mb-8">
        <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Enter Certificate ID (e.g. NOX-2026-FSD-0001) or 128-bit Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !tokenInput.trim()}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>

      {/* Error / Not Found */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <div className="inline-flex p-3 bg-rose-100 rounded-full mb-2">
            <XCircle className="w-6 h-6 text-rose-600" />
          </div>
          <h3 className="font-bold text-rose-900 text-base">Invalid or Unverified Credential</h3>
          <p className="text-rose-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Verified Credential Card */}
      {cert && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Status Banner */}
          {cert.status === 'VALID' && (
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase">Officially Verified & Authentic</h3>
                  <p className="text-emerald-100 text-xs">Issued by NOXIRA Technologies Private Limited</p>
                </div>
              </div>
              <span className="bg-emerald-700/60 px-3 py-1 rounded-full text-xs font-semibold tracking-wider">
                STATUS: VALID
              </span>
            </div>
          )}

          {cert.status === 'REVOKED' && (
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase">Certificate Revoked</h3>
                  <p className="text-rose-100 text-xs">This credential has been officially invalidated.</p>
                </div>
              </div>
              <span className="bg-rose-700/60 px-3 py-1 rounded-full text-xs font-semibold tracking-wider">
                STATUS: REVOKED
              </span>
            </div>
          )}

          {cert.status === 'REPLACED' && (
            <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-sm tracking-wide uppercase">Superseded / Corrected</h3>
                  <p className="text-amber-100 text-xs">This credential was replaced by an updated edition.</p>
                </div>
              </div>
              <span className="bg-amber-700/60 px-3 py-1 rounded-full text-xs font-semibold tracking-wider">
                STATUS: REPLACED
              </span>
            </div>
          )}

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Recipient Name</p>
              <h2 className="text-2xl font-black text-slate-900 mt-1">{cert.recipientName}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Certification Program</p>
                <p className="text-base font-semibold text-slate-800 mt-0.5">{cert.programTitle}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Unique Certificate ID</p>
                <p className="text-base font-mono font-bold text-amber-600 mt-0.5">{cert.certificateNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Program Dates</p>
                <p className="text-sm text-slate-700 mt-0.5">
                  {new Date(cert.startDate).toLocaleDateString()} — {new Date(cert.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Date of Issuance</p>
                <p className="text-sm text-slate-700 mt-0.5">{new Date(cert.issueDate).toLocaleDateString()}</p>
              </div>
            </div>

            {/* If Replaced, link to successor */}
            {cert.status === 'REPLACED' && cert.replacement && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                <p className="text-xs text-amber-800 font-semibold uppercase tracking-wider mb-1">
                  Corrected Successor Certificate Available
                </p>
                <p className="text-sm text-amber-900 mb-2">
                  Reason for replacement: <em>"{cert.revocationReason}"</em>
                </p>
                <button
                  onClick={() => {
                    setTokenInput(cert.replacement.publicVerificationToken);
                    handleVerify(cert.replacement.publicVerificationToken);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Inspect Corrected Certificate ({cert.replacement.certificateNumber})
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* If Revoked */}
            {cert.status === 'REVOKED' && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mt-4">
                <p className="text-xs text-rose-800 font-semibold uppercase tracking-wider mb-1">
                  Revocation Audit Reason
                </p>
                <p className="text-sm text-rose-900">
                  {cert.revocationReason || 'Revoked per administrative policy.'}
                </p>
              </div>
            )}

            {/* Privacy Shield Notice */}
            <div className="border-t border-slate-100 pt-5 flex items-center gap-2 text-xs text-slate-400">
              <Lock className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <span>
                Zero personally identifiable information (email, phone, internal grades) is exposed publicly on this portal.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
