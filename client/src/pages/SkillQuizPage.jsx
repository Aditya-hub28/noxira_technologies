import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Clock, Download, Loader2, Lock, X } from 'lucide-react';
import { api } from '../services/api';

function normalizeResult(r = {}) {
  return {
    score: r.score,
    totalQuestions: r.totalQuestions,
    percent: r.scorePercent,
    attemptedCount: r.attemptedCount,
    timeUsedSeconds: r.timeUsedSeconds,
    certificatePending: r.certificatePending === true,
    certificateId: r.certificate && r.certificate.id,
    certificateNumber: r.certificate && r.certificate.certificateNumber,
    verificationToken: r.certificate && r.certificate.verificationToken,
    status: r.passed ? 'PASSED' : (r.lateSubmit ? 'TIME_EXPIRED' : 'FAILED')
  };
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatDuration(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Score ring for the result screen
function ScoreRing({ percent, pass }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const filled = c * (Math.min(100, Math.max(0, percent)) / 100);
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 128 128" className="w-36 h-36 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-slate-100" />
        <circle
          cx="64" cy="64" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className={pass ? 'stroke-teal-500' : 'stroke-rose-400'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-ink-950 tracking-tight">{percent}%</span>
      </div>
    </div>
  );
}

export default function SkillQuizPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [attempt, setAttempt] = useState(location.state?.attempt || null);
  // revealed: questionId -> { chosen, correctIndex, correct } - locked answers with their feedback
  const [revealed, setRevealed] = useState(() => ({ ...(location.state?.attempt?.revealed || {}) }));
  const [current, setCurrent] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  // Always re-sync with the server on mount: navigation state can be stale
  // (history.state survives reloads), while the server holds the truth -
  // same attempt, locked answers and their revealed outcomes.
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    api.startSkillAttempt(code)
      .then(data => {
        const rev = data.attempt.revealed || {};
        // Merge, letting any answer revealed locally after mount win
        setRevealed(prev => ({ ...rev, ...prev }));
        const qs = (data.questions || []).map(q => ({ id: q.id, prompt: q.question, options: q.options }));
        const firstOpen = qs.findIndex(q => !rev[q.id]);
        setAttempt(prev => ({
          ...data.attempt,
          courseTitle: prev?.courseTitle || data.attempt.courseTitle,
          questions: qs
        }));
        setCurrent(curr => curr === 0 ? (firstOpen === -1 ? 0 : firstOpen) : curr);
      })
      .catch(err => setLoadError(err.message || 'Could not load the test.'));
  }, [code]);

  // Countdown
  useEffect(() => {
    if (!attempt || result) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt, result]);

  const deadlineMs = attempt ? new Date(attempt.deadlineAt).getTime() : null;
  const remainingMs = deadlineMs ? deadlineMs - nowMs : null;
  const expired = remainingMs !== null && remainingMs <= 0;

  const answers = useMemo(() => {
    const a = {};
    for (const [qid, r] of Object.entries(revealed)) a[qid] = r.chosen;
    return a;
  }, [revealed]);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const doSubmit = useCallback(async (finalAnswers) => {
    if (submitting || result || !attempt) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const data = await api.submitSkillAttempt(attempt.id, finalAnswers);
      setResult(normalizeResult(data.result));
    } catch (err) {
      if (err.data && (err.data.result || err.data.score != null)) setResult(normalizeResult(err.data.result || err.data));
      else alert(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }, [attempt, submitting, result]);

  // Auto-submit once expired (server still validates against deadline + grace)
  useEffect(() => {
    if (expired && !result && attempt) doSubmit(answersRef.current);
  }, [expired, result, attempt, doSubmit]);

  const answeredCount = Object.keys(revealed).length;
  const correctCount = useMemo(() => Object.values(revealed).filter(r => r.correct).length, [revealed]);

  const selectOption = async (questionId, index) => {
    if (result || expired || revealing) return;
    if (revealedRef.current[questionId]) return; // already locked
    setRevealing(true);
    try {
      const data = await api.revealSkillAnswer(attempt.id, questionId, index);
      setRevealed(prev => ({ ...prev, [questionId]: { chosen: data.chosenIndex, correctIndex: data.correctIndex, correct: data.correct } }));
    } catch (err) {
      alert(err.message || 'Could not save your answer. Please try again.');
    } finally {
      setRevealing(false);
    }
  };

  const downloadCertificate = async () => {
    if (!result?.certificateId || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/skill-courses/certificates/${encodeURIComponent(result.certificateId)}/download`, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.certificateNumber || 'certificate'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center font-jakarta">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600">{loadError}</p>
        <button onClick={() => navigate('/skill-courses')} className="mt-4 text-xs font-bold text-teal-700 hover:text-teal-800">Back to skill courses</button>
      </div>
    );
  }
  if (!attempt) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>;
  }

  // ---------- Result screen ----------
  if (result) {
    const pass = result.status === 'PASSED';
    const attempted = result.attemptedCount ?? 0;
    const incorrect = Math.max(0, attempted - result.score);
    const unattempted = Math.max(0, result.totalQuestions - attempted);
    const timeUsed = formatDuration(result.timeUsedSeconds);
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 font-jakarta">
        <div className="bg-ink-950 rounded-3xl px-6 py-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-teal-300 uppercase">Skill Assessment</p>
            <p className="text-sm font-bold text-white mt-0.5">{attempt.courseTitle}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wide ${pass ? 'bg-teal-400/20 text-teal-300' : 'bg-rose-400/20 text-rose-300'}`}>
            {pass ? 'PASSED' : 'NOT PASSED'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
          <ScoreRing percent={result.percent} pass={pass} />
          <p className="text-lg font-extrabold text-ink-950 mt-4">{result.score}<span className="text-slate-400">/{result.totalQuestions} correct</span></p>
          <p className="text-xs text-slate-500 mt-1">{pass ? `Pass mark ${attempt.passPercent}% cleared` : `Needed ${attempt.passPercent}% to pass`}</p>
          {result.status === 'TIME_EXPIRED' && <p className="text-[11px] text-amber-600 font-medium mt-2">Your final submit arrived after the deadline, so only your saved answers were scored.</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 text-left">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">Correct</p>
              <p className="text-2xl font-extrabold text-ink-950 mt-1">{result.score}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="text-[10px] font-bold tracking-widest text-rose-500 uppercase">Incorrect</p>
              <p className="text-2xl font-extrabold text-ink-950 mt-1">{incorrect}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Unanswered</p>
              <p className="text-2xl font-extrabold text-ink-950 mt-1">{unattempted}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Time used</p>
              <p className="text-2xl font-extrabold text-ink-950 mt-1 font-mono">{timeUsed || '--'}</p>
            </div>
          </div>

          {pass && result.certificatePending && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 text-left">
              <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase mb-1">Result recorded</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">Your pass is saved on your account. Certificate release for this assessment is being finalised and it will appear on your dashboard once available.</p>
            </div>
          )}
          {pass && result.certificateNumber && (
            <div className="mt-6 bg-teal-50 border border-teal-200 rounded-2xl px-4 py-4 text-left">
              <p className="text-[10px] font-bold tracking-widest text-teal-700 uppercase mb-1">Skill certificate issued</p>
              <p className="font-mono text-sm font-bold text-teal-900">{result.certificateNumber}</p>
              <p className="text-[11px] text-teal-700 mt-1.5">Anyone can verify it on the certificate verification page using your secure link. It is also saved on your dashboard.</p>
              <button
                onClick={downloadCertificate}
                disabled={downloading}
                className="mt-3 inline-flex items-center gap-1.5 bg-ink-950 text-white text-xs font-bold rounded-full px-5 py-2.5 hover:bg-ink-800 transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />{downloading ? 'Preparing...' : 'Download Certificate (PDF)'}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button onClick={() => navigate('/dashboard')} className="bg-ink-950 text-white text-xs font-bold rounded-full px-6 py-3 hover:bg-ink-900 transition">Go to dashboard</button>
          {!pass && <button onClick={() => navigate(`/skill-courses/${code}`)} className="bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full px-6 py-3 hover:border-slate-300 transition">Try again</button>}
        </div>
      </div>
    );
  }

  // ---------- Live test screen ----------
  const q = attempt.questions[current];
  const fb = q ? revealed[q.id] : null;
  const total = attempt.questions.length;
  const isLast = current === total - 1;
  const lowTime = remainingMs != null && remainingMs < 120000;

  const paletteBtn = (qq, qi, sizeCls) => {
    const r = revealed[qq.id];
    return (
      <button
        key={qq.id}
        onClick={() => setCurrent(qi)}
        aria-label={`Question ${qi + 1}`}
        className={`${sizeCls} rounded-lg font-mono font-bold transition border ${
          qi === current ? 'bg-ink-950 text-white border-ink-950'
          : r ? (r.correct ? 'bg-emerald-500/90 text-white border-emerald-500' : 'bg-rose-500/90 text-white border-rose-500')
          : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'
        }`}
      >
        {String(qi + 1).padStart(2, '0')}
      </button>
    );
  };

  const paletteLegend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-semibold text-slate-500">
      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />{correctCount} Correct</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />{answeredCount - correctCount} Incorrect</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ink-950" />Current</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />{total - answeredCount} Pending</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 font-jakarta">
      {/* Exam header band */}
      <div className="bg-ink-950 rounded-3xl px-5 sm:px-6 py-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 px-2.5 py-1 rounded-md bg-teal-400/15 border border-teal-300/30 text-teal-300 font-mono text-[11px] font-bold">{attempt.courseCode}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{attempt.courseTitle}</p>
            <p className="text-[11px] text-slate-400">{total} Questions &middot; {attempt.durationMinutes} Mins</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-400/15 border border-teal-300/30 text-teal-300 text-[10px] font-extrabold tracking-wider uppercase">
            <Lock className="w-3 h-3" />First-Choice Lock
          </span>
          <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold rounded-full px-4 py-1.5 border ${lowTime ? 'bg-rose-500/15 text-rose-300 border-rose-400/40' : 'bg-white/10 text-white border-white/15'}`}>
            <Clock className="w-4 h-4" />{formatClock(remainingMs || 0)}
          </span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 lg:items-start">
        {/* Question card */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 rounded-full bg-ink-950 text-white text-[10px] font-extrabold tracking-wider uppercase">Question {current + 1} of {total}</span>
            <span className="text-[11px] text-slate-500 font-semibold">{answeredCount} answered</span>
          </div>

          {q && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
              <p className="text-base sm:text-lg font-bold text-ink-950 leading-relaxed mb-6">{q.prompt}</p>
              <div className="grid gap-3">
                {q.options.map((opt, oi) => {
                  let cls = 'bg-slate-50 border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 text-slate-700';
                  let badgeCls = 'bg-white border-slate-300 text-slate-500';
                  let indicator = <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />;
                  if (fb) {
                    if (oi === fb.correctIndex) {
                      cls = 'bg-emerald-50 border-emerald-400 text-emerald-900';
                      badgeCls = 'bg-emerald-500 border-emerald-500 text-white';
                      indicator = <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></span>;
                    } else if (oi === fb.chosen) {
                      cls = 'bg-rose-50 border-rose-400 text-rose-900';
                      badgeCls = 'bg-rose-500 border-rose-500 text-white';
                      indicator = <span className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shrink-0"><X className="w-3 h-3 text-white" /></span>;
                    } else {
                      cls = 'bg-slate-50 border-slate-100 text-slate-400';
                      badgeCls = 'bg-white border-slate-200 text-slate-300';
                      indicator = <span className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />;
                    }
                  }
                  return (
                    <button
                      key={oi}
                      onClick={() => selectOption(q.id, oi)}
                      disabled={!!fb || revealing || expired}
                      className={`text-left text-sm leading-relaxed rounded-2xl border-2 px-4 py-3.5 transition flex items-center gap-3 disabled:cursor-default ${cls}`}
                    >
                      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-extrabold shrink-0 ${badgeCls}`}>{String.fromCharCode(65 + oi)}</span>
                      <span className="flex-1">{opt}</span>
                      {indicator}
                    </button>
                  );
                })}
              </div>

              {fb && (
                <p className={`mt-5 text-xs font-semibold ${fb.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fb.correct ? 'Correct - answer locked in.' : 'Not quite - the correct option is highlighted. Answer locked in.'}
                </p>
              )}
              {!fb && (
                <p className="mt-5 text-[11px] text-slate-400">Tap an option to lock it in and see the result. You cannot change it afterwards.</p>
              )}

              <div className="flex items-center justify-between gap-3 mt-7 pt-5 border-t border-slate-100">
                <button
                  onClick={() => setCurrent(c => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-full border border-slate-200 bg-white transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                {!isLast ? (
                  <button
                    onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
                    disabled={!fb}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-2.5 rounded-full transition"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-ink-950 hover:bg-ink-800 px-6 py-2.5 rounded-full transition"
                  >
                    Finish & Submit
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mobile palette */}
          <div className="lg:hidden mt-6 bg-white border border-slate-200 rounded-3xl p-5">
            <p className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase mb-3">Question Palette</p>
            {paletteLegend}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {attempt.questions.map((qq, qi) => paletteBtn(qq, qi, 'w-8 h-8 text-[10px]'))}
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full mt-4 bg-ink-950 text-white font-bold text-xs rounded-full py-3 hover:bg-ink-900 transition"
            >
              Finish & Submit Assessment
            </button>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block space-y-4 sticky top-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5">
            <p className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase mb-3">Question Palette</p>
            {paletteLegend}
            <div className="grid grid-cols-5 gap-1.5 mt-4">
              {attempt.questions.map((qq, qi) => paletteBtn(qq, qi, 'w-full h-9 text-[11px]'))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-5">
            <p className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Final Check</p>
            <p className="text-xs text-slate-500 mt-1.5">{total - answeredCount === 0 ? 'All questions answered.' : `${total - answeredCount} question${total - answeredCount === 1 ? '' : 's'} still unanswered - unanswered questions score zero.`}</p>
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full mt-4 bg-ink-950 text-white font-bold text-xs rounded-full py-3 hover:bg-ink-900 transition"
            >
              Finish & Submit Assessment
            </button>
          </div>
        </div>
      </div>

      {/* Submit confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-ink-950 px-6 py-4">
              <p className="text-[10px] font-bold tracking-widest text-teal-300 uppercase">Final checkpoint</p>
              <p className="text-base font-extrabold text-white mt-0.5">Submit Assessment?</p>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 leading-relaxed">Once submitted, your locked answers are scored and the attempt closes. Locked answers cannot be modified - this is final.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <p className="text-lg font-extrabold text-ink-950">{total}</p>
                  <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">Questions</p>
                </div>
                <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
                  <p className="text-lg font-extrabold text-teal-700">{answeredCount}</p>
                  <p className="text-[9px] font-bold tracking-widest text-teal-600 uppercase mt-0.5">Answered</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                  <p className="text-lg font-extrabold text-slate-600">{total - answeredCount}</p>
                  <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">Blank</p>
                </div>
                <div className="rounded-xl bg-ink-950 p-3 text-center">
                  <p className="text-lg font-extrabold text-white font-mono">{formatClock(remainingMs || 0)}</p>
                  <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">Time left</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-5">
                {attempt.questions.map((qq, qi) => {
                  const r = revealed[qq.id];
                  return (
                    <span key={qq.id} className={`w-7 h-7 rounded-md text-[10px] font-mono font-bold flex items-center justify-center ${r ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      {qi + 1}
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 transition"
                >
                  Return to Exam
                </button>
                <button
                  onClick={() => doSubmit(answers)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-full bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Scoring...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
