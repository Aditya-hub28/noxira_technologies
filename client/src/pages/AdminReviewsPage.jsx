import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  MessageSquareHeart,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trash2,
  Star,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldX
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'PENDING', label: 'Pending', Icon: Clock },
  { id: 'APPROVED', label: 'Approved', Icon: ShieldCheck },
  { id: 'REJECTED', label: 'Rejected', Icon: ShieldX }
];

function StarRow({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? 'text-amber-500 fill-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [status, setStatus] = useState('PENDING');
  const [reviews, setReviews] = useState([]);
  const [counts, setCounts] = useState({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (nextStatus = status) => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await api.adminGetReviews(nextStatus);
      setReviews(res.reviews || []);
      setCounts(res.counts || { PENDING: 0, APPROVED: 0, REJECTED: 0 });
    } catch (err) {
      setFetchError(err.message || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const act = async (id, fn, verb) => {
    setBusyId(id);
    setActionError('');
    setSuccessMessage('');
    try {
      await fn(id);
      setSuccessMessage(`Review ${verb}.`);
      await load(status);
    } catch (err) {
      setActionError(err.message || `Could not ${verb.slice(0, -1)} the review.`);
    } finally {
      setBusyId(null);
    }
  };

  const approve = (id) => act(id, api.adminApproveReview, 'approved and now public');
  const reject = (id) => act(id, api.adminRejectReview, 'rejected');
  const remove = (id) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;
    act(id, api.adminDeleteReview, 'deleted');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquareHeart className="w-6 h-6 text-amber-600" />
            Student Reviews
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Approve or reject submitted feedback. Only approved reviews are visible on the public site.
          </p>
        </div>
        <button
          onClick={() => load(status)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Error loading reviews</div>
            <div>{fetchError}</div>
          </div>
        </div>
      )}
      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800">
          {actionError}
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="font-medium">{successMessage}</div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-2xs flex flex-wrap gap-2">
        {STATUS_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setStatus(id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              status === id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                status === id ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {counts[id] || 0}
            </span>
          </button>
        ))}
      </div>

      {loading && reviews.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-400">
          Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-400">
          No {status.toLowerCase()} reviews.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{r.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{r.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StarRow rating={r.rating} />
                  <span className="text-[11px] text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">
                {r.text}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {r.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => approve(r._id)}
                      disabled={busyId === r._id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; Publish
                    </button>
                    <button
                      onClick={() => reject(r._id)}
                      disabled={busyId === r._id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => remove(r._id)}
                  disabled={busyId === r._id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
