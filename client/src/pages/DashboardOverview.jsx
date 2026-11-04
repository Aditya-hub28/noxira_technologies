import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Clock, Award, FileSpreadsheet, Send, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';

export default function DashboardOverview({ onNavigate }) {
  const [stats, setStats] = useState({
    totalParticipants: 0,
    pendingReview: 0,
    eligibleReady: 0,
    issuedCerts: 0,
    queuedEmails: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [participantsData, certsData, jobsData] = await Promise.all([
        api.getParticipants('limit=500'),
        api.getCertificates('limit=500'),
        api.listDeliveryJobs('limit=500')
      ]);

      const parts = participantsData.participants || [];
      const certs = certsData.certificates || [];
      const jobs = jobsData.jobs || [];

      setStats({
        totalParticipants: parts.length,
        pendingReview: parts.filter(p => p.completionStatus === 'PENDING').length,
        eligibleReady: parts.filter(p => p.completionStatus === 'ELIGIBLE' && !p.isIssued).length,
        issuedCerts: certs.filter(c => c.status === 'ISSUED').length,
        queuedEmails: jobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING').length
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const cards = [
    {
      title: 'Total Intake Candidates',
      value: stats.totalParticipants,
      desc: 'Combined Web & CSV candidates',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      action: () => onNavigate('participants')
    },
    {
      title: 'Pending Review',
      value: stats.pendingReview,
      desc: 'Awaiting completion review',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      action: () => onNavigate('participants')
    },
    {
      title: 'Ready for Issuance',
      value: stats.eligibleReady,
      desc: 'Eligible & awaiting batch approval',
      icon: Award,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      action: () => onNavigate('issuance')
    },
    {
      title: 'Issued Certificates',
      value: stats.issuedCerts,
      desc: 'Immutable active credentials',
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      action: () => onNavigate('certificates')
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div>
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
            Operational Lifecycle Controller
          </span>
          <h1 className="text-2xl font-black mt-1">NOXIRA Credential Issuance Hub</h1>
          <p className="text-slate-400 text-xs mt-1">
            Strict two-stage approval: Registration intake → Completion verification → Durable vector minting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => onNavigate('issuance')}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            Launch Batch
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              onClick={c.action}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 hover:shadow transition cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{c.title}</span>
                <div className={`p-2 rounded-xl ${c.bg}`}>
                  <Icon className={`w-5 h-5 ${c.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-black text-slate-900">{c.value}</div>
                <p className="text-xs text-slate-500 mt-1">{c.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Pillars */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
          Core Lifecycle Workflows
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigate('import')}
            className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-amber-400 transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Import Google Form CSV</h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload exported CSV responses with automatic column mapping, duplicate detection, and staged review.
            </p>
          </div>

          <div
            onClick={() => onNavigate('participants')}
            className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-amber-400 transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Completion Review Gate</h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify assignments, evaluate capstones, and mark candidates as Eligible or Rework with evidence notes.
            </p>
          </div>

          <div
            onClick={() => onNavigate('distribution')}
            className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-amber-400 transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <Send className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Approved Email Distribution</h3>
            <p className="text-xs text-slate-500 mt-1">
              Queue and deliver private 72-hour download links with safe retry backoff and provider reconciliation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
