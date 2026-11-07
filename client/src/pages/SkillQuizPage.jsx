import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Loader2, Save, XCircle } from 'lucide-react';
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
  const [answers, setAnswers] = useState(() => {
    const init = {};
    (location.state?.attempt?.questions || []).forEach(q => { if (q.chosen != null) init[q.id] = q.chosen; });
    return init;
  });
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [nowMs, setNowMs] = useState(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // If the page was loaded directly, (re)start the attempt.
  useEffect(() => {
    if (attempt) return;
    api.startSkillAttempt(code)
      .then(data => {
        const init = {};
        (data.questions || []).forEach(q => { const c = data.attempt.answers && data.attempt.answers[q.id]; if (c != null) init[q.id] = c; });
        setAnswers(init);
        setAttempt({
          ...data.attempt,
          questions: (data.questions || []).map(q => ({ id: q.id, prompt: q.question, options: q.options, chosen: init[q.id] != null ? init[q.id] : null }))
        });
      })
      .catch(err => setLoadError(err.message || 'Could not load the test.'));
  }, [code, attempt]);

  // Countdown
  useEffect(() => {
    if (!attempt || result) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt, result]);

  const deadlineMs = attempt ? new Date(attempt.deadlineAt).getTime() : null;
  const remainingMs = deadlineMs ? deadlineMs - nowMs : null;
  const expired = remainingMs !== null && remainingMs <= 0;

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

  const answeredCount = useMemo(() => Object.values(answers).filter(v => v != null).length, [answers]);

  const selectOption = (questionId, index) => {
    if (result || expired) return;
    const next = { ...answers, [questionId]: index };
    setAnswers(next);
    setSaveState('saving');
    api.saveSkillAnswers(attempt.id, next)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{attempt.courseTitle}</p>
          <p className="text-xs text-slate-500 mt-0.5">{answeredCount} of {attempt.questions.length} answered</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Save className="w-3.5 h-3.5" />{saveState === 'saving' ? 'Saving...' : saveState === 'error' ? 'Retrying...' : 'Saved'}
          </span>
          <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold rounded-full px-4 py-1.5 border ${remainingMs != null && remainingMs < 120000 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-ink-950 border-slate-200'}`}>
            <Clock className="w-4 h-4" />{formatClock(remainingMs || 0)}
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {attempt.questions.map((q, qi) => (
          <div key={q.id} className="bg-white border border-slate-200 rounded-3xl p-6">
            <p className="text-sm font-bold text-ink-950 leading-relaxed mb-4"><span className="text-slate-400 font-semibold mr-2">Q{qi + 1}.</span>{q.prompt}</p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {q.options.map((opt, oi) => {
                const active = answers[q.id] === oi;
                return (
                  <button
                    key={oi}
                    onClick={() => selectOption(q.id, oi)}
                    className={`text-left text-xs leading-relaxed rounded-2xl border px-4 py-3 transition ${active ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40'}`}
                  >
                    <span className={`font-bold mr-2 ${active ? 'text-white/80' : 'text-slate-400'}`}>{String.fromCharCode(65 + oi)}.</span>{opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-8">
        <button
          onClick={() => { if (window.confirm(`Submit with ${answeredCount} of ${attempt.questions.length} questions answered?`)) doSubmit(answers); }}
          disabled={submitting}
          className="w-full bg-ink-950 text-white font-bold text-sm rounded-full py-4 hover:bg-ink-900 transition shadow-lg shadow-ink-950/20 disabled:opacity-50"
        >
          {submitting ? 'Scoring...' : 'Submit Test'}
        </button>
      </div>
    </div>
  );
}
