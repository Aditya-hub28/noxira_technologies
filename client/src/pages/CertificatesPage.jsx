import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldCheck, XCircle, RefreshCw, AlertTriangle, ExternalLink, Hash, X, Check, Eye } from 'lucide-react';

export default function CertificatesPage({ onNavigateToVerify }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Revoke Modal
  const [revokingCert, setRevokingCert] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Replace Modal
  const [replacingCert, setReplacingCert] = useState(null);
  const [correctedName, setCorrectedName] = useState('');
  const [replacementReason, setReplacementReason] = useState('');
  const [replacing, setReplacing] = useState(false);

  const [actionError, setActionError] = useState('');

  const loadCertificates = async () => {
    setLoading(true);
    try {
      let query = `limit=100`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const data = await api.getCertificates(query);
      setCertificates(data.certificates || []);
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, [statusFilter]);

  const handleOpenRevoke = (cert) => {
    setRevokingCert(cert);
    setRevocationReason('');
    setActionError('');
  };

  const handleOpenReplace = (cert) => {
    setReplacingCert(cert);
    setCorrectedName(cert.renderedSnapshot.recipientName);
    setReplacementReason('');
    setActionError('');
  };

  const submitRevocation = async (e) => {
    e.preventDefault();
    if (!revokingCert) return;
    setRevoking(true);
    setActionError('');

    try {
      await api.revokeCertificate(revokingCert._id, { reason: revocationReason });
      setRevokingCert(null);
      loadCertificates();
    } catch (err) {
      setActionError(err.message || 'Revocation failed');
    } finally {
      setRevoking(false);
    }
  };

  const submitReplacement = async (e) => {
    e.preventDefault();
    if (!replacingCert) return;
    setReplacing(true);
    setActionError('');

    try {
      await api.replaceCertificate(replacingCert._id, {
        reason: replacementReason,
        correctedName
      });
      setReplacingCert(null);
      loadCertificates();
    } catch (err) {
      setActionError(err.message || 'Replacement failed');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Certificate Registry & Immutability Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issued certificates cannot be silently modified. Corrections mint versioned successors, while preserving historical audit trails.
          </p>
        </div>
        <button
          onClick={loadCertificates}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {[
            { label: 'All Certificates', value: '' },
            { label: 'Active Issued', value: 'ISSUED' },
            { label: 'Revoked', value: 'REVOKED' },
            { label: 'Replaced / Corrected', value: 'REPLACED' }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.value
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); loadCertificates(); }} className="flex gap-2 w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by ID, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition"
          >
            Find
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Certificate ID & Version</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Program & Issue Date</th>
                <th className="py-3 px-4">Integrity Hash</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">Loading certificate registry...</td>
                </tr>
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">No certificates found matching criteria.</td>
                </tr>
              ) : (
                certificates.map(c => (
                  <tr key={c._id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-amber-700">{c.certificateNumber}</div>
                      <div className="text-[10px] text-slate-400">Version {c.version}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {c.renderedSnapshot.recipientName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{c.programTitle}</div>
                      <div className="text-[10px] text-slate-400">{new Date(c.renderedSnapshot.issueDate).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px] block" title={c.fileStorage?.sha256Checksum}>
                        {c.fileStorage?.sha256Checksum ? `${c.fileStorage.sha256Checksum.slice(0, 10)}...` : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.status === 'ISSUED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          VALID
                        </span>
                      )}
                      {c.status === 'REVOKED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          REVOKED
                        </span>
                      )}
                      {c.status === 'REPLACED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          REPLACED (v{c.version})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onNavigateToVerify(c.publicVerificationToken)}
                          className="p-1.5 text-slate-600 hover:text-amber-600 rounded hover:bg-slate-100 transition"
                          title="Verify in Public Portal"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        {c.status === 'ISSUED' && (
                          <>
                            <button
                              onClick={() => handleOpenReplace(c)}
                              className="px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 border border-amber-300 rounded transition"
                              title="Issue Corrected Edition"
                            >
                              Correct
                            </button>
                            <button
                              onClick={() => handleOpenRevoke(c)}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-300 rounded transition"
                              title="Revoke Certificate"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revocation Modal */}
      {revokingCert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-rose-900 text-base flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Revoke Certificate
              </h3>
              <button onClick={() => setRevokingCert(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {actionError}
              </div>
            )}

            <p className="text-xs text-slate-600">
              You are revoking <span className="font-bold text-slate-900">{revokingCert.certificateNumber}</span> issued to <span className="font-bold text-slate-900">{revokingCert.renderedSnapshot.recipientName}</span>.
              The online verification portal will immediately mark this certificate as <strong>REVOKED</strong>.
            </p>

            <form onSubmit={submitRevocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Plagiarism discovered in capstone code / Withdrawn by institution request"
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevokingCert(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking || !revocationReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50"
                >
                  {revoking ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replacement Modal */}
      {replacingCert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Issue Corrected Replacement</h3>
              <button onClick={() => setReplacingCert(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {actionError}
              </div>
            )}

            <p className="text-xs text-slate-600">
              This will mint Version {replacingCert.version + 1} with updated details. The previous certificate (<span className="font-mono">{replacingCert.certificateNumber}</span>) will be marked <strong>REPLACED</strong> and link to the new one.
            </p>

            <form onSubmit={submitReplacement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corrected Recipient Name *
                </label>
                <input
                  type="text"
                  required
                  value={correctedName}
                  onChange={(e) => setCorrectedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Correction *
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="e.g. Corrected spelling typo in candidate middle name"
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplacingCert(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replacing || !replacementReason.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50"
                >
                  {replacing ? 'Minting Replacement...' : 'Mint & Supersede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
