import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, CalendarDays, GraduationCap, FileText, Award, ClipboardList, LogOut, ArrowRight, Download, AlertCircle } from 'lucide-react';
import { useStudentAuth } from '../context/StudentAuthContext';
import { api } from '../services/api';

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW: 'bg-sky-50 text-sky-700 border-sky-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200'
};

function StatusPill({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block text-[10px] font-bold tracking-wide uppercase border rounded-full px-2.5 py-1 ${style}`}>
      {(status || 'PENDING').replace(/_/g, ' ')}
    </span>
  );
}

export default function StudentDashboardPage() {
  const { student, loading, logout } = useStudentAuth();
  const [applications, setApplications] = useState(null);
  const [offers, setOffers] = useState(null);
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    if (!student) return;
    let mounted = true;
    Promise.all([api.studentApplications(), api.studentOffers()])
      .then(([apps, ofs]) => {
        if (!mounted) return;
        setApplications(apps.applications || []);
        setOffers(ofs.offers || []);
      })
      .catch(err => { if (mounted) setDataError(err.message || 'Could not load your account data.'); });
    return () => { mounted = false; };
  }, [student]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-400">
        Loading your dashboard...
      </div>
    );
  }

  if (!student) {
    return <Navigate to="/login" replace />;
  }

  const joined = student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const dataLoading = applications === null || offers === null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
      {/* Profile header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 mb-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-ink-950 text-white flex items-center justify-center text-xl font-bold shrink-0">
          {student.name?.charAt(0)?.toUpperCase() || 'S'}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ink-950 tracking-tight truncate">{student.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{student.email}</span>
            {joined && <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Joined {joined}</span>}
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-full px-4 py-2 transition self-start sm:self-center"
        >
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </div>

      {dataError && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{dataError}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Applications - real data */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-bold text-ink-950">My Applications</h2>
          </div>
          {dataLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : applications.length === 0 ? (
            <div className="text-sm text-slate-500 leading-relaxed">
              <p>No internship applications are linked to this email yet.</p>
              <p className="mt-2 text-xs text-slate-400">Applied with a different email? Log in with that address, or check status with your application ID.</p>
              <Link to="/status" className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800">
                Check application status <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {applications.map(app => (
                <li key={app.applicationId} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-950 truncate">{app.programTitle}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{app.applicationId} · Applied {new Date(app.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <StatusPill status={app.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Offer letters - real data */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-bold text-ink-950">Offer Letters</h2>
          </div>
          {dataLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : offers.length === 0 ? (
            <div className="text-sm text-slate-500 leading-relaxed">
              <p>No offer letters are linked to this email yet.</p>
              <p className="mt-2 text-xs text-slate-400">Offer letters appear here after an application is approved.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {offers.map(offer => (
                <li key={offer.offerLetterId} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-950 truncate">{offer.programTitle}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{offer.offerLetterId}</p>
                  </div>
                  <a
                    href={offer.downloadUrl}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-ink-950 hover:bg-ink-900 rounded-full px-3.5 py-2 transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Skill tests - wired when the courses module lands */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <ClipboardList className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-bold text-ink-950">Skill Tests</h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">No skill tests taken yet. When skill courses go live, your scores and attempt history will appear here.</p>
        </section>

        {/* Certificates - wired when issuance is linked */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <Award className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-bold text-ink-950">Certificates</h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">No certificates linked to this email yet. Earned certificates appear here with their public verification link.</p>
          <Link to="/verify" className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800">
            Verify a certificate <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
