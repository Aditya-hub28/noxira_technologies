import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Award, CheckSquare, Square, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

export default function IssuanceBatchPage({ onBatchSuccess }) {
  const [eligibleParticipants, setEligibleParticipants] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState('');

  const [overrideDates, setOverrideDates] = useState({
    startDate: '',
    endDate: ''
  });

  const loadEligible = async () => {
    setLoading(true);
    try {
      // Fetch only ELIGIBLE and NOT yet issued participants
      const data = await api.getParticipants('completionStatus=ELIGIBLE&isIssued=false&limit=200');
      const list = data.participants || [];
      setEligibleParticipants(list);
      setSelectedIds(list.map(p => p._id)); // Select all by default
    } catch (err) {
      console.error('Failed to load eligible candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEligible();
  }, []);

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === eligibleParticipants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleParticipants.map(p => p._id));
    }
  };

  const handleAuthorizeIssuance = async () => {
    if (selectedIds.length === 0) return;

    setIssuing(true);
    setError('');
    setBatchResult(null);

    try {
      const payload = {
        participantIds: selectedIds,
        idempotencyKey: `batch-${Date.now()}`
      };

      if (overrideDates.startDate && overrideDates.endDate) {
        payload.overrideDates = {
          startDate: new Date(overrideDates.startDate),
          endDate: new Date(overrideDates.endDate)
        };
      }

      const res = await api.issueBatch(payload);
      setBatchResult(res.results);
      loadEligible(); // Refresh remaining
    } catch (err) {
      setError(err.message || 'Batch issuance failed');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Batch Issuance Gate</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Only candidates marked <strong>ELIGIBLE</strong> in the completion review appear here. Mints durable vector PDFs and assigns unique 128-bit verification tokens.
          </p>
        </div>
        <button
          onClick={loadEligible}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh List
        </button>
      </div>

      {/* Issuance Results Banner */}
      {batchResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-emerald-900 text-sm">Batch Issuance Completed Successfully</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-sm text-xs">
            <div className="p-2 bg-emerald-100/60 rounded-lg">
              <span className="text-emerald-800 font-bold">{batchResult.issued}</span> Newly Minted
            </div>
            <div className="p-2 bg-slate-100 rounded-lg">
              <span className="text-slate-800 font-bold">{batchResult.alreadyIssued}</span> Already Issued
            </div>
            <div className="p-2 bg-rose-100/60 rounded-lg">
              <span className="text-rose-800 font-bold">{batchResult.failed}</span> Failed
            </div>
          </div>
          <button
            onClick={onBatchSuccess}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
          >
            Open Certificate Registry to Distribute / Manage <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Batch Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            disabled={eligibleParticipants.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            {selectedIds.length === eligibleParticipants.length && eligibleParticipants.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-amber-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            Select All ({selectedIds.length} of {eligibleParticipants.length})
          </button>
        </div>

        <button
          onClick={handleAuthorizeIssuance}
          disabled={issuing || selectedIds.length === 0}
          className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Award className="w-4 h-4 text-amber-400" />
          {issuing ? 'Minting Vector Credentials...' : `Authorize & Issue (${selectedIds.length}) Certificates`}
        </button>
      </div>

      {/* Eligible Candidates Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Program & Batch</th>
                <th className="py-3 px-4">Reviewer Remarks</th>
                <th className="py-3 px-4 text-right">Eligibility Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">Loading approved candidates...</td>
                </tr>
              ) : eligibleParticipants.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    No unissued candidates currently in ELIGIBLE status. Review pending intake first.
                  </td>
                </tr>
              ) : (
                eligibleParticipants.map(p => {
                  const isChecked = selectedIds.includes(p._id);
                  return (
                    <tr
                      key={p._id}
                      onClick={() => handleToggleSelect(p._id)}
                      className={`cursor-pointer transition ${isChecked ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-3 px-4">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.fullName}</div>
                        <div className="text-[11px] text-slate-400">{p.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{p.programTitle}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.batchId}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 italic">
                        {p.completionEvidence || 'All criteria verified.'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          APPROVED
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
