import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Send, Clock, CheckCircle2, AlertTriangle, XCircle, RefreshCw, RotateCcw } from 'lucide-react';

export default function DistributionPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Batch Queue Modal
  const [issuedCerts, setIssuedCerts] = useState([]);
  const [selectedCertIds, setSelectedCertIds] = useState([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      let query = `limit=100`;
      if (statusFilter) query += `&status=${statusFilter}`;
      const data = await api.listDeliveryJobs(query);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error('Failed to load delivery jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  const handleOpenQueueModal = async () => {
    setShowQueueModal(true);
    try {
      const data = await api.getCertificates('status=ISSUED&limit=200');
      const certs = data.certificates || [];
      setIssuedCerts(certs);
      setSelectedCertIds(certs.map(c => c._id));
    } catch (err) {
      console.error('Failed to load issued certs:', err);
    }
  };

  const handleQueueBatch = async () => {
    if (selectedCertIds.length === 0) return;
    setQueueing(true);

    try {
      await api.queueEmailBatch({ certificateIds: selectedCertIds });
      setShowQueueModal(false);
      loadJobs();
    } catch (err) {
      alert('Failed to queue batch: ' + err.message);
    } finally {
      setQueueing(false);
    }
  };

  const handleRetryJob = async (jobId) => {
    setRetryingId(jobId);
    try {
      await api.retryDelivery(jobId);
      loadJobs();
    } catch (err) {
      alert('Retry failed: ' + err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
      case 'PROVIDER_ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> {status}
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 animate-spin" /> Sending...
          </span>
        );
      case 'BOUNCED':
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> {status}
          </span>
        );
      case 'DELIVERY_UNKNOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Timeout Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3" /> QUEUED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Email Distribution & Delivery Monitor</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin reviews recipient list and approves sending separately. Delivers scoped 72-hour private download links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadJobs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenQueueModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Send className="w-3.5 h-3.5" />
            Queue Approved Send Batch
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-2 overflow-x-auto">
        {[
          { label: 'All Dispatches', value: '' },
          { label: 'Queued', value: 'QUEUED' },
          { label: 'Provider Accepted / Sent', value: 'PROVIDER_ACCEPTED' },
          { label: 'Failed / Bounced', value: 'FAILED' }
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

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Certificate ID</th>
                <th className="py-3 px-4">Attempts & Last Sent</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">Loading delivery logs...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">No delivery dispatches in queue. Click "Queue Approved Send Batch" above.</td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j._id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{j.participantId?.fullName || '—'}</div>
                      <div className="text-[11px] text-slate-400">{j.recipientEmail}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">
                      {j.certificateId?.certificateNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <div>Attempt #{j.attempts}</div>
                      <div className="text-[10px] text-slate-400">
                        {j.lastAttemptAt ? new Date(j.lastAttemptAt).toLocaleTimeString() : 'Pending'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(j.status)}
                      {j.lastError && (
                        <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-xs" title={j.lastError}>
                          {j.lastError}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(j.status === 'FAILED' || j.status === 'DELIVERY_UNKNOWN') && (
                        <button
                          onClick={() => handleRetryJob(j._id)}
                          disabled={retryingId === j._id}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg inline-flex items-center gap-1 transition disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3 h-3 ${retryingId === j._id ? 'animate-spin' : ''}`} />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queue Modal */}
      {showQueueModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Approve Email Dispatch Batch</h3>
            <p className="text-xs text-slate-500">
              Confirm recipient list before queuing emails. Each email delivers a private, signed 72-hour download link.
            </p>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              {issuedCerts.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No issued certificates found to email.</div>
              ) : (
                issuedCerts.map(c => (
                  <div key={c._id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{c.renderedSnapshot.recipientName}</span>
                      <span className="font-mono text-slate-400 ml-2">({c.certificateNumber})</span>
                    </div>
                    <span className="text-emerald-700 font-semibold text-[10px]">Ready</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQueueModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQueueBatch}
                disabled={queueing || issuedCerts.length === 0}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50"
              >
                {queueing ? 'Queuing Batch...' : `Approve & Queue (${issuedCerts.length}) Emails`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
