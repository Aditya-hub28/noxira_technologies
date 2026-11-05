import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Link as LinkIcon,
  Send,
  Filter,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Programs for filter dropdown
  const [programs, setPrograms] = useState([]);

  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals & Drawers
  const [detailApp, setDetailApp] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'APPROVE' | 'REJECT' | 'BATCH_APPROVE' | 'BATCH_REJECT', ids: [], app?: Object }
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [renewResult, setRenewResult] = useState(null);

  // Active offer template state
  const [activeTemplate, setActiveTemplate] = useState(null);

  // Unblock queue state & two-step preview
  const [unblocking, setUnblocking] = useState(false);
  const [unblockMessage, setUnblockMessage] = useState('');
  const [blockedPreviewModal, setBlockedPreviewModal] = useState(null);

  // Fetch programs list for filter and active template
  useEffect(() => {
    api.getPrograms().then((data) => {
      if (data && data.programs) setPrograms(data.programs);
    }).catch(() => {});

    api.adminGetOfferTemplates().then((res) => {
      if (res && res.templates) {
        const active = res.templates.find((t) => t.isActive);
        setActiveTemplate(active || null);
      }
    }).catch(() => {});
  }, []);

  // Fetch applications
  const fetchApplications = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 20);
      if (statusFilter) params.set('status', statusFilter);
      if (programFilter) params.set('programCode', programFilter);
      if (batchFilter) params.set('batchId', batchFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await api.adminGetApplications(params.toString());
      if (res.success) {
        setApplications(res.applications || []);
        setPagination(res.pagination || { total: 0, page: 1, limit: 20, pages: 1 });
        setSelectedIds([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications(1);
  }, [statusFilter, programFilter, batchFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApplications(1);
  };

  // Toggle selection
  const toggleSelectAll = () => {
    const selectable = applications.filter((a) => a.status === 'APPLIED' || a.status === 'UNDER_REVIEW');
    if (selectedIds.length === selectable.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable.map((a) => a.applicationId));
    }
  };

  const toggleSelectId = (appId) => {
    setSelectedIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  // Single status change
  const handleSingleStatusUpdate = async (appId, newStatus, reason = '', notes = '') => {
    setSubmittingAction(true);
    try {
      await api.adminUpdateApplicationStatus(appId, {
        status: newStatus,
        rejectionReason: reason,
        adminNotes: notes
      });
      setActionModal(null);
      setRejectionReason('');
      setActionNotes('');
      fetchApplications(pagination.page);
      if (detailApp && detailApp.applicationId === appId) {
        // Refresh detail
        const refDetail = await api.adminGetApplicationDetail(appId);
        if (refDetail && refDetail.application) setDetailApp(refDetail.application);
      }
    } catch (err) {
      alert(err.message || 'Error updating application status');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Batch status change
  const handleBatchAction = async () => {
    if (!actionModal || !actionModal.type) return;
    const isApprove = actionModal.type === 'BATCH_APPROVE';
    setSubmittingAction(true);
    try {
      const res = await api.adminBatchReviewApplications({
        applicationIds: actionModal.ids,
        action: isApprove ? 'APPROVE' : 'REJECT',
        rejectionReason: isApprove ? undefined : rejectionReason,
        adminNotes: actionNotes
      });
      alert(`Batch review complete: ${res.summary.succeeded} succeeded, ${res.summary.failed} failed.`);
      setActionModal(null);
      setRejectionReason('');
      setActionNotes('');
      setSelectedIds([]);
      fetchApplications(pagination.page);
    } catch (err) {
      alert(err.message || 'Error executing batch action');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Renew link
  const handleRenewLink = async (appId) => {
    try {
      const res = await api.adminRenewOfferLink(appId);
      setRenewResult(res);
      alert('Offer download link renewed! New link is active for 72 hours.');
      const refDetail = await api.adminGetApplicationDetail(appId);
      if (refDetail && refDetail.application) setDetailApp(refDetail.application);
    } catch (err) {
      alert(err.message || 'Failed to renew link');
    }
  };

  // Process blocked applications (two-step preview and confirmation)
  const handleOpenBlockedPreview = async () => {
    setUnblocking(true);
    try {
      const res = await api.adminGetBlockedPreview();
      setBlockedPreviewModal(res);
    } catch (err) {
      alert(err.message || 'Failed to inspect blocked queue');
    } finally {
      setUnblocking(false);
    }
  };

  const handleConfirmSendBlocked = async () => {
    setUnblocking(true);
    setUnblockMessage('');
    try {
      const res = await api.adminSendBlockedApplications();
      setBlockedPreviewModal(null);
      setUnblockMessage(`Processed ${res.processedCount || 0} blocked applications successfully.`);
      fetchApplications(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to process blocked applications');
    } finally {
      setUnblocking(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>;
      case 'UNDER_REVIEW':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Under Review</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Applied</span>;
    }
  };

  const getDeliveryBadge = (state) => {
    if (!state || state === 'NONE') return <span className="text-slate-400 text-[11px]">—</span>;
    switch (state) {
      case 'PROVIDER_ACCEPTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Delivered</span>;
      case 'SIMULATED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">Simulated (Dev)</span>;
      case 'BLOCKED_TEMPLATE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800" title="Active template is sample; waiting for custom template activation">Blocked (Sample)</span>;
      case 'QUEUED':
      case 'PROCESSING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">Queued</span>;
      case 'FAILED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">Failed</span>;
      case 'DELIVERY_UNKNOWN':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Reconcile Req.</span>;
      default:
        return <span className="text-slate-500 text-[10px]">{state}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Admissions &amp; Selection Gate
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review internship applications, manage selections, and monitor offer letter generation and delivery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenBlockedPreview}
            disabled={unblocking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            title="Inspect and process applications blocked waiting for custom template activation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${unblocking ? 'animate-spin' : ''}`} />
            Process Blocked Queue
          </button>
        </div>
      </div>

      {unblockMessage && (
        <div className="p-3 text-xs bg-blue-50 border border-blue-200 rounded-lg text-blue-800 flex items-center justify-between">
          <span>{unblockMessage}</span>
          <button onClick={() => setUnblockMessage('')} className="text-blue-600 font-bold">&times;</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, candidate name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="">All Statuses</option>
            <option value="APPLIED">Applied</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 max-w-[200px]"
          >
            <option value="">All Programmes</option>
            {programs.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} - {p.title}
              </option>
            ))}
          </select>

          {(statusFilter || programFilter || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setProgramFilter('');
                setSearchTerm('');
              }}
              className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-800 transition"
              title="Clear Filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-amber-900 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-[11px]">
              {selectedIds.length}
            </span>
            <span>applications selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActionModal({ type: 'BATCH_APPROVE', ids: selectedIds })}
              className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
            >
              Approve Selected ({selectedIds.length})
            </button>
            <button
              onClick={() => setActionModal({ type: 'BATCH_REJECT', ids: selectedIds })}
              className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition"
            >
              Reject Selected ({selectedIds.length})
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Applications Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading applications...</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">{error}</div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-bold text-slate-700 text-sm">No applications found.</p>
            <p className="text-xs">Adjust your search or filter criteria to see submitted records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-8">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                      {selectedIds.length > 0 && selectedIds.length === applications.filter(a => a.status === 'APPLIED' || a.status === 'UNDER_REVIEW').length ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3">Application ID</th>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Programme</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3">Review Fee</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Offer Delivery</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => {
                  const isSelectable = app.status === 'APPLIED' || app.status === 'UNDER_REVIEW';
                  const isSelected = selectedIds.includes(app.applicationId);

                  return (
                    <tr key={app._id} className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-amber-50/40' : ''}`}>
                      <td className="p-3">
                        {isSelectable ? (
                          <button onClick={() => toggleSelectId(app.applicationId)} className="text-slate-400 hover:text-slate-700">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-900">{app.applicationId}</span>
                        <span className="block text-[10px] text-slate-400">
                          {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN') : ''}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">
                          {app.participantId ? app.participantId.fullName : 'Applicant'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {app.participantId ? app.participantId.email : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-800 block truncate max-w-[180px]" title={app.programTitle}>
                          {app.programTitle || app.programCode}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{app.programCode}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {app.batchId || 'DEFAULT'}
                      </td>
                      <td className="p-3 font-medium">
                        {typeof app.feeLocked === 'number' ? (
                          app.feeLocked === 0 ? '₹0 (Free)' : `₹${app.feeLocked}`
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {getStatusBadge(app.status)}
                      </td>
                      <td className="p-3">
                        {getDeliveryBadge(app.offerDeliveryState)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailApp(app)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isSelectable && (
                            <>
                              <button
                                onClick={() => setActionModal({ type: 'APPROVE', ids: [app.applicationId], app })}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[11px] font-semibold"
                                title="Approve"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionModal({ type: 'REJECT', ids: [app.applicationId], app })}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-semibold"
                                title="Reject"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <span>
            Total: <strong>{pagination.total}</strong> applications (Page {pagination.page} of {pagination.pages})
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchApplications(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchApplications(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Confirmation Modal (Single or Batch Rejection / Approval) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {actionModal.type === 'APPROVE' && `Confirm Approval: ${actionModal.app?.applicationId || actionModal.ids[0]}`}
              {actionModal.type === 'BATCH_APPROVE' && `Batch Approve ${actionModal.ids.length} Applications`}
              {actionModal.type === 'REJECT' && `Reject Application ${actionModal.ids[0]}`}
              {actionModal.type === 'BATCH_REJECT' && `Batch Reject ${actionModal.ids.length} Applications`}
            </h3>

            {/* Recipient Details & Dispatch Mode for Single Approval */}
            {actionModal.type === 'APPROVE' && actionModal.app && (
              <div className="space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Candidate Name:</span>
                    <span className="font-semibold text-slate-900">{actionModal.app.participantId?.fullName || 'Applicant'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recipient Email:</span>
                    <span className="font-semibold text-slate-900 font-mono">{actionModal.app.participantId?.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Programme Track:</span>
                    <span className="font-semibold text-slate-900">{actionModal.app.programTitle || actionModal.app.programCode} ({actionModal.app.programCode})</span>
                  </div>
                </div>

                {/* Email Dispatch State Banner */}
                {activeTemplate && !activeTemplate.isSample ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Email Dispatch Active (Custom Template)
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      An official offer email with the generated PDF attached and a 72-hour private download link will be dispatched immediately to <strong>{actionModal.app.participantId?.email}</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-purple-600" />
                      Sample Template Active (Email Blocked)
                    </div>
                    <p className="text-[11px] text-purple-800">
                      Offer PDF will be generated using the built-in sample template. Email dispatch is safely <strong>blocked</strong> until a custom PDF template is activated. The public tracker will show &ldquo;Offer letter is being prepared by admissions&rdquo;.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Recipient Details & Dispatch Mode for Batch Approval */}
            {actionModal.type === 'BATCH_APPROVE' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  Review the <strong>{actionModal.ids.length}</strong> candidate(s) queued for approval:
                </div>

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs bg-slate-50/50">
                  {applications.filter((a) => actionModal.ids.includes(a.applicationId)).map((cand) => (
                    <div key={cand.applicationId} className="p-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-900">{cand.participantId?.fullName || 'Applicant'}</span>
                        <span className="block text-[11px] text-slate-500 font-mono">{cand.participantId?.email}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-mono text-slate-600 block">{cand.applicationId}</span>
                        <span className="text-[10px] text-slate-400">{cand.programCode}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Email Dispatch State Banner */}
                {activeTemplate && !activeTemplate.isSample ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Email Dispatch Active (Custom Template)
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Official offer emails with attached PDFs and 72-hour private download links will be queued and dispatched to all <strong>{actionModal.ids.length}</strong> recipients.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-purple-600" />
                      Sample Template Active (Email Blocked)
                    </div>
                    <p className="text-[11px] text-purple-800">
                      Offer PDFs will be generated using the built-in sample template. Email dispatch is safely <strong>blocked</strong> for all candidates until a custom PDF template is activated.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Rejection Details */}
            {(actionModal.type === 'REJECT' || actionModal.type === 'BATCH_REJECT') && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Please provide a student-facing rejection reason. This message will be displayed to the candidate on the public status tracker.
                </p>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Cohort capacity reached or prerequisites not matched for this track."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Internal Administrative Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Internal audit notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setRejectionReason('');
                  setActionNotes('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || ((actionModal.type === 'REJECT' || actionModal.type === 'BATCH_REJECT') && !rejectionReason.trim())}
                onClick={() => {
                  if (actionModal.type === 'APPROVE') {
                    handleSingleStatusUpdate(actionModal.ids[0], 'APPROVED', '', actionNotes);
                  } else if (actionModal.type === 'REJECT') {
                    handleSingleStatusUpdate(actionModal.ids[0], 'REJECTED', rejectionReason, actionNotes);
                  } else {
                    handleBatchAction();
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition disabled:opacity-50 ${
                  actionModal.type === 'APPROVE' || actionModal.type === 'BATCH_APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingAction
                  ? 'Processing...'
                  : actionModal.type === 'APPROVE'
                  ? 'Confirm & Approve'
                  : actionModal.type === 'BATCH_APPROVE'
                  ? `Approve All (${actionModal.ids.length})`
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Queue Two-Step Preview & Confirmation Modal */}
      {blockedPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Process Blocked Offer Letter Queue</h3>
                <p className="text-xs text-slate-500">
                  {blockedPreviewModal.count} candidate(s) awaiting offer letter dispatch
                </p>
              </div>
              <button
                onClick={() => setBlockedPreviewModal(null)}
                className="p-1 text-slate-400 hover:text-slate-800 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {blockedPreviewModal.count === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">No applications in blocked queue</p>
                <p className="text-xs text-slate-500">There are no approved applications currently awaiting custom template delivery.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border text-xs ${
                  blockedPreviewModal.canProcess
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {blockedPreviewModal.canProcess ? (
                    <div>
                      <span className="font-bold">Active Custom Template:</span>{' '}
                      {blockedPreviewModal.activeTemplate?.name} (v{blockedPreviewModal.activeTemplate?.version})
                      <p className="mt-1 text-[11px] text-emerald-700">
                        Confirming will regenerate offer PDFs with this active template and immediately dispatch delivery emails to all listed candidates.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold">Cannot Dispatch:</span> No custom offer template is currently active.
                      <p className="mt-1 text-[11px] text-rose-700">
                        Please upload and activate a custom PDF template in the Offer Letter Studio before processing the blocked queue.
                      </p>
                    </div>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                  {blockedPreviewModal.recipients.map((r) => (
                    <div key={r.applicationId} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{r.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{r.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-slate-700 text-[11px] font-bold">{r.applicationId}</div>
                        <div className="text-[10px] text-slate-400">{r.programCode} ({r.batchId})</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBlockedPreviewModal(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                {blockedPreviewModal.count === 0 ? 'Close' : 'Cancel'}
              </button>
              {blockedPreviewModal.count > 0 && (
                <button
                  type="button"
                  disabled={unblocking || !blockedPreviewModal.canProcess}
                  onClick={handleConfirmSendBlocked}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {unblocking ? 'Processing Queue...' : `Confirm & Dispatch (${blockedPreviewModal.count})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Application Detail Drawer Modal */}
      {detailApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Application Detail</span>
                <h2 className="text-xl font-mono font-bold text-slate-900">{detailApp.applicationId}</h2>
              </div>
              <button
                onClick={() => setDetailApp(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                &times;
              </button>
            </div>

            {/* Candidate & Programme Details */}
            <div className="space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Candidate Overview</h3>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Legal Name:</span>
                  <span className="font-semibold text-slate-900">{detailApp.participantId?.fullName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-semibold text-slate-900">{detailApp.participantId?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-semibold text-slate-900">{detailApp.participantId?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">College / Branch:</span>
                  <span className="font-semibold text-slate-900">
                    {detailApp.participantId?.college || 'N/A'} ({detailApp.participantId?.branch || 'N/A'})
                  </span>
                </div>
              </div>
            </div>

            {/* Application & Selection Status */}
            <div className="space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Selection &amp; Offer State</h3>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status:</span>
                  <div>{getStatusBadge(detailApp.status)}</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Offer Delivery:</span>
                  <div>{getDeliveryBadge(detailApp.offerDeliveryState)}</div>
                </div>
                {detailApp.rejectionReason && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-rose-600 font-semibold block mb-0.5">Rejection Reason:</span>
                    <p className="text-slate-700 bg-rose-50 p-2 rounded border border-rose-100">{detailApp.rejectionReason}</p>
                  </div>
                )}
                {detailApp.adminNotes && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-0.5">Admin Notes:</span>
                    <p className="text-slate-700 bg-white p-2 rounded border border-slate-200">{detailApp.adminNotes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Offer Letter Actions */}
            {detailApp.status === 'APPROVED' && (
              <div className="space-y-3 text-xs">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Offer Letter Management</h3>
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 space-y-3">
                  <p className="text-slate-600">
                    Candidates access offer letters via a secure 72-hour expiring bearer download token. You can renew this link if an applicant's link has expired.
                  </p>
                  <button
                    onClick={() => handleRenewLink(detailApp.applicationId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Renew 72-Hour Download Link
                  </button>

                  {renewResult && (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block">Fresh Download URL:</span>
                      <input
                        type="text"
                        readOnly
                        value={renewResult.downloadUrl}
                        className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-200 rounded font-mono"
                        onClick={(e) => e.target.select()}
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Expires: {new Date(renewResult.expiresAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Audit History Trail */}
            <div className="space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Audit History Trail</h3>
              {detailApp.history && detailApp.history.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  {detailApp.history.map((hist, idx) => (
                    <div key={idx} className="p-3 space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-slate-800">
                          {hist.fromStatus} &rarr; {hist.toStatus}
                        </span>
                        <span className="text-slate-400">
                          {new Date(hist.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Actor: {hist.actorName || 'Admin'} {hist.reason ? `· Note: "${hist.reason}"` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs">No status transitions recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
