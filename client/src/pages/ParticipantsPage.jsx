import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search, Filter, CheckCircle2, Clock, AlertCircle, XCircle, Award, Check, X, FileText } from 'lucide-react';

export default function ParticipantsPage({ onNavigateToIssuance }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  
  // Review Modal State
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('ELIGIBLE');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const loadParticipants = async () => {
    setLoading(true);
    try {
      let query = `limit=100`;
      if (statusFilter) query += `&completionStatus=${statusFilter}`;
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const data = await api.getParticipants(query);
      setParticipants(data.participants || []);
    } catch (err) {
      console.error('Failed to load participants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParticipants();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadParticipants();
  };

  const handleOpenReview = (p) => {
    setSelectedParticipant(p);
    setReviewStatus(p.completionStatus === 'PENDING' ? 'ELIGIBLE' : p.completionStatus);
    setEvidenceNotes(p.completionEvidence || '');
    setReviewError('');
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedParticipant) return;

    setSubmittingReview(true);
    setReviewError('');

    try {
      await api.updateCompletion(selectedParticipant._id, {
        status: reviewStatus,
        evidence: evidenceNotes
      });
      setSelectedParticipant(null);
      loadParticipants();
    } catch (err) {
      setReviewError(err.message || 'Failed to update completion status');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status, isIssued) => {
    if (isIssued) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Award className="w-3 h-3" /> Issued
        </span>
      );
    }
    switch (status) {
      case 'ELIGIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Eligible
          </span>
        );
      case 'REWORK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" /> Needs Rework
          </span>
        );
      case 'INELIGIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Ineligible
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Unified Participant List</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Both Web applications and Google Form CSV imports merge here. Review completion criteria before issuance.
          </p>
        </div>
        <button
          onClick={onNavigateToIssuance}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Award className="w-3.5 h-3.5 text-amber-400" />
          Go To Issuance Batch Portal
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {[
            { label: 'All Candidates', value: '' },
            { label: 'Pending Review', value: 'PENDING' },
            { label: 'Eligible', value: 'ELIGIBLE' },
            { label: 'Needs Rework', value: 'REWORK' }
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

        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-72">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
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
                <th className="py-3.5 px-4">Participant Details</th>
                <th className="py-3.5 px-4">Program & Batch</th>
                <th className="py-3.5 px-4">Intake Source</th>
                <th className="py-3.5 px-4">Completion Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">Loading candidates...</td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">No participants found matching filter.</td>
                </tr>
              ) : (
                participants.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.fullName}</div>
                      <div className="text-[11px] text-slate-400">{p.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{p.programTitle}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{p.batchId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        p.source === 'WEBSITE' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {p.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(p.completionStatus, p.isIssued)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenReview(p)}
                        className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-300 rounded-lg shadow-2xs transition"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedParticipant && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Completion Review</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify technical criteria for: <span className="font-semibold text-slate-800">{selectedParticipant.fullName}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {reviewError}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Evaluation Decision *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Eligible (Pass)', value: 'ELIGIBLE', color: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
                    { label: 'Needs Rework', value: 'REWORK', color: 'border-amber-500 text-amber-700 bg-amber-50' },
                    { label: 'Ineligible (Fail)', value: 'INELIGIBLE', color: 'border-rose-500 text-rose-700 bg-rose-50' }
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setReviewStatus(opt.value)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition ${
                        reviewStatus === opt.value
                          ? `${opt.color} ring-2 ring-offset-1 ring-slate-900 shadow-xs`
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Completion Evidence & Reviewer Remarks
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Capstone verified on GitHub. Score: 94%. Completed all mandatory modules."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedParticipant(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submittingReview ? 'Saving Review...' : 'Commit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
