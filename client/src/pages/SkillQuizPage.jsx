import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, Lock, XCircle } from 'lucide-react';
import { api } from '../services/api';

function normalizeResult(r = {}) {
  return {
    score: r.score,
    totalQuestions: r.totalQuestions,
    percent: r.scorePercent,
    certificatePending: r.certificatePending === true,
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

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600">{loadError}</p>
        <button onClick={() => navigate('/skill-courses')} className="mt-4 text-xs font-bold text-cyan-600 hover:text-cyan-700">Back to skill courses</button>
      </div>
    );
  }
  if (!attempt) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 text-cyan-600 animate-spin" /></div>;
  }

  if (result) {
    const pass = result.status === 'PASSED';
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        {pass
          ? <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          : <XCircle className="w-14 h-14 text-rose-500 mx-auto mb-4" />}
        <h1 className="text-3xl font-black text-ink-950 tracking-tight mb-2">{pass ? 'You passed' : 'Not this time'}</h1>
        <p className="text-sm text-slate-500 mb-8">{attempt.courseTitle}</p>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 mb-8">
          <p className="text-5xl font-black text-ink-950 tracking-tight">{result.score}<span className="text-2xl text-slate-400">/{result.totalQuestions}</span></p>
          <p className="text-xs font-bold text-slate-500 mt-2 tracking-wide uppercase">{result.percent}% &middot; {pass ? 'passed' : `needed ${attempt.passPercent}%`}</p>
          {result.status === 'TIME_EXPIRED' && <p className="text-[11px] text-amber-600 font-medium mt-3">Your final submit arrived after the deadline, so only your saved answers were scored.</p>}
          {pass && result.certificatePending && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase mb-1">Result recorded</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">Your pass is saved on your account. Certificate release for this assessment is being finalised and it will appear on your dashboard once available.</p>
            </div>
          )}
          {pass && result.certificateNumber && (
            <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mb-1">Skill certificate issued</p>
              <p className="font-mono text-sm font-bold text-emerald-800">{result.certificateNumber}</p>
              <p className="text-[11px] text-emerald-700 mt-1.5">Anyone can verify it on the certificate verification page using your secure link. It is also saved on your dashboard.</p>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate('/dashboard')} className="bg-ink-950 text-white text-xs font-bold rounded-full px-6 py-3 hover:bg-ink-900 transition">Go to dashboard</button>
          {!pass && <button onClick={() => navigate(`/skill-courses/${code}`)} className="bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-full px-6 py-3 hover:border-slate-300 transition">Try again</button>}
        </div>
      </div>
    );
  }

  const q = attempt.questions[current];
  const fb = q ? revealed[q.id] : null;
  const total = attempt.questions.length;
  const isLast = current === total - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{attempt.courseTitle}</p>
          <p className="text-xs text-slate-500 mt-0.5">Question {current + 1} of {total} &middot; {answeredCount} answered</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5" />First choice locks
          </span>
          <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold rounded-full px-4 py-1.5 border ${remainingMs != null && remainingMs < 120000 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-ink-950 border-slate-200'}`}>
            <Clock className="w-4 h-4" />{formatClock(remainingMs || 0)}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${(answeredCount / total) * 100}%` }} />
      </div>

      {q && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
          <p className="text-base font-bold text-ink-950 leading-relaxed mb-6"><span className="text-slate-400 font-semibold mr-2">Q{current + 1}.</span>{q.prompt}</p>
          <div className="grid gap-2.5">
            {q.options.map((opt, oi) => {
              let cls = 'bg-slate-50 text-slate-600 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40';
              let badge = null;
              if (fb) {
                if (oi === fb.correctIndex) {
                  cls = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                  badge = <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
                } else if (oi === fb.chosen) {
                  cls = 'bg-rose-50 text-rose-800 border-rose-300';
                  badge = <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
                } else {
                  cls = 'bg-slate-50 text-slate-400 border-slate-100';
                }
              }
              return (
                <button
                  key={oi}
                  onClick={() => selectOption(q.id, oi)}
                  disabled={!!fb || revealing || expired}
                  className={`text-left text-xs leading-relaxed rounded-2xl border px-4 py-3 transition flex items-center justify-between gap-3 disabled:cursor-default ${cls}`}
                >
                  <span><span className={`font-bold mr-2 ${fb ? 'opacity-70' : 'text-slate-400'}`}>{String.fromCharCode(65 + oi)}.</span>{opt}</span>
                  {badge}
                </button>
              );
            })}
          </div>

          {fb && (
            <p className={`mt-4 text-xs font-semibold ${fb.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fb.correct ? 'Correct - answer locked in.' : 'Not quite - the correct option is highlighted. Answer locked in.'}
            </p>
          )}
          {!fb && (
            <p className="mt-4 text-[11px] text-slate-400">Tap an option to lock it in and see the result. You cannot change it afterwards.</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mt-6">
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
            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-ink-950 hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-2.5 rounded-full transition"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => { if (window.confirm(`Submit with ${answeredCount} of ${total} questions answered? Unanswered questions score zero.`)) doSubmit(answers); }}
            disabled={submitting}
            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 px-6 py-2.5 rounded-full transition"
          >
            {submitting ? 'Scoring...' : 'Submit Test'}
          </button>
        )}
      </div>

      {/* Question jump strip (review locked answers) */}
      <div className="flex flex-wrap gap-1.5 mt-8 justify-center">
        {attempt.questions.map((qq, qi) => {
          const r = revealed[qq.id];
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(qi)}
              aria-label={`Question ${qi + 1}`}
              className={`w-7 h-7 rounded-lg text-[10px] font-bold transition border ${
                qi === current ? 'border-ink-950 text-ink-950 bg-white'
                : r ? (r.correct ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200')
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
              }`}
            >
              {qi + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
