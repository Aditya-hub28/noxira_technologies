import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, CalendarDays, GraduationCap, FileText, Award, ClipboardList, LogOut, ArrowRight, Download, AlertCircle, ShieldCheck, Link2, CheckCircle2 } from 'lucide-react';
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
  const { student, loading, logout, refresh } = useStudentAuth();
  const [applications, setApplications] = useState(null);
  const [offers, setOffers] = useState(null);
  const [skillAttempts, setSkillAttempts] = useState(null);
  const [dataError, setDataError] = useState('');

  const reload = () => {
    if (!student) return;
    Promise.all([api.studentApplications(), api.studentOffers(), api.mySkillAttempts()])
      .then(([apps, ofs, atts]) => {
        setApplications(apps.applications || []);
        setOffers(ofs.offers || []);
        setSkillAttempts(atts.attempts || []);
      })
      .catch(err => setDataError(err.message || 'Could not load your account data.'));
  };

  useEffect(() => {
    setApplications(null);
    setOffers(null);
    setSkillAttempts(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, student?.emailVerified]);

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

      {!student.emailVerified && <EmailVerifyCard onVerified={refresh} />}

      <ClaimApplicationCard onClaimed={reload} />

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

        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                <ClipboardList className="w-4.5 h-4.5" />
              </div>
              <h2 className="text-base font-bold text-ink-950">Skill Tests</h2>
            </div>
            <Link to="/skill-courses" className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 transition">
              Take a test <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {skillAttempts === null ? (
            <p className="text-sm text-slate-400">Loading your attempts...</p>
          ) : skillAttempts.length === 0 ? (
            <p className="text-sm text-slate-500 leading-relaxed">No skill tests taken yet. Your scores and attempt history will appear here after your first assessment.</p>
          ) : (
            <ul className="space-y-2.5">
              {skillAttempts.map(a => (
                <li key={a.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-950 truncate">{a.courseTitle}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {a.score}/{a.totalQuestions} correct · {a.scorePercent}%{a.lateSubmit ? ' · submitted after the time limit' : ''}
                      {' · '}{new Date(a.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold tracking-wide uppercase border rounded-full px-2.5 py-1 ${a.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {a.passed ? 'Passed' : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          )}
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


function EmailVerifyCard({ onVerified }) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const requestCode = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.studentRequestVerification();
      setSent(true);
      setMsg('A 6-digit code has been sent to your email. It expires in 10 minutes.');
    } catch (e) {
      setErr(e.message || 'Could not send the code.');
    } finally { setBusy(false); }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.studentConfirmVerification(code);
      setMsg('Email verified.');
      onVerified && onVerified();
    } catch (e2) {
      setErr(e2.message || 'Verification failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 sm:p-7 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <ShieldCheck className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-bold text-ink-950">Verify your email</h2>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        Your applications and offer letters stay private until you prove this email is yours. Verify it once to unlock records linked to this address.
      </p>
      {msg && (
        <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{err}</span>
        </div>
      )}
      {!sent ? (
        <button onClick={requestCode} disabled={busy}
          className="px-5 py-2.5 bg-ink-950 text-white text-xs font-bold rounded-full hover:bg-ink-900 transition disabled:opacity-60">
          {busy ? 'Sending...' : 'Send verification code'}
        </button>
      ) : (
        <form onSubmit={confirm} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text" inputMode="numeric" maxLength={6} required
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit code"
            className="w-full sm:w-48 px-4 py-2.5 text-sm tracking-[0.3em] text-center rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
          />
          <button type="submit" disabled={busy || code.length !== 6}
            className="px-5 py-2.5 bg-ink-950 text-white text-xs font-bold rounded-full hover:bg-ink-900 transition disabled:opacity-60">
            {busy ? 'Verifying...' : 'Verify'}
          </button>
          <button type="button" onClick={requestCode} disabled={busy}
            className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition">
            Resend code
          </button>
        </form>
      )}
    </div>
  );
}

function ClaimApplicationCard({ onClaimed }) {
  const [appId, setAppId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const claim = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      const data = await api.studentClaimApplication(appId);
      setMsg(`Linked: ${data.application.programTitle} (${data.application.applicationId})`);
      setAppId('');
      onClaimed && onClaimed();
    } catch (e2) {
      setErr(e2.status === 404 ? 'No application found for the details provided.' : (e2.message || 'Could not link the application.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
          <Link2 className="w-4.5 h-4.5" />
        </div>
        <h2 className="text-base font-bold text-ink-950">Link an application</h2>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed mb-4">
        Applied before creating this account? Enter the application ID you received at apply time to link it here. The ID must belong to this account's email.
      </p>
      {msg && (
        <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{msg}</span>
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{err}</span>
        </div>
      )}
      <form onSubmit={claim} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text" required
          value={appId} onChange={e => setAppId(e.target.value)}
          placeholder="e.g. NOX-K7M2QP"
          className="w-full sm:w-56 px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition"
        />
        <button type="submit" disabled={busy}
          className="px-5 py-2.5 bg-ink-950 text-white text-xs font-bold rounded-full hover:bg-ink-900 transition disabled:opacity-60">
          {busy ? 'Linking...' : 'Link application'}
        </button>
      </form>
    </div>
  );
}
